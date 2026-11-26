import type { Floor, Opening, Pt, Room } from "../types";
import { pointsForRoom } from "./geometry";
import { roomEdges } from "./surfaces";

/** Valeurs usuelles par type d'ouverture (largeur, hauteur, mur concerné). */
export const OPENING_PRESET: Record<Opening["type"], { width: number; height: number; wall: Opening["wall"] }> = {
  porte: { width: 0.9, height: 2.04, wall: "cloison" },
  fenetre: { width: 1.2, height: 1.15, wall: "exterieur" },
  baie: { width: 2.4, height: 2.15, wall: "exterieur" },
  porte_fenetre: { width: 0.9, height: 2.15, wall: "exterieur" },
  porte_garage: { width: 2.4, height: 2.0, wall: "exterieur" },
  arche: { width: 1.2, height: 2.1, wall: "cloison" },
  passage: { width: 1.5, height: 2.5, wall: "cloison" },
  trappe: { width: 0.6, height: 0.6, wall: "plafond" },
};

/** Types proposés dans les listes (la trappe se gère dans le plafond, pas sur un mur). */
export const OPENING_TYPES: Opening["type"][] = ["porte", "fenetre", "baie", "porte_fenetre", "porte_garage", "arche", "passage"];

export const OPENING_NAMES: Record<Opening["type"], string> = {
  porte: "Porte",
  fenetre: "Fenêtre",
  baie: "Baie vitrée",
  porte_fenetre: "Porte-fenêtre",
  trappe: "Trappe",
  porte_garage: "Porte de garage",
  arche: "Arche",
  passage: "Ouverture libre (partie de cloison ouverte)",
};

export const OPENING_COLOR: Record<Opening["type"], string> = {
  porte: "#8a5a2b",
  fenetre: "#2b6cb0",
  baie: "#2b6cb0",
  porte_fenetre: "#2b6cb0",
  porte_garage: "#6b7280",
  arche: "#b45309",
  passage: "#dc2626",
  trappe: "#6b7280",
};

/** Ouvertures qui se posent sur un mur (donc placées sur le plan). */
export const isWallOpening = (o: Opening) => o.wall !== "plafond" && o.type !== "trappe";

export interface PlanEdge {
  index: number;
  a: Pt;
  b: Pt;
  /** Longueur de la paroi en mètres. */
  lenM: number;
  exterior: boolean;
}

/** Parois d'une pièce, en pixels du plan (même numérotation que la vue 3D). */
export function planEdges(room: Room, scale: number): PlanEdge[] {
  const pts = pointsForRoom(room, scale);
  const info = roomEdges(room, scale);
  return pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length];
    return { index: i, a, b, lenM: Math.hypot(b.x - a.x, b.y - a.y) / scale, exterior: !!info[i]?.exterior };
  });
}

export interface PlacedOpening {
  o: Opening;
  edge: number;
  /** Position du centre, de 0 à 1 le long de la paroi (sens du plan). */
  t: number;
  auto: boolean;
}

/** Position de chaque ouverture : celle saisie à la main, sinon une répartition automatique raisonnable. */
export function placeOpenings(room: Room, scale: number): PlacedOpening[] {
  const edges = planEdges(room, scale);
  if (!edges.length) return [];
  const rr: Record<string, number> = {};
  const autos = new Map<number, Opening[]>();
  const out: PlacedOpening[] = [];
  for (const o of room.openings) {
    if (!isWallOpening(o)) continue;
    if (o.edge != null && o.t != null && edges[o.edge]) {
      out.push({ o, edge: o.edge, t: o.t, auto: false });
      continue;
    }
    let cand = edges.filter((e) => (o.wall === "exterieur" ? e.exterior : !e.exterior) && e.lenM > 0.3);
    if (!cand.length) cand = edges.filter((e) => e.lenM > 0.3);
    if (!cand.length) continue;
    cand = cand.slice().sort((x, y) => y.lenM - x.lenM);
    const k = rr[o.wall] ?? 0;
    rr[o.wall] = k + 1;
    const e = cand[k % cand.length];
    autos.set(e.index, [...(autos.get(e.index) ?? []), o]);
  }
  for (const [idx, list] of autos) {
    const e = edges[idx];
    list.forEach((o, i) => {
      const c = Math.min(Math.max(((i + 1) / (list.length + 1)) * e.lenM, o.width / 2 + 0.05), e.lenM - o.width / 2 - 0.05);
      out.push({ o, edge: idx, t: c / e.lenM, auto: true });
    });
  }
  return out;
}

/** Point du plan (px) du centre d'une ouverture. */
export function openingCenter(room: Room, scale: number, p: { edge: number; t: number }): Pt {
  const e = planEdges(room, scale)[p.edge];
  if (!e) return { x: 0, y: 0 };
  return { x: e.a.x + (e.b.x - e.a.x) * p.t, y: e.a.y + (e.b.y - e.a.y) * p.t };
}

/** Paroi la plus proche d'un point du plan (px) et position le long de cette paroi (0–1). */
export function snapToEdge(room: Room, scale: number, pt: Pt, halfWidthM = 0): { edge: number; t: number; dist: number } | null {
  const edges = planEdges(room, scale);
  let best: { edge: number; t: number; dist: number } | null = null;
  for (const e of edges) {
    const dx = e.b.x - e.a.x;
    const dy = e.b.y - e.a.y;
    const l2 = dx * dx + dy * dy;
    if (l2 < 1e-6) continue;
    let t = ((pt.x - e.a.x) * dx + (pt.y - e.a.y) * dy) / l2;
    const margin = Math.min(0.45, (halfWidthM + 0.02) / Math.max(0.1, e.lenM));
    t = Math.min(1 - margin, Math.max(margin, t));
    const d = Math.hypot(pt.x - (e.a.x + dx * t), pt.y - (e.a.y + dy * t));
    if (!best || d < best.dist) best = { edge: e.index, t, dist: d };
  }
  return best;
}

/** Extrémités (px) du segment occupé par l'ouverture sur sa paroi. */
export function openingSpan(room: Room, scale: number, p: { edge: number; t: number }, width: number): { a: Pt; b: Pt } {
  const e = planEdges(room, scale)[p.edge];
  if (!e) return { a: { x: 0, y: 0 }, b: { x: 0, y: 0 } };
  const half = Math.min(0.5, width / 2 / Math.max(0.1, e.lenM));
  const at = (t: number) => ({ x: e.a.x + (e.b.x - e.a.x) * t, y: e.a.y + (e.b.y - e.a.y) * t });
  return { a: at(Math.max(0, p.t - half)), b: at(Math.min(1, p.t + half)) };
}

export type FloorLike = Pick<Floor, "planScale">;
