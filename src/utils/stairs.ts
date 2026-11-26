import type { Pt, Stair } from "../types";

/** Un bloc de l'escalier dans son repère local : u = sens de la montée, v = vers la droite (mètres). */
export interface StairBox {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  /** Hauteur du dessus de la marche au-dessus du pied de l'escalier (m). */
  z: number;
  landing: boolean;
  /** Marche balancée (en éventail) : contour exact en (u, v) ; u0…v1 donnent la boîte englobante. */
  poly?: [number, number][];
}

export const STAIR_MATERIALS: Record<Stair["material"], { label: string; color: string; solid: boolean }> = {
  bois: { label: "Bois", color: "#b98a56", solid: false },
  beton: { label: "Béton", color: "#a8a8a2", solid: true },
  metal: { label: "Métal", color: "#4b5563", solid: false },
  pierre: { label: "Pierre", color: "#c9c2b2", solid: true },
};

export const STAIR_KINDS: Record<Stair["kind"], string> = {
  droit: "Droit",
  quart: "Quart tournant",
  demi: "Demi-tour (en U)",
};

export function defaultStair(x: number, y: number, rise: number): Stair {
  const steps = Math.max(2, Math.round(rise / 0.175));
  return {
    id: "",
    name: "Escalier",
    kind: "droit",
    x,
    y,
    angle: 0,
    steps,
    rise,
    width: 0.9,
    tread: 0.25,
    turn: "droite",
    landing: "continu",
    landingAfter: Math.max(1, Math.floor((steps - 1) / 2)),
    landingDepth: 0.9,
    gap: 0.1,
    material: "bois",
    color: STAIR_MATERIALS.bois.color,
    tiled: false,
    tileColor: "#d9d5cc",
  };
}

/** Volée avant le palier, bornée pour rester cohérente avec le nombre de marches. */
export function landingSteps(s: Stair): number {
  const n = Math.max(2, Math.round(s.steps));
  return Math.min(Math.max(1, Math.round(s.landingAfter)), Math.max(1, n - 3));
}

/** Blocs (marches et palier) de l'escalier dans son repère local. */
export function stairBoxes(s: Stair): StairBox[] {
  const n = Math.max(2, Math.round(s.steps));
  const riser = s.rise / n;
  const t = Math.max(0.1, s.tread);
  const w = Math.max(0.5, s.width);
  const out: StairBox[] = [];
  const step = (u0: number, u1: number, v0: number, v1: number, k: number) =>
    out.push({ u0: Math.min(u0, u1), u1: Math.max(u0, u1), v0, v1, z: k * riser, landing: false });
  const land = (u0: number, u1: number, v0: number, v1: number, k: number) =>
    out.push({ u0, u1, v0, v1, z: k * riser, landing: true });

  const winder = (pts: [number, number][], k: number) => {
    const us = pts.map((q) => q[0]);
    const vs = pts.map((q) => q[1]);
    out.push({ u0: Math.min(...us), u1: Math.max(...us), v0: Math.min(...vs), v1: Math.max(...vs), z: k * riser, landing: false, poly: pts });
  };
  /** Éventail de marches balancées autour d'un pivot, dans un rectangle [ua,ub] × [va,vb]. */
  const fan = (pivot: [number, number], ua: number, ub: number, va: number, vb: number, count: number, spanDeg: number, firstK: number) => {
    const ray = (deg: number): [number, number] => {
      const th = (deg * Math.PI) / 180;
      const d: [number, number] = [Math.sin(th), -Math.cos(th)];
      const cand: number[] = [];
      if (d[0] > 1e-9) cand.push((ub - pivot[0]) / d[0]);
      if (d[1] > 1e-9) cand.push((vb - pivot[1]) / d[1]);
      if (d[1] < -1e-9) cand.push((va - pivot[1]) / d[1]);
      if (d[0] < -1e-9) cand.push((ua - pivot[0]) / d[0]);
      const tt = Math.min(...cand.filter((x) => x > 0));
      return [pivot[0] + d[0] * tt, pivot[1] + d[1] * tt];
    };
    const corners: { deg: number; p: [number, number] }[] = [
      { deg: Math.atan2(ub - pivot[0], pivot[1] - va) * (180 / Math.PI), p: [ub, va] },
      { deg: 180 - Math.atan2(ub - pivot[0], vb - pivot[1]) * (180 / Math.PI), p: [ub, vb] },
    ];
    for (let k = 0; k < count; k++) {
      const d0 = (k * spanDeg) / count;
      const d1 = ((k + 1) * spanDeg) / count;
      const pts: [number, number][] = [pivot, ray(d0)];
      for (const c of corners) if (c.deg > d0 + 0.01 && c.deg < d1 - 0.01 && c.deg <= spanDeg + 0.01) pts.push(c.p);
      pts.push(ray(d1));
      winder(pts, firstK + k);
    }
  };

  if (s.kind === "droit" && s.landing === "continu") {
    for (let k = 1; k <= n - 1; k++) step((k - 1) * t, k * t, 0, w, k);
  } else if (s.kind === "quart" && s.landing === "continu") {
    // quart tournant sans palier : trois marches balancées dans l'angle
    const a = Math.min(Math.max(1, Math.round(s.landingAfter)), Math.max(1, n - 5));
    for (let k = 1; k <= a; k++) step((k - 1) * t, k * t, 0, w, k);
    const ut = a * t;
    fan([ut, w], ut, ut + w, 0, w, 3, 90, a + 1);
    const rest = Math.max(0, n - a - 4);
    for (let j = 1; j <= rest; j++) step(ut, ut + w, w + (j - 1) * t, w + j * t, a + 3 + j);
  } else if (s.kind === "demi" && s.landing === "continu") {
    // demi-tour sans palier : cinq marches balancées en éventail entre les deux volées
    const a = Math.min(Math.max(1, Math.round(s.landingAfter)), Math.max(1, n - 7));
    for (let k = 1; k <= a; k++) step((k - 1) * t, k * t, 0, w, k);
    const ut = a * t;
    const g = Math.max(0.02, s.gap);
    const D = w + g / 2;
    fan([ut, w + g / 2], ut, ut + D, 0, 2 * w + g, 5, 180, a + 1);
    const rest = Math.max(0, n - a - 6);
    for (let j = 1; j <= rest; j++) step(ut - j * t, ut - (j - 1) * t, w + g, 2 * w + g, a + 5 + j);
  } else {
    const a = s.kind === "droit" ? landingSteps(s) : Math.min(Math.max(1, Math.round(s.landingAfter)), Math.max(1, n - 3));
    for (let k = 1; k <= a; k++) step((k - 1) * t, k * t, 0, w, k);
    const rest = Math.max(0, n - a - 2);
    if (s.kind === "droit") {
      const L = Math.max(w * 0.8, s.landingDepth);
      land(a * t, a * t + L, 0, w, a + 1);
      for (let j = 1; j <= rest; j++) step(a * t + L + (j - 1) * t, a * t + L + j * t, 0, w, a + 1 + j);
    } else if (s.kind === "quart") {
      land(a * t, a * t + w, 0, w, a + 1);
      for (let j = 1; j <= rest; j++) step(a * t, a * t + w, w + (j - 1) * t, w + j * t, a + 1 + j);
    } else {
      const L = Math.max(w * 0.8, s.landingDepth);
      const g = Math.max(0.02, s.gap);
      land(a * t, a * t + L, 0, 2 * w + g, a + 1);
      for (let j = 1; j <= rest; j++) step(a * t - j * t, a * t - (j - 1) * t, w + g, 2 * w + g, a + 1 + j);
    }
  }
  // tournant à gauche : le même escalier, renversé de l'autre côté
  if (s.kind !== "droit" && s.turn === "gauche") return out.map((b) => ({ ...b, v0: -b.v1, v1: -b.v0, poly: b.poly?.map(([u, v]) => [u, -v] as [number, number]) }));
  return out;
}

/** Point du plan (pixels) correspondant à (u, v) en mètres dans le repère de l'escalier. */
export function stairToPlan(s: Stair, scale: number, u: number, v: number): Pt {
  const a = (s.angle * Math.PI) / 180;
  return { x: s.x + (Math.cos(a) * u - Math.sin(a) * v) * scale, y: s.y + (Math.sin(a) * u + Math.cos(a) * v) * scale };
}

export function stairBoxPoly(s: Stair, scale: number, b: StairBox): Pt[] {
  if (b.poly) return b.poly.map(([u, v]) => stairToPlan(s, scale, u, v));
  return [stairToPlan(s, scale, b.u0, b.v0), stairToPlan(s, scale, b.u1, b.v0), stairToPlan(s, scale, b.u1, b.v1), stairToPlan(s, scale, b.u0, b.v1)];
}

/** Hauteur de contremarche, giron et vérification de la formule de Blondel (2h + g entre 60 et 64 cm). */
export function stairCheck(s: Stair) {
  const n = Math.max(2, Math.round(s.steps));
  const h = s.rise / n;
  const blondel = 2 * h * 100 + s.tread * 100;
  const issues: string[] = [];
  if (h > 0.19) issues.push("Marches trop hautes (plus de 19 cm) : ajoute des marches.");
  if (h < 0.15) issues.push("Marches très basses (moins de 15 cm) : retire des marches.");
  if (s.tread < 0.23) issues.push("Giron court (moins de 23 cm).");
  if (blondel < 58 || blondel > 66) issues.push(`Formule de Blondel ${blondel.toFixed(0)} cm : vise 60 à 64 cm pour un escalier confortable.`);
  if (s.width < 0.8) issues.push("Largeur sous 80 cm : limite pour un escalier de maison individuelle (90 cm recommandé).");
  const horiz = stairBoxes(s).reduce((m, b) => Math.max(m, b.u1, -b.u0), 0);
  return { riser: h, blondel, ok: issues.length === 0, issues, horiz };
}
