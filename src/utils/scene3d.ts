import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ISOLANTS } from "../data/catalogs";
import type { ElecDevice, Floor, Opening, PostId, Project, Room } from "../types";
import { resolvePaint, resolveTile, type ResolvedTile } from "./calc";
import { DEVICE_KINDS, floorElevations, inPoly, kindInfo, RUN_TYPES } from "./elecPlan";
import { pointsForRoom } from "./geometry";
import { defaultElec, roomEdges } from "./surfaces";
import { computeLayout } from "./tileLayout";
import { analyzeVmc } from "./vmcPlan";

export interface LegendItem {
  color: string;
  label: string;
}

export interface Scene3DOptions {
  layers: Set<PostId>;
  floorId: string;
  ceilings: boolean;
  /** Masque les finitions de sol pour voir ce qu'il y a dessous (isolant, tubes). */
  xray: boolean;
  /** Affiche l'ossature (rails et montants) derrière les plaques. */
  ossature: boolean;
  /** Colore les coupes de carrelage du calepinage. */
  cuts: boolean;
  selectedOpening: string | null;
}

export interface TexCtx {
  cache: Map<string, THREE.Texture>;
  redraw: () => void;
}

export interface WallPick {
  kind: "wall";
  roomId: string;
  floorId: string;
  edge: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

export interface Built {
  root: THREE.Group;
  pickables: THREE.Object3D[];
  box: THREE.Box3;
  legend: LegendItem[];
  notes: string[];
  /** Position effective de chaque ouverture (placement manuel ou automatique). */
  placements: Map<string, { roomId: string; edge: number; t: number }>;
  dispose: () => void;
}

interface Placed {
  o: Opening;
  center: number;
  width: number;
  sill: number;
  height: number;
}

interface Wall {
  room: Room;
  floor: Floor;
  idx: number;
  len: number;
  swapped: boolean;
  exterior: boolean;
  passage: boolean;
  placoType: string;
  elev: number;
  h: number;
  group: THREE.Group;
  placed: Placed[];
}

const NEUTRAL_WALL = "#dedad1";
const NEUTRAL_FLOOR = "#e6e3dc";

const PLAQUE_COLOR: Record<string, string> = {
  ba13: "#ebe9e2",
  hydro: "#a9d1a6",
  phonique: "#aec4de",
  feu: "#e8b4b4",
  ba15: "#e4e1d6",
  haute_durete: "#b9bcc2",
  none: "#cccccc",
};
const PLAQUE_LABEL: Record<string, string> = {
  ba13: "Plaque BA13",
  hydro: "Plaque hydro (hydrofugée)",
  phonique: "Plaque phonique",
  feu: "Plaque coupe-feu",
  ba15: "Plaque BA15",
  haute_durete: "Plaque haute dureté",
};

export const OPENING_LABEL: Record<Opening["type"], string> = {
  porte: "Porte",
  fenetre: "Fenêtre",
  baie: "Baie vitrée",
  porte_fenetre: "Porte-fenêtre",
  trappe: "Trappe",
};

/** Couleur de carrelage déduite du nom quand aucune couleur ni photo n'est renseignée. */
export function guessTileColor(name: string): string {
  const n = name.toLowerCase();
  if (/noir|anthracite|ardoise/.test(n)) return "#3d3f43";
  if (/blanc|blanche/.test(n)) return "#f0efeb";
  if (/terre|terra|cotto|brique/.test(n)) return "#c0693f";
  if (/b[ée]ton|gris|pierre/.test(n)) return "#9c9ea2";
  if (/beige|sable|cr[èe]me/.test(n)) return "#d9c9a9";
  if (/bois|ch[êe]ne|parquet/.test(n)) return "#b58a5a";
  if (/bleu/.test(n)) return "#6f93b5";
  if (/vert/.test(n)) return "#7ea58a";
  return "#c9c5bc";
}

/** « Nom 60×60 cm » sans répéter les dimensions si le nom les contient déjà. */
function withDims(name: string, l: number, w: number): string {
  const a = Math.round(l * 100);
  const b = Math.round(w * 100);
  return new RegExp(`${a}\\s*[x×]\\s*${b}|${b}\\s*[x×]\\s*${a}`, "i").test(name) ? name : `${name} ${a}×${b} cm`;
}

function isolantColor(name: string, bio: boolean): string {
  const n = name.toLowerCase();
  if (/fibre de bois|bois/.test(n) || bio) return "#c8a56a";
  if (/roche/.test(n)) return "#c9b348";
  if (/verre/.test(n)) return "#e8d45e";
  if (/polyur|pir|pu\b/.test(n)) return "#e3b04a";
  if (/pse|polystyr|xps/.test(n)) return "#ecebea";
  return "#d8c27a";
}

function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, k);
  return `#${c.getHexString()}`;
}

function patternSize(pw: number, ph: number, max = 512) {
  const s = max / Math.max(pw, ph);
  return { w: Math.max(16, Math.round(pw * s)), h: Math.max(16, Math.round(ph * s)) };
}

function makeTex(ctx: TexCtx, key: string, pw: number, ph: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const hit = ctx.cache.get(key);
  if (hit) return hit;
  const { w, h } = patternSize(pw, ph);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.repeat.set(1 / pw, 1 / ph);
  ctx.cache.set(key, t);
  return t;
}

/** Carrelage : 2×2 carreaux avec leurs joints à l'échelle réelle ; la photo du produit est utilisée si elle existe. */
function tileTexture(ctx: TexCtx, t: ResolvedTile, jointMm: number, color: string): THREE.Texture {
  const j = Math.max(0.001, jointMm / 1000);
  const pw = (t.tileL + j) * 2;
  const ph = (t.tileW + j) * 2;
  const key = `tile|${t.tileL}|${t.tileW}|${j}|${color}|${t.photo ? t.photo.length + t.photo.slice(-24) : ""}`;
  const hit = ctx.cache.get(key);
  if (hit) return hit;
  const { w, h } = patternSize(pw, ph, 768);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const jx = Math.max(2, (j / pw) * w);
  const jy = Math.max(2, (j / ph) * h);
  const cw = w / 2;
  const ch = h / 2;
  const paint = (img?: HTMLImageElement) => {
    g.fillStyle = "#8e8d89";
    g.fillRect(0, 0, w, h);
    for (let a = 0; a < 2; a++)
      for (let b = 0; b < 2; b++) {
        const x = a * cw + jx / 2;
        const y = b * ch + jy / 2;
        const tw = cw - jx;
        const th = ch - jy;
        if (img) {
          g.save();
          g.beginPath();
          g.rect(x, y, tw, th);
          g.clip();
          g.drawImage(img, x, y, tw, th);
          g.restore();
        } else {
          g.fillStyle = shade(color, ((a * 2 + b) % 3 - 1) * 0.015);
          g.fillRect(x, y, tw, th);
          // légère veine pour casser l'aspect plat
          g.strokeStyle = "rgba(255,255,255,0.10)";
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(x + tw * 0.1, y + th * (0.25 + 0.2 * a));
          g.lineTo(x + tw * 0.9, y + th * (0.6 - 0.15 * b));
          g.stroke();
        }
      }
  };
  paint();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.repeat.set(1 / pw, 1 / ph);
  ctx.cache.set(key, tex);
  if (t.photo) {
    const img = new Image();
    img.onload = () => {
      paint(img);
      tex.needsUpdate = true;
      ctx.redraw();
    };
    img.src = t.photo;
  }
  return tex;
}

function sheetTexture(ctx: TexCtx, color: string, sheetW: number, sheetH: number) {
  return makeTex(ctx, `sheet|${color}|${sheetW}|${sheetH}`, sheetW, sheetH, (g, w, h) => {
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#8f8e88";
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, w - 3, h - 3);
    g.fillStyle = "rgba(90,90,85,0.55)";
    const step = (0.3 / sheetH) * h;
    for (let y = step / 2; y < h; y += step) {
      g.fillRect(w * 0.02, y, 2.5, 2.5);
      g.fillRect(w * 0.98 - 2.5, y, 2.5, 2.5);
    }
  });
}

function panelTexture(ctx: TexCtx, color: string, pw: number, ph: number) {
  return makeTex(ctx, `panel|${color}|${pw}|${ph}`, pw, ph, (g, w, h) => {
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(0,0,0,0.12)";
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (Math.random() - 0.5) * 24, y + (Math.random() - 0.5) * 6);
      g.stroke();
    }
    g.strokeStyle = shade(color, -0.25);
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, w - 3, h - 3);
  });
}

function parquetTexture(ctx: TexCtx) {
  return makeTex(ctx, "parquet", 2.4, 1.0, (g, w, h) => {
    const rows = 5;
    const rh = h / rows;
    const pl = w / 2;
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let r = 0; r < rows; r++) {
      const off = (r * 0.37 * pl) % pl;
      for (let k = -1; k < 3; k++) {
        const x = k * pl + off;
        g.fillStyle = shade("#c9a77a", (rnd() - 0.5) * 0.08);
        g.fillRect(x, r * rh, pl, rh);
        g.strokeStyle = "rgba(70,45,20,0.35)";
        g.lineWidth = 2;
        g.strokeRect(x, r * rh, pl, rh);
        g.strokeStyle = "rgba(60,35,15,0.12)";
        g.lineWidth = 1;
        for (let n = 0; n < 4; n++) {
          const yy = r * rh + rh * (0.2 + rnd() * 0.6);
          g.beginPath();
          g.moveTo(x + 4, yy);
          g.lineTo(x + pl - 4, yy + (rnd() - 0.5) * 3);
          g.stroke();
        }
      }
    }
  });
}

function wallShape(len: number, h: number, holes: { x0: number; x1: number; y0: number; y1: number }[]) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(len, 0);
  s.lineTo(len, h);
  s.lineTo(0, h);
  s.lineTo(0, 0);
  for (const o of holes) {
    const p = new THREE.Path();
    p.moveTo(o.x0, o.y0);
    p.lineTo(o.x0, o.y1);
    p.lineTo(o.x1, o.y1);
    p.lineTo(o.x1, o.y0);
    p.lineTo(o.x0, o.y0);
    s.holes.push(p);
  }
  return s;
}

export function buildScene(project: Project, opts: Scene3DOptions, tex: TexCtx): Built {
  const S = project.settings;
  const L = opts.layers;
  const root = new THREE.Group();
  const pickables: THREE.Object3D[] = [];
  const legend: LegendItem[] = [];
  const notes: string[] = [];
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(x: T): T => {
    disposables.push(x);
    return x;
  };
  const addLegend = (color: string, label: string) => {
    if (!legend.some((l) => l.label === label)) legend.push({ color, label });
  };
  const lam = (color: string, extra: Partial<THREE.MeshLambertMaterialParameters> = {}) =>
    track(new THREE.MeshLambertMaterial({ color, ...extra }));
  const lamMap = (map: THREE.Texture, extra: Partial<THREE.MeshLambertMaterialParameters> = {}) =>
    track(new THREE.MeshLambertMaterial({ map, ...extra }));
  const box = (w: number, h: number, d: number, color: string) => {
    const m = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), lam(color));
    return m;
  };

  const elev = floorElevations(project.floors, S.elec.slabM ?? 0.3);
  const floors = project.floors.filter((f) => opts.floorId === "all" || f.id === opts.floorId);
  const wallsByRoom = new Map<string, Wall[]>();
  const placements = new Map<string, { roomId: string; edge: number; t: number }>();

  const tube = (pts: THREE.Vector3[], r: number, color: string) => {
    const geos: THREE.BufferGeometry[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const len = a.distanceTo(b);
      if (len < 1e-4) continue;
      const g = new THREE.CylinderGeometry(r, r, len, 6, 1, false);
      const q = new THREE.Quaternion().setFromUnitVectors(up, b.clone().sub(a).normalize());
      g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
      geos.push(g);
    }
    if (!geos.length) return null;
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) return null;
    return new THREE.Mesh(track(merged), lam(color));
  };

  // ───────────── Parois, sols, plafonds ─────────────
  for (const floor of floors) {
    const sc = floor.planScale || 40;
    const z0 = elev.get(floor.id) ?? 0;
    for (const room of floor.rooms) {
      const pts = pointsForRoom(room, sc).map((p) => ({ x: p.x / sc, y: p.y / sc }));
      if (pts.length < 3) continue;
      const area2 = pts.reduce((s, p, i) => {
        const q = pts[(i + 1) % pts.length];
        return s + p.x * q.y - q.x * p.y;
      }, 0);
      const swapped = area2 < 0;
      const edges = roomEdges(room, sc);
      const h = room.height || floor.height || 2.5;
      const walls: Wall[] = [];

      pts.forEach((p0, i) => {
        const q0 = pts[(i + 1) % pts.length];
        const a = swapped ? q0 : p0;
        const b = swapped ? p0 : q0;
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len < 0.05) return;
        const d = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
        const g = new THREE.Group();
        const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(d.x, 0, d.y), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-d.y, 0, d.x));
        m.setPosition(a.x, z0, a.y);
        g.matrixAutoUpdate = false;
        g.matrix.copy(m);
        const info = edges[i];
        const w: Wall = {
          room,
          floor,
          idx: i,
          len,
          swapped,
          exterior: !!info?.exterior,
          passage: !!info?.passage,
          placoType: info?.placoType ?? room.placoType,
          elev: z0,
          h,
          group: g,
          placed: [],
        };
        walls[i] = w;
        root.add(g);
      });
      const wl = walls.filter(Boolean);
      wallsByRoom.set(room.id, wl);

      // Placement des ouvertures : position saisie à la main, sinon répartition automatique.
      const rr: Record<string, number> = {};
      const autos = new Map<Wall, Opening[]>();
      for (const o of room.openings) {
        if (o.wall === "plafond" || o.type === "trappe") continue;
        const sill = o.sill ?? (o.type === "fenetre" ? (o.height >= 1 ? 0.9 : 1.3) : 0);
        const manual = o.edge != null ? walls[o.edge] : undefined;
        if (manual && o.t != null) {
          const t = manual.swapped ? 1 - o.t : o.t;
          manual.placed.push({ o, center: t * manual.len, width: o.width, sill, height: o.height });
          placements.set(o.id, { roomId: room.id, edge: manual.idx, t: o.t });
          continue;
        }
        let cand = wl.filter((w) => (o.wall === "exterieur" ? w.exterior && !w.passage : !w.exterior));
        if (!cand.length) cand = wl;
        cand = cand.slice().sort((a, b) => b.len - a.len);
        const k = rr[o.wall] ?? 0;
        rr[o.wall] = k + 1;
        const w = cand[k % cand.length];
        autos.set(w, [...(autos.get(w) ?? []), o]);
      }
      for (const [w, list] of autos)
        list.forEach((o, i) => {
          const sill = o.sill ?? (o.type === "fenetre" ? (o.height >= 1 ? 0.9 : 1.3) : 0);
          const c = Math.min(Math.max(((i + 1) / (list.length + 1)) * w.len, o.width / 2 + 0.05), w.len - o.width / 2 - 0.05);
          w.placed.push({ o, center: c, width: o.width, sill, height: o.height });
          const tt = c / w.len;
          placements.set(o.id, { roomId: room.id, edge: w.idx, t: w.swapped ? 1 - tt : tt });
        });

      // Matières des faces intérieures
      const paintW = resolvePaint(S, room, "mur");
      const tileW = resolveTile(S, room, "mur");
      const tileBand = L.has("carrelage") && room.tileWalls ? Math.min(h, Math.max(0.1, room.tileWallHeight)) : 0;
      for (const w of wl) {
        const holes = w.placed
          .map((p) => ({
            x0: Math.max(0.02, p.center - p.width / 2),
            x1: Math.min(w.len - 0.02, p.center + p.width / 2),
            y0: Math.max(0.002, p.sill),
            y1: Math.min(h - 0.03, p.sill + p.height),
          }))
          .filter((o) => o.x1 - o.x0 > 0.1 && o.y1 - o.y0 > 0.1);
        const geom = track(new THREE.ShapeGeometry(wallShape(w.len, h, holes)));

        let baseMat: THREE.MeshLambertMaterial;
        if (L.has("peinture") && room.paintWalls && !w.passage) {
          baseMat = lam(paintW.color ?? "#f3efe6");
          addLegend(paintW.color ?? "#f3efe6", `Peinture murs — ${paintW.name}`);
        } else if (L.has("placo") && room.placoWalls && !w.passage) {
          const sz = S.placo.plaqueSizes?.[w.placoType];
          const sl = sz?.l && sz.l > 0 ? sz.l : S.placo.plaqueL;
          const sw = sz?.w && sz.w > 0 ? sz.w : S.placo.plaqueW;
          const col = PLAQUE_COLOR[w.placoType] ?? PLAQUE_COLOR.ba13;
          baseMat = lamMap(sheetTexture(tex, col, sw, sl));
          addLegend(col, `${PLAQUE_LABEL[w.placoType] ?? "Plaque"} ${sl}×${sw} m (joints et vis visibles)`);
        } else if (L.has("isolation") && w.exterior && !w.passage) {
          const iso = (S.isolants?.length ? S.isolants : ISOLANTS).find((i) => i.id === S.isolation.isolantMurId) ?? ISOLANTS[0];
          const col = isolantColor(iso.name, iso.bio);
          baseMat = lamMap(panelTexture(tex, col, iso.panelL, iso.panelW));
          addLegend(col, `Isolant murs — ${iso.name} ${iso.thickness} mm (panneaux ${iso.panelL}×${iso.panelW} m)`);
        } else if (L.has("placo") && w.passage) {
          baseMat = lam("#d46a6a", { transparent: true, opacity: 0.18, depthWrite: false });
          addLegend("#d46a6a", "Passage : paroi sans plaque");
        } else {
          baseMat = lam(NEUTRAL_WALL);
        }

        const face = new THREE.Mesh(geom, baseMat);
        if (tileBand > 0) {
          baseMat.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -(w.elev + tileBand))];
          const tileMat = lamMap(tileTexture(tex, tileW, S.carrelage.jointMm, tileW.photo ? "#c9c5bc" : (resolveTileColor(S.carrelage.tiles, tileW))), {
            clippingPlanes: [new THREE.Plane(new THREE.Vector3(0, -1, 0), w.elev + tileBand)],
          });
          const band = new THREE.Mesh(geom, tileMat);
          w.group.add(band);
          addLegend(resolveTileColor(S.carrelage.tiles, tileW), `Faïence — ${withDims(tileW.name, tileW.tileL, tileW.tileW)}, jusqu'à ${tileBand.toFixed(2)} m`);
        }
        face.userData = { kind: "wall", roomId: room.id, floorId: floor.id, edge: w.idx, ax: pts[w.idx].x, ay: pts[w.idx].y, bx: pts[(w.idx + 1) % pts.length].x, by: pts[(w.idx + 1) % pts.length].y } satisfies WallPick;
        w.group.add(face);
        pickables.push(face);

        // arête haute
        const top = new THREE.Line(
          track(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, h, 0), new THREE.Vector3(w.len, h, 0)])),
          track(new THREE.LineBasicMaterial({ color: "#6b6a64" })),
        );
        w.group.add(top);

        // ossature derrière les plaques
        if (opts.ossature && L.has("placo") && room.placoWalls && !w.passage) {
          const sp = S.placo.montantSpacing || 0.6;
          const pos: number[] = [];
          for (let u = 0; u <= w.len + 1e-6; u += sp) pos.push(u, 0, 0.006, u, h, 0.006);
          pos.push(0, 0.03, 0.006, w.len, 0.03, 0.006, 0, h - 0.03, 0.006, w.len, h - 0.03, 0.006);
          const lg = track(new THREE.BufferGeometry());
          lg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
          w.group.add(new THREE.LineSegments(lg, track(new THREE.LineBasicMaterial({ color: "#4b5563" }))));
          addLegend("#4b5563", `Ossature : rails + montants tous les ${Math.round(sp * 100)} cm`);
        }

        // menuiseries (fenêtres, portes) : cadres + vitrage
        for (const p of w.placed) {
          const y0 = Math.max(0.002, p.sill);
          const y1 = Math.min(h - 0.03, p.sill + p.height);
          const x0 = Math.max(0.02, p.center - p.width / 2);
          const x1 = Math.min(w.len - 0.02, p.center + p.width / 2);
          const ow = x1 - x0;
          const oh = y1 - y0;
          if (ow < 0.1 || oh < 0.1) continue;
          const selected = opts.selectedOpening === p.o.id;
          const isDoor = p.o.type === "porte";
          const interior = isDoor && p.o.wall !== "exterieur";
          if (interior && !L.has("quincaillerie")) {
            if (selected) {
              const hl = box(ow, oh, 0.01, "#f97316");
              hl.position.set(x0 + ow / 2, y0 + oh / 2, 0.012);
              w.group.add(hl);
            }
            continue;
          }
          const fc = selected ? "#f97316" : isDoor ? (interior ? "#e8e4da" : "#5d4a3a") : "#f4f4f2";
          const ft = 0.05;
          const parts: [number, number, number, number][] = [
            [ow, ft, x0 + ow / 2, y0 + ft / 2],
            [ow, ft, x0 + ow / 2, y1 - ft / 2],
            [ft, oh, x0 + ft / 2, y0 + oh / 2],
            [ft, oh, x1 - ft / 2, y0 + oh / 2],
          ];
          for (const [bw, bh, cx, cy] of parts) {
            const f = box(bw, bh, 0.07, fc);
            f.position.set(cx, cy, 0.025);
            w.group.add(f);
          }
          if (isDoor) {
            const leaf = box(ow - 0.1, oh - 0.06, 0.04, interior ? "#f1efe9" : "#6e5846");
            leaf.position.set(x0 + ow / 2, y0 + oh / 2 - 0.01, 0.03);
            w.group.add(leaf);
            const hd = box(0.12, 0.02, 0.05, "#9aa0a6");
            hd.position.set(x1 - 0.12, y0 + 1.0, 0.07);
            w.group.add(hd);
            if (interior) addLegend("#f1efe9", "Portes intérieures + huisseries");
          } else {
            const glass = new THREE.Mesh(
              track(new THREE.PlaneGeometry(ow - 0.1, oh - 0.1)),
              lam("#a9d3ee", { transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false }),
            );
            glass.position.set(x0 + ow / 2, y0 + oh / 2, 0.02);
            w.group.add(glass);
          }
        }
      }

      // Sol
      const floorShape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.y)));
      const fGeom = track(new THREE.ShapeGeometry(floorShape));
      fGeom.rotateX(-Math.PI / 2);
      let fMat: THREE.MeshLambertMaterial | null = null;
      let layoutDrawn = false;
      const layout = project.tileLayouts?.[room.id];
      const floorTile = resolveTile(S, room, "sol");
      if (!opts.xray && L.has("carrelage") && room.tileFloor) {
        const col = resolveTileColor(S.carrelage.tiles, floorTile);
        const lt = layout && layout.points.length >= 3 ? (S.carrelage.tiles ?? []).find((t) => t.id === layout.tileId) : undefined;
        if (layout && lt) {
          layoutDrawn = true;
          const grout = new THREE.Mesh(fGeom, lam("#8e8d89"));
          grout.position.y = z0 + 0.001;
          root.add(grout);
          const st = computeLayout(layout.points, lt, layout, true);
          const groups: Record<"full" | "cut" | "sliver", THREE.BufferGeometry[]> = { full: [], cut: [], sliver: [] };
          for (const c of st.cells) {
            if (c.poly.length < 3) continue;
            const g = new THREE.ShapeGeometry(new THREE.Shape(c.poly.map((p) => new THREE.Vector2(p.x, -p.y))));
            g.rotateX(-Math.PI / 2);
            groups[c.sliver ? "sliver" : c.full ? "full" : "cut"].push(g);
          }
          const lcol = lt.color ?? guessTileColor(lt.name);
          (["full", "cut", "sliver"] as const).forEach((k, n) => {
            if (!groups[k].length) return;
            const mg = mergeGeometries(groups[k], false);
            groups[k].forEach((g) => g.dispose());
            if (!mg) return;
            const color = !opts.cuts || k === "full" ? lcol : k === "cut" ? "#f0a35c" : "#e05c5c";
            const mesh = new THREE.Mesh(track(mg), lam(color));
            mesh.position.y = z0 + 0.004 + n * 0.0002;
            root.add(mesh);
          });
          addLegend(lcol, `Carrelage sol — ${withDims(lt.name, lt.tileL, lt.tileW)} (calepinage : ${st.total} carreaux, perte ${st.wastePct.toFixed(1)} %)`);
          if (opts.cuts) {
            addLegend("#f0a35c", "Carreaux coupés");
            addLegend("#e05c5c", "Chutes trop étroites");
          }
        } else {
          fMat = lamMap(tileTexture(tex, floorTile, S.carrelage.jointMm, col));
          addLegend(col, `Carrelage sol — ${withDims(floorTile.name, floorTile.tileL, floorTile.tileW)}, joint ${S.carrelage.jointMm} mm`);
        }
      } else if (!opts.xray && L.has("quincaillerie") && room.solType === "parquet" && !room.tileFloor) {
        fMat = lamMap(parquetTexture(tex));
        addLegend("#c9a77a", "Parquet");
      } else if (!opts.xray && L.has("peinture") && room.paintFloor) {
        fMat = lam("#7b8794");
        addLegend("#7b8794", "Peinture de sol");
      } else if (L.has("isolation") && room.floorHeating) {
        const iso = (S.isolants?.length ? S.isolants : ISOLANTS).find((i) => i.id === S.isolation.isolantSolId) ?? ISOLANTS[0];
        const col = isolantColor(iso.name, iso.bio);
        fMat = lamMap(panelTexture(tex, col, iso.panelL, iso.panelW));
        addLegend(col, `Isolant sous plancher chauffant — ${iso.name} ${iso.thickness} mm`);
      } else {
        fMat = lam(NEUTRAL_FLOOR, opts.xray ? { transparent: true, opacity: 0.55 } : {});
      }
      if (fMat && !layoutDrawn) {
        const fm = new THREE.Mesh(fGeom, fMat);
        fm.position.y = z0 + 0.002;
        root.add(fm);
      }

      // Plafond
      if (opts.ceilings) {
        const cShape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, p.y)));
        const cGeom = track(new THREE.ShapeGeometry(cShape));
        cGeom.rotateX(Math.PI / 2);
        let cMat: THREE.MeshLambertMaterial;
        if (L.has("peinture") && room.paintCeiling) {
          const pc = resolvePaint(S, room, "plafond");
          cMat = lam(pc.color ?? "#fbfaf6");
          addLegend(pc.color ?? "#fbfaf6", `Peinture plafond — ${pc.name}`);
        } else if (L.has("placo") && room.placoCeiling) {
          const type = room.placoType === "hydro" ? "hydro" : "ba13";
          const sz = S.placo.plaqueSizes?.[type];
          const sl = sz?.l && sz.l > 0 ? sz.l : S.placo.plaqueL;
          const sw = sz?.w && sz.w > 0 ? sz.w : S.placo.plaqueW;
          cMat = lamMap(sheetTexture(tex, PLAQUE_COLOR[type], sl, sw));
          addLegend(PLAQUE_COLOR[type], `Plafond placo — plaques ${sl}×${sw} m`);
        } else cMat = lam("#f2f0ea");
        const cm = new THREE.Mesh(cGeom, cMat);
        cm.position.y = z0 + h - 0.001;
        root.add(cm);
      }
    }
  }

  const wallsOf = (room: Room) => (wallsByRoom.get(room.id) ?? []).filter((w) => !w.passage && w.len > 0.4);

  /** Place un objet sur le périmètre d'une pièce, à la hauteur z, en évitant les ouvertures. */
  const onWalls = (room: Room, count: number, z: number, make: () => THREE.Object3D, startFrac = 0) => {
    const ws = wallsOf(room);
    const total = ws.reduce((s, w) => s + w.len, 0);
    if (!ws.length || count <= 0) return;
    for (let i = 0; i < count; i++) {
      let s = ((i + 0.5) / count + startFrac) * total;
      s = ((s % total) + total) % total;
      let acc = 0;
      for (const w of ws) {
        if (s <= acc + w.len || w === ws[ws.length - 1]) {
          let u = Math.min(Math.max(s - acc, 0.15), w.len - 0.15);
          for (const p of w.placed) {
            const x0 = p.center - p.width / 2 - 0.12;
            const x1 = p.center + p.width / 2 + 0.12;
            if (z < p.sill + p.height && u > x0 && u < x1) u = u - x0 < x1 - u ? Math.max(0.1, x0) : Math.min(w.len - 0.1, x1);
          }
          const o = make();
          o.position.set(u, z, 0.012);
          w.group.add(o);
          break;
        }
        acc += w.len;
      }
    }
  };

  const ceilingPoints = (room: Room, floor: Floor, n: number) => {
    const sc = floor.planScale || 40;
    const pts = pointsForRoom(room, sc).map((p) => ({ x: p.x / sc, y: p.y / sc }));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const cand: { x: number; y: number }[] = [];
    for (let x = Math.min(...xs) + 0.4; x < Math.max(...xs); x += 0.5)
      for (let y = Math.min(...ys) + 0.4; y < Math.max(...ys); y += 0.5) if (inPoly({ x, y }, pts)) cand.push({ x, y });
    if (!cand.length) return [{ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }];
    if (n >= cand.length) return cand;
    return Array.from({ length: n }, (_, i) => cand[Math.floor(((i + 0.5) * cand.length) / n)]);
  };

  // ───────────── Électricité ─────────────
  if (L.has("electricite")) {
    const devColor = (k: ElecDevice["kind"]) => kindInfo(k).color;
    for (const floor of floors) {
      const sc = floor.planScale || 40;
      const z0 = elev.get(floor.id) ?? 0;
      const placed = floor.elecDevices ?? [];
      if (placed.length) {
        for (const d of placed) {
          const ceil = kindInfo(d.kind).z === "plafond";
          const m = ceil
            ? new THREE.Mesh(track(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 14)), lam(devColor(d.kind)))
            : box(d.kind === "tableau" ? 0.4 : d.kind === "derivation" ? 0.12 : 0.09, d.kind === "tableau" ? 0.6 : 0.09, d.kind === "tableau" ? 0.15 : 0.04, devColor(d.kind));
          m.position.set(d.x / sc, z0 + d.z, d.y / sc);
          root.add(m);
        }
        addLegend("#1d4ed8", "Appareillage posé sur le plan électrique");
        continue;
      }
      let first = true;
      for (const room of floor.rooms) {
        const d = defaultElec(room);
        const dev = (color: string, w = 0.12, hh = 0.12) => () => box(w, hh, 0.025, color);
        const prisesBox = d.prisesSimples + d.prisesDoubles + d.prisesTriples;
        onWalls(room, d.prisesSimples, 0.3, dev("#1d4ed8"));
        onWalls(room, d.prisesDoubles, 0.3, dev("#1d4ed8", 0.16), 0.03);
        onWalls(room, d.prisesTriples, 0.3, dev("#1d4ed8", 0.23), 0.06);
        const doors = (wallsByRoom.get(room.id) ?? []).flatMap((w) => w.placed.filter((p) => p.o.type === "porte").map((p) => ({ w, p })));
        const nInter = d.intersSimples + d.intersDoubles + d.vaEtVient + d.poussoirs;
        if (doors.length) {
          for (let i = 0; i < nInter; i++) {
            const { w, p } = doors[i % doors.length];
            const m = box(0.09, 0.09, 0.025, "#b45309");
            m.position.set(Math.min(w.len - 0.1, p.center + p.width / 2 + 0.14 + Math.floor(i / doors.length) * 0.1), 1.1, 0.012);
            w.group.add(m);
          }
        } else onWalls(room, nInter, 1.1, dev("#b45309"), 0.1);
        onWalls(room, d.rj45, 0.3, dev("#0f766e"), 0.15);
        onWalls(room, d.tv, 0.3, dev("#0e7490"), 0.2);
        onWalls(room, d.hdmi, 0.3, dev("#7c3aed"), 0.25);
        onWalls(room, d.boitesDerivation, 2.3, dev("#7c3aed", 0.12, 0.12), 0.35);
        onWalls(room, d.specialised.length, 0.3, dev("#be123c", 0.1, 0.1), 0.45);
        const lights = ceilingPoints(room, floor, d.dcl + d.spots);
        lights.slice(0, d.dcl + d.spots).forEach((p, i) => {
          const isSpot = i >= d.dcl;
          const m = new THREE.Mesh(track(new THREE.CylinderGeometry(isSpot ? 0.045 : 0.08, isSpot ? 0.045 : 0.08, 0.025, 14)), lam("#ca8a04"));
          m.position.set(p.x, z0 + room.height - 0.015, p.y);
          root.add(m);
        });
        if (first) {
          const ws = wallsOf(room);
          if (ws.length) {
            const t = box(0.4, 0.6, 0.15, "#111827");
            t.position.set(Math.min(ws[0].len - 0.3, 0.5), 1.6, 0.08);
            ws[0].group.add(t);
          }
          first = false;
        }
        void prisesBox;
      }
    }
    addLegend("#1d4ed8", "Prises 16 A (doubles et triples plus larges)");
    addLegend("#b45309", "Interrupteurs, va-et-vient, poussoirs (près des portes)");
    addLegend("#ca8a04", "Points lumineux et spots au plafond");
    addLegend("#0f766e", "Réseau RJ45, TV, HDMI");
    addLegend("#7c3aed", "Boîtes de dérivation");
    addLegend("#111827", "Tableau électrique");
    // trajets de câbles du plan électrique
    const devById = new Map<string, { d: ElecDevice; floor: Floor }>();
    for (const f of project.floors) for (const d of f.elecDevices ?? []) devById.set(d.id, { d, floor: f });
    for (const run of project.elecRuns ?? []) {
      const pts: THREE.Vector3[] = [];
      let prev: THREE.Vector3 | null = null;
      for (const p of run.points) {
        const ref = p.deviceId ? devById.get(p.deviceId) : undefined;
        const f = ref ? ref.floor : project.floors.find((x) => x.id === p.floorId);
        if (!f || (opts.floorId !== "all" && f.id !== opts.floorId)) continue;
        const sc = f.planScale || 40;
        const zz = (elev.get(f.id) ?? 0) + (ref ? ref.d.z : run.routeMode === "plafond" ? f.height - 0.15 : run.routeMode === "sol" ? 0.1 : run.routeZ);
        const v = new THREE.Vector3((ref ? ref.d.x : p.x) / sc, zz, (ref ? ref.d.y : p.y) / sc);
        if (prev && run.ortho) {
          pts.push(new THREE.Vector3(v.x, prev.y, prev.z));
          pts.push(new THREE.Vector3(v.x, prev.y, v.z));
        }
        pts.push(v);
        prev = v;
      }
      const m = tube(pts, 0.012, RUN_TYPES[run.type].color);
      if (m) root.add(m);
    }
    if ((project.elecRuns ?? []).length) addLegend("#1d4ed8", "Câbles tracés sur le plan électrique");
    if (!floors.some((f) => (f.elecDevices ?? []).length)) notes.push("Aucun appareillage posé sur le plan électrique : les appareils comptés sont répartis automatiquement dans chaque pièce.");
    void DEVICE_KINDS;
  }

  // ───────────── Sanitaire ─────────────
  if (L.has("sanitaire")) {
    for (const floor of floors) {
      for (const room of floor.rooms) {
        const ws = wallsOf(room).slice().sort((a, b) => b.len - a.len);
        if (!ws.length) continue;
        const items: { w: number; d: number; h: number; color: string; label: string; elevY?: number; glass?: boolean }[] = [];
        if (room.type === "cuisine") items.push({ w: 1.2, d: 0.6, h: 0.9, color: "#b8bec4", label: "Évier" });
        if (room.type === "sdb" || room.type === "sde") {
          items.push({ w: 0.9, d: 0.9, h: 0.06, color: "#f5f5f3", label: "Receveur de douche" });
          items.push({ w: 0.9, d: 0.9, h: 2.0, color: "#aedaf2", label: "Paroi de douche", glass: true });
          items.push({ w: 0.8, d: 0.5, h: 0.85, color: "#b99872", label: "Meuble vasque" });
          items.push({ w: 0.5, d: 0.08, h: 1.2, color: "#e5e7eb", label: "Sèche-serviettes" });
        }
        if (room.type === "wc") {
          items.push({ w: 0.36, d: 0.55, h: 0.4, color: "#fafafa", label: "WC suspendu", elevY: 0.0 });
          items.push({ w: 0.36, d: 0.15, h: 1.1, color: "#9ca3af", label: "Bâti-support WC" });
          items.push({ w: 0.3, d: 0.2, h: 0.2, color: "#fafafa", label: "Lave-mains", elevY: 0.9 });
        }
        if (room.type === "buanderie") items.push({ w: 0.6, d: 0.6, h: 0.85, color: "#f3f4f6", label: "Lave-linge" });
        const cursor = new Map<Wall, number>();
        let skipGlass = 0;
        for (const it of items) {
          let wall = ws.find((w) => (cursor.get(w) ?? 0.12) + it.w <= w.len - 0.1);
          if (!wall) wall = ws[0];
          let u = cursor.get(wall) ?? 0.12;
          for (const p of wall.placed) {
            const x0 = p.center - p.width / 2 - 0.05;
            const x1 = p.center + p.width / 2 + 0.05;
            if (it.elevY == null && u < x1 && u + it.w > x0 && p.sill < it.h) u = x1;
          }
          if (it.glass) {
            // la paroi se place sur le receveur déjà posé
            const m = box(it.w, it.h, it.d, it.color);
            (m.material as THREE.MeshLambertMaterial).transparent = true;
            (m.material as THREE.MeshLambertMaterial).opacity = 0.22;
            m.position.set((cursor.get(wall) ?? 0.12) - it.w / 2 - 0.05 + it.w / 2 - 0.0, it.h / 2, it.d / 2);
            m.position.x = Math.max(it.w / 2, (cursor.get(wall) ?? 0.12) - 0.05 - it.w / 2);
            wall.group.add(m);
            skipGlass++;
            continue;
          }
          const m = box(it.w, it.h, it.d, it.color);
          m.position.set(u + it.w / 2, (it.elevY ?? 0) + it.h / 2, it.d / 2 + 0.01);
          wall.group.add(m);
          addLegend(it.color, it.label);
          // arrivées d'eau froide (bleu) et chaude (rouge)
          if (it.label !== "Receveur de douche" && it.label !== "Sèche-serviettes") {
            for (const [dx, col] of [[-0.05, "#2563eb"], [0.05, "#dc2626"]] as const) {
              const t = tube([new THREE.Vector3(u + it.w / 2 + dx, 0, 0.03), new THREE.Vector3(u + it.w / 2 + dx, 0.6, 0.03)], 0.011, col);
              if (t) wall.group.add(t);
            }
          }
          cursor.set(wall, u + it.w + 0.05);
        }
        void skipGlass;
      }
    }
    addLegend("#2563eb", "Arrivées d'eau froide");
    addLegend("#dc2626", "Arrivées d'eau chaude");
    notes.push("Les appareils sont placés automatiquement le long des murs de chaque pièce : leur position exacte reste à définir sur le chantier.");
  }

  // ───────────── VMC ─────────────
  if (L.has("vmc")) {
    const hasPlan = project.floors.some((f) => (f.vmcDevices ?? []).length > 0);
    if (hasPlan) {
      const an = analyzeVmc(project);
      const COL = { ok: "#16a34a", warn: "#d97706", error: "#dc2626" };
      for (const floor of floors) {
        const sc = floor.planScale || 40;
        const z0 = (elev.get(floor.id) ?? 0) + floor.height - 0.2;
        for (const d of floor.vmcDevices ?? []) {
          let m: THREE.Mesh;
          if (d.kind === "caisson") m = box(0.6, 0.4, 0.4, "#1e293b");
          else if (d.kind === "te") m = box(0.12, 0.12, 0.12, "#e5e7eb");
          else m = new THREE.Mesh(track(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 16)), lam(d.kind === "extraction" ? "#ef4444" : "#3b82f6"));
          m.position.set(d.x / sc, z0, d.y / sc);
          root.add(m);
        }
      }
      for (const run of (project.vmcPlan?.runs ?? [])) {
        const info = an.runs[run.id];
        if (!info) continue;
        const pts = info.path
          .map((p) => {
            const f = project.floors.find((x) => x.id === p.floorId);
            if (!f) return null;
            if (opts.floorId !== "all" && f.id !== opts.floorId) return null;
            const sc = f.planScale || 40;
            return new THREE.Vector3(p.x / sc, (elev.get(f.id) ?? 0) + f.height - 0.2, p.y / sc);
          })
          .filter((p): p is THREE.Vector3 => !!p);
        const m = tube(pts, run.diameter / 2000, COL[info.status]);
        if (m) root.add(m);
      }
      addLegend("#1e293b", "Caisson VMC");
      addLegend("#ef4444", "Bouches d'extraction");
      addLegend("#3b82f6", "Bouches d'insufflation (double flux)");
      addLegend("#16a34a", "Gaines conformes (orange = limite, rouge = hors limite)");
    } else {
      const dbl = S.vmc.type === "double_flux";
      for (const floor of floors) {
        const z0 = elev.get(floor.id) ?? 0;
        for (const room of floor.rooms) {
          const wet = ["sdb", "sde", "wc", "cuisine", "buanderie"].includes(room.type);
          const dry = ["salon", "sejour", "chambre", "bureau", "salle_manger"].includes(room.type);
          if (!wet && !(dbl && dry)) continue;
          const p = ceilingPoints(room, floor, 1)[0];
          const m = new THREE.Mesh(track(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 16)), lam(wet ? "#ef4444" : "#3b82f6"));
          m.position.set(p.x, z0 + room.height - 0.02, p.y);
          root.add(m);
        }
      }
      addLegend("#ef4444", "Bouches d'extraction (pièces humides)");
      if (dbl) addLegend("#3b82f6", "Bouches d'insufflation (pièces sèches)");
      notes.push("Aucune gaine tracée dans « Plan des gaines VMC » : seules les bouches comptées sont montrées (une par pièce).");
    }
  }

  // ───────────── Chauffage : tubes de plancher chauffant ─────────────
  if (L.has("chauffage")) {
    const pas = Math.max(0.05, (S.chauffage.pasMm || 150) / 1000);
    for (const floor of floors) {
      const sc = floor.planScale || 40;
      const z0 = (elev.get(floor.id) ?? 0) + 0.012;
      for (const room of floor.rooms) {
        if (!room.floorHeating) continue;
        const covered =
          !opts.xray &&
          ((L.has("carrelage") && room.tileFloor) || (L.has("quincaillerie") && room.solType === "parquet" && !room.tileFloor) || (L.has("peinture") && room.paintFloor));
        if (covered) continue;
        const pts = pointsForRoom(room, sc).map((p) => ({ x: p.x / sc, y: p.y / sc }));
        const ys = pts.map((p) => p.y);
        const path: THREE.Vector3[] = [];
        let dir = 1;
        for (let y = Math.min(...ys) + pas / 2 + 0.1; y < Math.max(...ys) - 0.1; y += pas) {
          const xs: number[] = [];
          pts.forEach((p, i) => {
            const q = pts[(i + 1) % pts.length];
            if (p.y > y !== q.y > y) xs.push(p.x + ((y - p.y) / (q.y - p.y)) * (q.x - p.x));
          });
          if (xs.length < 2) continue;
          xs.sort((a, b) => a - b);
          const x0 = xs[0] + 0.1;
          const x1 = xs[xs.length - 1] - 0.1;
          if (x1 <= x0) continue;
          if (dir > 0) path.push(new THREE.Vector3(x0, z0, y), new THREE.Vector3(x1, z0, y));
          else path.push(new THREE.Vector3(x1, z0, y), new THREE.Vector3(x0, z0, y));
          dir = -dir;
        }
        const m = tube(path, (S.chauffage.tubeDiameter || 16) / 2000, "#ef4444");
        if (m) root.add(m);
      }
    }
    addLegend("#ef4444", `Tube plancher chauffant Ø${S.chauffage.tubeDiameter} — pas ${S.chauffage.pasMm} mm`);
    if (!opts.xray && (L.has("carrelage") || L.has("quincaillerie"))) notes.push("Coche « Sous le sol » pour voir les tubes sous le carrelage ou le parquet.");
  }

  // ───────────── Quincaillerie : plinthes ─────────────
  if (L.has("quincaillerie")) {
    for (const floor of floors)
      for (const room of floor.rooms) {
        if (room.tileFloor) continue;
        const hP = (S.quincaillerie.plintheH || 80) / 1000;
        for (const w of wallsByRoom.get(room.id) ?? []) {
          if (w.passage) continue;
          const doors = w.placed.filter((p) => p.o.type === "porte").sort((a, b) => a.center - b.center);
          let cur = 0;
          const segs: [number, number][] = [];
          for (const d of doors) {
            segs.push([cur, d.center - d.width / 2]);
            cur = d.center + d.width / 2;
          }
          segs.push([cur, w.len]);
          for (const [a, b] of segs) {
            if (b - a < 0.05) continue;
            const m = box(b - a, hP, 0.012, "#f7f6f2");
            m.position.set((a + b) / 2, hP / 2, 0.006);
            w.group.add(m);
          }
        }
      }
    addLegend("#f7f6f2", `Plinthes H ${S.quincaillerie.plintheH} mm`);
  }

  if (L.has("isolation")) notes.push("Les cloisons isolées sont comptées dans le chiffrage mais pas positionnées : seuls les murs extérieurs et le sol sont dessinés.");
  if (L.has("placo")) notes.push("Les cloisons n'ont pas de position dans les données : chaque pièce est dessinée avec ses propres parois (une cloison entre deux pièces apparaît donc de chaque côté).");

  const bbox = new THREE.Box3().setFromObject(root);
  const dispose = () => {
    disposables.forEach((d) => d.dispose());
  };
  return { root, pickables, box: bbox, legend, notes, placements, dispose };
}

function resolveTileColor(catalog: Project["settings"]["carrelage"]["tiles"], t: ResolvedTile): string {
  const p = (catalog ?? []).find((x) => x.id === t.id);
  return p?.color ?? guessTileColor(t.name);
}
