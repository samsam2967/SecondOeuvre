import type { Floor, Project, Pt, Room } from "../types";
import { syncFromPoints, vertexAngle } from "./geometry";

/** Une cloison commune : deux pièces se touchent le long d'une paroi. */
export interface SharedWall {
  floorId: string;
  roomAId: string;
  edgeA: number;
  roomBId: string;
  edgeB: number;
  /** Longueur commune, en mètres. */
  lengthM: number;
  /** Passage voulu : la paroi est déclarée « sans placo » d'un côté ou de l'autre. */
  passage: boolean;
  /** Tronçon commun, en pixels du plan. */
  p0: Pt;
  p1: Pt;
}

const roomPts = (r: Room): Pt[] => r.points;

/** Parois qui se touchent (colinéaires et se recouvrant) entre deux pièces d'un même étage. */
export function sharedWalls(floor: Floor): SharedWall[] {
  const sc = Math.max(1e-6, floor.planScale || 40);
  const out: SharedWall[] = [];
  const rooms = floor.rooms.filter((r) => r.points && r.points.length >= 3);
  for (let a = 0; a < rooms.length; a++)
    for (let b = a + 1; b < rooms.length; b++) {
      const A = rooms[a];
      const B = rooms[b];
      const pa = roomPts(A);
      const pb = roomPts(B);
      for (let i = 0; i < pa.length; i++) {
        const a0 = pa[i];
        const a1 = pa[(i + 1) % pa.length];
        const la = Math.hypot(a1.x - a0.x, a1.y - a0.y) / sc;
        if (la < 0.2) continue;
        const dx = (a1.x - a0.x) / sc / la;
        const dy = (a1.y - a0.y) / sc / la;
        for (let j = 0; j < pb.length; j++) {
          const b0 = pb[j];
          const b1 = pb[(j + 1) % pb.length];
          const d0 = Math.abs(((b0.x - a0.x) / sc) * dy - ((b0.y - a0.y) / sc) * dx);
          const d1 = Math.abs(((b1.x - a0.x) / sc) * dy - ((b1.y - a0.y) / sc) * dx);
          if (d0 > 0.12 || d1 > 0.12) continue;
          const t0 = ((b0.x - a0.x) / sc) * dx + ((b0.y - a0.y) / sc) * dy;
          const t1 = ((b1.x - a0.x) / sc) * dx + ((b1.y - a0.y) / sc) * dy;
          const overlap = Math.min(la, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1));
          if (overlap < 0.25) continue;
          const ts = Math.max(0, Math.min(t0, t1));
          const te = Math.min(la, Math.max(t0, t1));
          out.push({
            p0: { x: a0.x + dx * ts * sc, y: a0.y + dy * ts * sc },
            p1: { x: a0.x + dx * te * sc, y: a0.y + dy * te * sc },
            floorId: floor.id,
            roomAId: A.id,
            edgeA: i,
            roomBId: B.id,
            edgeB: j,
            lengthM: overlap,
            passage: A.wallTypes?.[String(i)] === "none" || B.wallTypes?.[String(j)] === "none",
          });
        }
      }
    }
  return out;
}

/** Longueur (m) de chaque paroi d'une pièce qui touche une pièce voisine. */
export function sharedOverlaps(floor: Floor, room: Room): Map<number, number> {
  const acc = new Map<number, number>();
  for (const w of sharedWalls(floor)) {
    if (w.roomAId === room.id) acc.set(w.edgeA, (acc.get(w.edgeA) ?? 0) + w.lengthM);
    if (w.roomBId === room.id) acc.set(w.edgeB, (acc.get(w.edgeB) ?? 0) + w.lengthM);
  }
  return acc;
}

/** Parois d'une pièce touchées par une pièce voisine sur presque toute leur longueur. */
export function sharedEdgeSet(floor: Floor, room: Room, overlaps = sharedOverlaps(floor, room)): Set<number> {
  const sc = Math.max(1e-6, floor.planScale || 40);
  const pts = room.points;
  const set = new Set<number>();
  for (const [i, len] of overlaps) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if (!a || !b) continue;
    const el = Math.hypot(b.x - a.x, b.y - a.y) / sc;
    if (len >= 0.85 * el) set.add(i);
  }
  return set;
}

/**
 * Deux pièces qui se touchent forment une cloison : les parois communes ne sont jamais des murs extérieurs.
 * Les parois non touchées par une autre pièce sont extérieures, sauf si l'utilisateur les a réglées à la main.
 */
export function withAdjacencyFloor(floor: Floor): Floor {
  if (floor.rooms.length < 2) return floor;
  let changed = false;
  const sc = Math.max(1e-6, floor.planScale || 40);
  const rooms = floor.rooms.map((r) => {
    if (!r.points || r.points.length < 3) return r;
    const overlaps = sharedOverlaps(floor, r);
    const shared = sharedEdgeSet(floor, r, overlaps);
    if (overlaps.size === 0) return r;
    const n = r.points.length;
    // réglage manuel (ou ancien réglage non automatique) : respecté, sauf pour les parois touchées par une voisine
    const manual = !!r.extLocked || ((r.exteriorEdges ?? []).length > 0 && !r.extAuto);
    let ext: number[];
    if (manual) ext = (r.exteriorEdges ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i < n && !shared.has(i));
    else ext = Array.from({ length: n }, (_, i) => i).filter((i) => !shared.has(i));
    // une paroi touchée sur une partie seulement ne compte en extérieur que pour la partie libre
    const len = ext.reduce((s, i) => {
      const a = r.points[i];
      const b = r.points[(i + 1) % n];
      if (!a || !b) return s;
      const l = Math.hypot(b.x - a.x, b.y - a.y) / sc;
      return s + Math.max(0, l - (overlaps.get(i) ?? 0));
    }, 0);
    const same = ext.length === (r.exteriorEdges ?? []).length && ext.every((i) => (r.exteriorEdges ?? []).includes(i));
    const nl = Math.round(len * 10) / 10;
    if (same && Math.abs(nl - r.exteriorWallLength) < 0.05) return r;
    changed = true;
    return { ...r, exteriorEdges: ext, exteriorWallLength: nl, extAuto: manual ? r.extAuto : true };
  });
  return changed ? { ...floor, rooms } : floor;
}

export function withAdjacency(project: Project): Project {
  let changed = false;
  const floors = project.floors.map((f) => {
    let nf = f;
    try {
      nf = withAdjacencyFloor(f);
    } catch {
      nf = f; // données de plan incohérentes : on ne touche à rien plutôt que de planter
    }
    if (nf !== f) changed = true;
    return nf;
  });
  return changed ? { ...project, floors } : project;
}

/** Insère un sommet dans une paroi en conservant les numéros de parois, les ouvertures et les éléments déjà placés. */
export function insertVertex(room: Room, edge: number, at: Pt, scale: number): Room {
  const pts = room.points;
  const a = pts[edge];
  const b = pts[(edge + 1) % pts.length];
  const lenPx = Math.hypot(b.x - a.x, b.y - a.y);
  const f = Math.min(0.999, Math.max(0.001, Math.hypot(at.x - a.x, at.y - a.y) / Math.max(1e-6, lenPx)));
  const next = [...pts.slice(0, edge + 1), at, ...pts.slice(edge + 1)];
  const shift = (i: number) => (i > edge ? i + 1 : i);
  const wallTypes: Record<string, string> = {};
  for (const [k, v] of Object.entries(room.wallTypes ?? {})) {
    const i = Number(k);
    wallTypes[String(shift(i))] = v as string;
    if (i === edge) wallTypes[String(edge + 1)] = v as string;
  }
  const lenM = lenPx / scale;
  const openings = room.openings.map((o) => {
    if (o.edge == null) return o;
    if (o.edge !== edge) return { ...o, edge: shift(o.edge) };
    const t = o.t ?? 0.5;
    return t <= f ? { ...o, t: t / f } : { ...o, edge: edge + 1, t: (t - f) / (1 - f) };
  });
  const fixtures = room.fixtures?.map((x) => {
    if (x.edge !== edge) return { ...x, edge: shift(x.edge) };
    return x.u <= f * lenM ? x : { ...x, edge: edge + 1, u: x.u - f * lenM };
  });
  const exteriorEdges = (room.exteriorEdges ?? []).flatMap((i) => (i === edge ? [edge, edge + 1] : [shift(i)]));
  const r2: Room = { ...room, wallTypes: wallTypes as Room["wallTypes"], openings, exteriorEdges };
  if (fixtures) r2.fixtures = fixtures;
  return syncFromPoints(r2, next, scale);
}

/**
 * Quand un coin d'une pièce tombe au milieu de la paroi d'une pièce voisine, ce coin est ajouté à la voisine :
 * les deux pièces ont alors exactement les mêmes extrémités de mur (plus de décalage, cloison comptée une seule fois).
 */
export function alignFloor(floor: Floor): Floor {
  const sc = Math.max(1e-6, floor.planScale || 40);
  const tol = 0.08 * sc; // 8 cm
  let rooms = floor.rooms.slice();
  let changed = false;
  for (let guard = 0; guard < 40; guard++) {
    let did = false;
    outer: for (let a = 0; a < rooms.length; a++)
      for (const v of rooms[a].points ?? []) {
        for (let b = 0; b < rooms.length; b++) {
          if (a === b) continue;
          const pts = rooms[b].points ?? [];
          for (let i = 0; i < pts.length; i++) {
            const p = pts[i];
            const q = pts[(i + 1) % pts.length];
            const dx = q.x - p.x;
            const dy = q.y - p.y;
            const l2 = dx * dx + dy * dy;
            if (l2 < 1e-9) continue;
            const t = ((v.x - p.x) * dx + (v.y - p.y) * dy) / l2;
            if (t <= 0 || t >= 1) continue;
            const hx = p.x + dx * t;
            const hy = p.y + dy * t;
            if (Math.hypot(v.x - hx, v.y - hy) > tol) continue;
            if (Math.hypot(v.x - p.x, v.y - p.y) < tol || Math.hypot(v.x - q.x, v.y - q.y) < tol) continue;
            rooms = rooms.map((r, k) => (k === b ? insertVertex(r, i, { x: hx, y: hy }, sc) : r));
            did = true;
            changed = true;
            break outer;
          }
        }
      }
    if (!did) break;
  }
  return changed ? { ...floor, rooms } : floor;
}

/** Supprime un sommet en renumérotant les parois, ouvertures et éléments déjà placés (rien ne reste accroché à un numéro périmé). */
export function removeVertexRemap(room: Room, k: number, scale: number): Room {
  const pts = room.points;
  const n = pts.length;
  if (n <= 3 || k < 0 || k >= n) return room;
  const next = pts.filter((_, i) => i !== k);
  const prevEdge = (k + n - 1) % n; // paroi qui arrivait au sommet
  const mapEdge = (e: number) => (e === prevEdge || e === k ? (k === 0 ? n - 2 : k - 1) : k === 0 ? e - 1 : e > k ? e - 1 : e);
  const len = (e: number) => Math.hypot(pts[(e + 1) % n].x - pts[e].x, pts[(e + 1) % n].y - pts[e].y);
  const L1 = len(prevEdge);
  const L2 = len(k);
  const tot = Math.max(1e-6, L1 + L2);
  const wallTypes: Record<string, string> = {};
  for (const [key, v] of Object.entries(room.wallTypes ?? {})) {
    const e = Number(key);
    if (!Number.isInteger(e) || e < 0 || e >= n) continue;
    if (e === k) continue; // la paroi absorbée prend le réglage de la paroi précédente
    wallTypes[String(mapEdge(e))] = v as string;
  }
  const exterior = new Set<number>();
  for (const e of room.exteriorEdges ?? []) if (Number.isInteger(e) && e >= 0 && e < n) exterior.add(mapEdge(e));
  const openings = room.openings.map((o) => {
    if (o.edge == null || o.edge < 0 || o.edge >= n) return { ...o, edge: undefined, t: undefined };
    const t = o.t ?? 0.5;
    if (o.edge === prevEdge) return { ...o, edge: mapEdge(o.edge), t: (t * L1) / tot };
    if (o.edge === k) return { ...o, edge: mapEdge(o.edge), t: (L1 + t * L2) / tot };
    return { ...o, edge: mapEdge(o.edge) };
  });
  const fixtures = room.fixtures?.map((x) => {
    if (x.edge == null || x.edge < 0 || x.edge >= n) return x;
    if (x.edge === prevEdge) return { ...x, edge: mapEdge(x.edge) };
    if (x.edge === k) return { ...x, edge: mapEdge(x.edge), u: x.u + L1 / scale };
    return { ...x, edge: mapEdge(x.edge) };
  });
  const r2: Room = { ...room, wallTypes: wallTypes as Room["wallTypes"], openings, exteriorEdges: Array.from(exterior).sort((a, b) => a - b) };
  if (fixtures) r2.fixtures = fixtures;
  return syncFromPoints(r2, next, scale);
}

/** Retire les points qui ne servent à rien (alignés avec leurs voisins, angle plat), par exemple ceux ajoutés par l'ancien alignement automatique. */
export function removeFlatVertices(floor: Floor, tolDeg = 1.5): Floor {
  const sc = Math.max(1e-6, floor.planScale || 40);
  let changed = false;
  const rooms = floor.rooms.map((r) => {
    let cur = r;
    for (let guard = 0; guard < 60 && cur.points.length > 3; guard++) {
      const k = cur.points.findIndex((_, i) => Math.abs(vertexAngle(cur.points, i) - 180) < tolDeg);
      if (k < 0) break;
      cur = removeVertexRemap(cur, k, sc);
      changed = true;
    }
    return cur;
  });
  return changed ? { ...floor, rooms } : floor;
}

/** Cloison isolée par défaut (isolant de cloison) ; décochée d'un côté ou de l'autre = non isolée. */
export function wallInsulated(floor: Floor, w: SharedWall): boolean {
  const A = floor.rooms.find((r) => r.id === w.roomAId);
  const B = floor.rooms.find((r) => r.id === w.roomBId);
  return A?.wallInsul?.[String(w.edgeA)] !== false && B?.wallInsul?.[String(w.edgeB)] !== false;
}
