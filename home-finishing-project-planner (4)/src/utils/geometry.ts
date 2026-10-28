import type { Pt, Room } from "../types";

export function dist(a: Pt, b: Pt) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function shoelace(pts: Pt[]) {
  if (pts.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(a) / 2;
}

export function periPx(pts: Pt[]) {
  let p = 0;
  for (let i = 0; i < pts.length; i++) p += dist(pts[i], pts[(i + 1) % pts.length]);
  return p;
}

export function bbox(pts: Pt[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0, w: 0, h: 0 };
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

export function centroid(pts: Pt[]) {
  if (!pts.length) return { x: 0, y: 0 };
  const b = bbox(pts);
  return { x: b.minX + b.w / 2, y: b.minY + b.h / 2 };
}

export function rectPoints(x: number, y: number, w: number, h: number): Pt[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

export function polyPath(pts: Pt[]) {
  if (!pts.length) return "";
  return pts.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ") + " Z";
}

export function dimsFromPoly(pts: Pt[], scale: number) {
  const s = Math.max(1e-6, scale);
  const b = bbox(pts);
  const length = b.w / s;
  const width = b.h / s;
  const area = shoelace(pts) / (s * s);
  const peri = periPx(pts) / s;
  return { length, width, area, peri, minX: b.minX, minY: b.minY, w: b.w, h: b.h };
}

export function syncFromPoints(room: Room, points: Pt[], scale: number): Room {
  const d = dimsFromPoly(points, scale);
  return {
    ...room,
    points,
    x: d.minX,
    y: d.minY,
    length: Math.round(d.length * 100) / 100,
    width: Math.round(d.width * 100) / 100,
    areaM2: Math.round(d.area * 100) / 100,
    perimeterM: Math.round(d.peri * 100) / 100,
  };
}

export function pointsForRoom(room: Room, scale: number): Pt[] {
  if (room.points && room.points.length >= 3) return room.points;
  return rectPoints(room.x, room.y, room.length * scale, room.width * scale);
}

export function translate(pts: Pt[], dx: number, dy: number): Pt[] {
  return pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

export function setVertex(pts: Pt[], i: number, p: Pt): Pt[] {
  return pts.map((q, k) => (k === i ? p : q));
}

export function setEdgeLength(pts: Pt[], edge: number, newLen: number): Pt[] {
  const n = pts.length;
  const a = pts[edge];
  const b = pts[(edge + 1) % n];
  const d = dist(a, b) || 1;
  const k = newLen / d;
  const nb = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  return pts.map((p, i) => (i === (edge + 1) % n ? nb : p));
}

export function insertOnEdge(pts: Pt[], edge: number, p: Pt): Pt[] {
  const next = pts.slice();
  next.splice(edge + 1, 0, p);
  return next;
}

export function removeVertex(pts: Pt[], i: number): Pt[] {
  if (pts.length <= 3) return pts;
  return pts.filter((_, k) => k !== i);
}

export function closestEdge(pts: Pt[], p: Pt) {
  let best = 0;
  let bestD = Infinity;
  let hit: Pt = p;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const q = projectOnSeg(a, b, p);
    const d = dist(p, q);
    if (d < bestD) {
      bestD = d;
      best = i;
      hit = q;
    }
  }
  return { edge: best, dist: bestD, hit };
}

function projectOnSeg(a: Pt, b: Pt, p: Pt): Pt {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

export function rdp(pts: Pt[], epsilon: number): Pt[] {
  if (pts.length < 3) return pts.slice();
  const closed = dist(pts[0], pts[pts.length - 1]) < 1e-6;
  const src = closed ? pts.slice(0, -1) : pts;
  const out = simplify(src, epsilon);
  return out.length >= 3 ? out : src.slice(0, 4);
}

function simplify(pts: Pt[], eps: number): Pt[] {
  let maxD = 0;
  let idx = 0;
  const a = pts[0];
  const b = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], a, b);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD > eps) {
    const left = simplify(pts.slice(0, idx + 1), eps);
    const right = simplify(pts.slice(idx), eps);
    return left.slice(0, -1).concat(right);
  }
  return [a, b];
}

function perpDist(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / l;
}

export function cleanPoly(pts: Pt[], minDist = 1.5): Pt[] {
  if (pts.length < 3) return pts.slice();
  const out: Pt[] = [];
  for (const p of pts) {
    const prev = out[out.length - 1];
    if (!prev || dist(prev, p) >= minDist) out.push(p);
  }
  if (out.length > 2 && dist(out[0], out[out.length - 1]) < minDist) out.pop();
  return out.length >= 3 ? out : pts.slice();
}

/** Snap a closed polygon to horizontal / vertical walls (typical architectural plans). */
export function orthogonalize(pts: Pt[]): Pt[] {
  const p = cleanPoly(pts, 2);
  if (p.length < 4) return p;
  type Seg = { horz: boolean; x: number; y: number };
  const segs: Seg[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.hypot(dx, dy) < 2) continue;
    const horz = Math.abs(dx) >= Math.abs(dy);
    segs.push({ horz, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }
  if (segs.length < 4) return p;
  const merged: Seg[] = [];
  for (const s of segs) {
    const last = merged[merged.length - 1];
    if (last && last.horz === s.horz) {
      last.x = (last.x + s.x) / 2;
      last.y = (last.y + s.y) / 2;
    } else merged.push({ ...s });
  }
  if (merged.length > 3 && merged[0].horz === merged[merged.length - 1].horz) {
    const f = merged[0];
    const l = merged.pop()!;
    f.x = (f.x + l.x) / 2;
    f.y = (f.y + l.y) / 2;
  }
  if (merged.length < 4) return p;
  const verts: Pt[] = [];
  for (let i = 0; i < merged.length; i++) {
    const e = merged[i];
    const n = merged[(i + 1) % merged.length];
    if (e.horz === n.horz) continue;
    verts.push(e.horz ? { x: n.x, y: e.y } : { x: e.x, y: n.y });
  }
  const cleaned = cleanPoly(verts, 3);
  return cleaned.length >= 4 ? cleaned : p;
}

export function svgCoords(svg: SVGSVGElement, clientX: number, clientY: number): Pt {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}
