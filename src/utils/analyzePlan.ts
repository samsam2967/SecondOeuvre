import type { Pt } from "../types";
import { bbox, orthogonalize, rdp, shoelace } from "./geometry";

export interface DetectedRoom {
  points: Pt[];
  areaPx: number;
  solidity: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image illisible"));
    img.src = src;
  });
}

function morph(src: Uint8Array, w: number, h: number, dilate: boolean) {
  const out = new Uint8Array(src.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (dilate) {
        let on = 0;
        for (let dy = -1; dy <= 1 && !on; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (src[(y + dy) * w + (x + dx)]) {
              on = 1;
              break;
            }
          }
        }
        out[i] = on;
      } else {
        let ok = 1;
        for (let dy = -1; dy <= 1 && ok; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!src[(y + dy) * w + (x + dx)]) {
              ok = 0;
              break;
            }
          }
        }
        out[i] = ok;
      }
    }
  }
  return out;
}

function distanceTransform(free: Uint8Array, w: number, h: number) {
  const inf = w + h;
  const d = new Int32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = free[i] ? inf : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      if (x) d[i] = Math.min(d[i], d[i - 1] + 1);
      if (y) d[i] = Math.min(d[i], d[i - w] + 1);
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      if (x + 1 < w) d[i] = Math.min(d[i], d[i + 1] + 1);
      if (y + 1 < h) d[i] = Math.min(d[i], d[i + w] + 1);
    }
  }
  return d;
}

function label4(mask: Uint8Array, w: number, h: number) {
  const labels = new Int32Array(w * h);
  const areas: number[] = [0];
  const qx = new Int32Array(w * h);
  const qy = new Int32Array(w * h);
  let id = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i] || labels[i]) continue;
      id++;
      let head = 0;
      let tail = 0;
      qx[0] = x;
      qy[0] = y;
      labels[i] = id;
      let area = 0;
      while (head <= tail) {
        const cx = qx[head];
        const cy = qy[head++];
        area++;
        const nbs = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];
        for (const [dx, dy] of nbs) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (!mask[ni] || labels[ni]) continue;
          labels[ni] = id;
          tail++;
          qx[tail] = nx;
          qy[tail] = ny;
        }
      }
      areas[id] = area;
    }
  }
  return { labels, areas, id, qx, qy };
}

function expandLabels(labels: Int32Array, free: Uint8Array, walls: Uint8Array, w: number, h: number) {
  const qx = new Int32Array(w * h);
  const qy = new Int32Array(w * h);
  let head = 0;
  let tail = -1;
  const nbs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!labels[i]) continue;
      for (const [dx, dy] of nbs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (free[ni] && !labels[ni] && !walls[ni]) {
          labels[ni] = labels[i];
          tail++;
          qx[tail] = nx;
          qy[tail] = ny;
        }
      }
    }
  }
  while (head <= tail) {
    const cx = qx[head];
    const cy = qy[head++];
    const lab = labels[cy * w + cx];
    for (const [dx, dy] of nbs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (!free[ni] || labels[ni] || walls[ni]) continue;
      labels[ni] = lab;
      tail++;
      qx[tail] = nx;
      qy[tail] = ny;
    }
  }
}

function traceBoundary(labels: Int32Array, w: number, h: number, id: number): Pt[] {
  let sx = -1;
  let sy = -1;
  outer: for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (labels[y * w + x] !== id) continue;
      if (
        labels[y * w + x - 1] !== id ||
        labels[y * w + x + 1] !== id ||
        labels[(y - 1) * w + x] !== id ||
        labels[(y + 1) * w + x] !== id
      ) {
        sx = x;
        sy = y;
        break outer;
      }
    }
  }
  if (sx < 0) return [];
  const dirs = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ];
  const pts: Pt[] = [];
  let x = sx;
  let y = sy;
  let dir = 0;
  for (let n = 0; n < 20000; n++) {
    pts.push({ x, y });
    let found = false;
    for (let k = 0; k < 8; k++) {
      const nd = (dir + 6 + k) % 8;
      const nx = x + dirs[nd][0];
      const ny = y + dirs[nd][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (labels[ny * w + nx] === id) {
        x = nx;
        y = ny;
        dir = nd;
        found = true;
        break;
      }
    }
    if (!found) break;
    if (x === sx && y === sy && pts.length > 12) break;
  }
  return pts;
}

function pointInPoly(p: Pt, poly: Pt[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const hit = a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y || 1e-6) + a.x;
    if (hit) inside = !inside;
  }
  return inside;
}

function wallsFromGray(gray: Uint8Array, w: number, h: number) {
  const win = 18;
  const iw = w + 1;
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let run = 0;
    for (let x = 0; x < w; x++) {
      run += gray[y * w + x];
      integral[(y + 1) * iw + (x + 1)] = integral[y * iw + (x + 1)] + run;
    }
  }
  const sumBox = (x0: number, y0: number, x1: number, y1: number) => {
    x0 = Math.max(0, x0);
    y0 = Math.max(0, y0);
    x1 = Math.min(w, x1);
    y1 = Math.min(h, y1);
    return integral[y1 * iw + x1] - integral[y0 * iw + x1] - integral[y1 * iw + x0] + integral[y0 * iw + x0];
  };
  const walls = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const area = (Math.min(w, x + win) - Math.max(0, x - win)) * (Math.min(h, y + win) - Math.max(0, y - win));
      const mean = sumBox(x - win, y - win, x + win, y + win) / Math.max(1, area);
      walls[y * w + x] = gray[y * w + x] < mean * 0.86 ? 1 : 0;
    }
  }
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -gray[i - w - 1] -
        2 * gray[i - 1] -
        gray[i + w - 1] +
        gray[i - w + 1] +
        2 * gray[i + 1] +
        gray[i + w + 1];
      const gy =
        -gray[i - w - 1] -
        2 * gray[i - w] -
        gray[i - w + 1] +
        gray[i + w - 1] +
        2 * gray[i + w] +
        gray[i + w + 1];
      const mag = Math.abs(gx) + Math.abs(gy);
      if (mag > 220 && gray[i] < 200) walls[i] = 1;
    }
  }
  return walls;
}

function dropText(walls: Uint8Array, w: number, h: number) {
  const { labels, areas, id } = label4(walls, w, h);
  const keep = new Uint8Array(id + 1);
  for (let i = 1; i <= id; i++) {
    if (areas[i] >= 90) keep[i] = 1;
    else if (areas[i] >= 28) {
      let minx = w,
        miny = h,
        maxx = 0,
        maxy = 0;
      for (let p = 0; p < labels.length; p++) {
        if (labels[p] !== i) continue;
        const x = p % w;
        const y = (p / w) | 0;
        if (x < minx) minx = x;
        if (y < miny) miny = y;
        if (x > maxx) maxx = x;
        if (y > maxy) maxy = y;
      }
      const bw = maxx - minx + 1;
      const bh = maxy - miny + 1;
      const ar = bw / Math.max(1, bh);
      if (ar > 3.2 || ar < 1 / 3.2) keep[i] = 1;
    }
  }
  const out = new Uint8Array(walls.length);
  for (let i = 0; i < walls.length; i++) if (keep[labels[i]]) out[i] = 1;
  return out;
}

function extractRooms(labels: Int32Array, id: number, w: number, h: number, sx: number, sy: number, imgArea: number): DetectedRoom[] {
  const areaOf = new Array(id + 1).fill(0);
  for (let i = 0; i < labels.length; i++) if (labels[i] > 0) areaOf[labels[i]]++;
  const rooms: DetectedRoom[] = [];
  for (let i = 1; i <= id; i++) {
    const area = areaOf[i];
    if (area < imgArea * 0.0035 || area > imgArea * 0.4) continue;
    let t = 0,
      btm = 0,
      l = 0,
      r = 0;
    for (let x = 0; x < w; x++) {
      if (labels[x] === i) t++;
      if (labels[(h - 1) * w + x] === i) btm++;
    }
    for (let y = 0; y < h; y++) {
      if (labels[y * w] === i) l++;
      if (labels[y * w + w - 1] === i) r++;
    }
    let touches = 0;
    if (t > 8) touches++;
    if (btm > 8) touches++;
    if (l > 8) touches++;
    if (r > 8) touches++;
    if (touches >= 2) continue;
    if (t + btm + l + r > (w + h) * 0.25) continue;
    let contour = traceBoundary(labels, w, h, i);
    if (contour.length < 18) continue;
    if (contour.length > 1800) {
      const step = Math.ceil(contour.length / 900);
      contour = contour.filter((_, idx) => idx % step === 0);
    }
    const simple = rdp(contour, 2.2);
    const ortho = orthogonalize(simple);
    const pts = ortho.map((p) => ({ x: p.x * sx, y: p.y * sy }));
    const a = shoelace(pts);
    const box = bbox(pts);
    if (box.w < 18 || box.h < 18 || a < 400) continue;
    const solidity = a / Math.max(1, box.w * box.h);
    if (solidity < 0.34) continue;
    const ar = box.w / Math.max(1, box.h);
    if (ar > 16 || ar < 1 / 16) continue;
    rooms.push({ points: pts, areaPx: a, solidity });
  }
  rooms.sort((a, b) => b.areaPx - a.areaPx);
  const kept: DetectedRoom[] = [];
  for (const r of rooms) {
    const c = { x: 0, y: 0 };
    const b = bbox(r.points);
    c.x = b.minX + b.w / 2;
    c.y = b.minY + b.h / 2;
    if (kept.some((k) => pointInPoly(c, k.points) && r.areaPx < k.areaPx * 0.9)) continue;
    kept.push(r);
  }
  return kept;
}

function score(rooms: DetectedRoom[]) {
  if (rooms.length < 2) return rooms.length * 2;
  if (rooms.length > 24) return 4;
  let s = rooms.length * 10;
  for (const r of rooms) {
    s += r.solidity * 6;
    const n = r.points.length;
    if (n >= 4 && n <= 8) s += 4;
    else if (n <= 12) s += 1;
  }
  if (rooms.length >= 4 && rooms.length <= 16) s += 12;
  return s;
}

export async function analyzeFloorPlan(src: string): Promise<{
  width: number;
  height: number;
  rooms: DetectedRoom[];
}> {
  const img = await loadImage(src);
  const maxW = 1100;
  const k = Math.min(1, maxW / Math.max(1, img.naturalWidth));
  const w = Math.max(64, Math.round(img.naturalWidth * k));
  const h = Math.max(64, Math.round(img.naturalHeight * k));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { width: img.naturalWidth, height: img.naturalHeight, rooms: [] };
  ctx.drawImage(img, 0, 0, w, h);
  const raw = ctx.getImageData(0, 0, w, h).data;
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    gray[i] = (raw[o] * 0.3 + raw[o + 1] * 0.59 + raw[o + 2] * 0.11) | 0;
  }
  let lo = 255;
  let hi = 0;
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] < lo) lo = gray[i];
    if (gray[i] > hi) hi = gray[i];
  }
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < gray.length; i++) gray[i] = ((gray[i] - lo) * 255) / span;

  let walls = wallsFromGray(gray, w, h);
  walls = dropText(walls, w, h);
  walls = morph(walls, w, h, true);
  walls = morph(walls, w, h, false);

  const free = new Uint8Array(w * h);
  for (let i = 0; i < free.length; i++) free[i] = walls[i] ? 0 : 1;
  const dist = distanceTransform(free, w, h);
  let maxD = 0;
  for (let i = 0; i < dist.length; i++) if (dist[i] > maxD) maxD = dist[i];

  const sx = img.naturalWidth / w;
  const sy = img.naturalHeight / h;
  const imgArea = w * h;

  let best: DetectedRoom[] = [];
  let bestScore = -1;
  const thrs = [3, 4, 5, 6, 8, 10, 12].map((t) => Math.max(3, Math.min(t, Math.round(maxD * 0.22))));
  const uniq = [...new Set(thrs)];

  for (const coreThr of uniq) {
    const cores = new Uint8Array(w * h);
    for (let i = 0; i < dist.length; i++) cores[i] = dist[i] >= coreThr ? 1 : 0;
    const labeled = label4(cores, w, h);
    for (let i = 1; i <= labeled.id; i++) {
      if (labeled.areas[i] < 16) {
        for (let p = 0; p < labeled.labels.length; p++) if (labeled.labels[p] === i) labeled.labels[p] = 0;
      }
    }
    expandLabels(labeled.labels, free, walls, w, h);
    const rooms = extractRooms(labeled.labels, labeled.id, w, h, sx, sy, imgArea);
    const sc = score(rooms);
    if (sc > bestScore) {
      bestScore = sc;
      best = rooms;
    }
  }

  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
    rooms: best.slice(0, 28),
  };
}
