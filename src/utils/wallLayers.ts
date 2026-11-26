import type { Pt, Room } from "../types";
import { pointsForRoom } from "./geometry";
import { roomEdges } from "./surfaces";

/** Épaisseur d'une plaque de plâtre BA13 (m). */
export const PLACO_T = 0.013;

/**
 * Géométrie des couches d'un mur, en pixels du plan : chaque couche est une bande décalée de d vers l'extérieur
 * de la paroi de la pièce, jointe en onglet aux murs extérieurs voisins. Le même calcul sert au dessin du plan
 * et au chiffrage, pour que ce qui est dessiné soit exactement ce qui est compté.
 */
export function wallGeometry(room: Room, scale: number) {
  const pts = pointsForRoom(room, scale);
  const n = pts.length;
  const info = roomEdges(room, scale);
  const sgn = pts.reduce((a, p, i) => a + p.x * pts[(i + 1) % n].y - pts[(i + 1) % n].x * p.y, 0) >= 0 ? 1 : -1;
  const U = pts.map((a, i) => {
    const b = pts[(i + 1) % n];
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / l;
    const uy = (b.y - a.y) / l;
    return { ux, uy, nx: sgn > 0 ? uy : -uy, ny: sgn > 0 ? -ux : ux, len: l };
  });
  const layered = (i: number) => !!info[i]?.exterior && U[i].len > 1e-6;
  /** Coin décalé de d vers l'extérieur, au début (atEnd = false) ou à la fin de la paroi i. */
  const corner = (i: number, atEnd: boolean, d: number): Pt => {
    const v = atEnd ? pts[(i + 1) % n] : pts[i];
    const cur = U[i];
    const base = { x: v.x + cur.nx * d, y: v.y + cur.ny * d };
    const j = atEnd ? (i + 1) % n : (i + n - 1) % n;
    if (!layered(j) || d <= 0) return base;
    const o = U[j];
    const det = cur.ux * o.uy - cur.uy * o.ux;
    if (Math.abs(det) < 1e-6) return base;
    const q = { x: v.x + o.nx * d, y: v.y + o.ny * d };
    const t = ((q.x - base.x) * o.uy - (q.y - base.y) * o.ux) / det;
    const m = { x: base.x + cur.ux * t, y: base.y + cur.uy * t };
    return Math.hypot(m.x - base.x, m.y - base.y) > Math.max(d, 1) * 4 ? base : m;
  };
  /** Longueur (m) de la couche située à la distance d de la face intérieure, pour la paroi i. */
  const lenM = (i: number, d: number) => {
    const a = corner(i, false, d * scale);
    const b = corner(i, true, d * scale);
    return Math.hypot(b.x - a.x, b.y - a.y) / scale;
  };
  return { pts, info, U, layered, corner, lenM };
}

export interface RoomLayerAreas {
  /** Isolant des murs extérieurs (m²), mesuré au milieu de l'épaisseur, ouvertures déduites. */
  isoM2: number;
  /** Pare-vapeur (m²), posé côté chaud de l'isolant. */
  vaporM2: number;
  /** Plaque côté extérieur des murs sans brique (m²). */
  outerM2: number;
  /** Longueur des murs extérieurs isolés à la face intérieure (m). */
  extFaceLen: number;
}

/** Surfaces couche par couche des murs extérieurs d'une pièce, avec les angles traités comme sur le plan. */
export function roomLayerAreas(room: Room, scale: number, tIsoM: number): RoomLayerAreas {
  const g = wallGeometry(room, scale);
  const h = room.height || 2.5;
  let isoLen = 0;
  let vaporLen = 0;
  let outerLen = 0;
  let extFaceLen = 0;
  let outerOpen = 0;
  const extOpenAll = room.openings.filter((o) => o.wall === "exterieur").reduce((a, o) => a + o.width * o.height, 0);
  g.info.forEach((e, i) => {
    if (!e.exterior || e.passage) return;
    extFaceLen += e.lengthM;
    const d0 = PLACO_T;
    const d1 = d0 + tIsoM;
    isoLen += (g.lenM(i, d0) + g.lenM(i, d1)) / 2;
    vaporLen += g.lenM(i, d0);
    if (room.wallStruct?.[String(i)] === "ossature") {
      outerLen += (g.lenM(i, d1) + g.lenM(i, d1 + PLACO_T)) / 2;
      outerOpen += room.openings.filter((o) => o.edge === i && o.wall === "exterieur").reduce((a, o) => a + o.width * o.height, 0);
    }
  });
  return {
    isoM2: Math.max(0, isoLen * h - extOpenAll),
    vaporM2: Math.max(0, vaporLen * h - extOpenAll),
    outerM2: Math.max(0, outerLen * h - outerOpen),
    extFaceLen,
  };
}
