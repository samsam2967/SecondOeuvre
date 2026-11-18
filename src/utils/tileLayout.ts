import type { Pt, TileLayoutData } from "../types";

export const PATTERNS = {
  droit: { angle: 0, shift: 0, label: "Droit (joints alignés)" },
  demi: { angle: 0, shift: 0.5, label: "Décalé 1/2 (quinconce classique)" },
  tiers: { angle: 0, shift: 1 / 3, label: "Décalé 1/3 (progressif)" },
  quinconce: { angle: 0, shift: 0.5, label: "Quinconce réglable (décalage au choix)" },
  diag: { angle: 45, shift: 0, label: "Diagonal 45°" },
} as const;
export type PatternId = keyof typeof PATTERNS;

/** Angle réel de la grille (motif + angle libre + sens de décalage), en degrés. */
export function effectiveAngle(p: Pick<TileLayoutData, "pattern" | "angleDeg" | "shiftAxis">): number {
  return PATTERNS[p.pattern].angle + (p.angleDeg ?? 0) + (p.shiftAxis === "colonnes" ? 90 : 0);
}

/** Les carreaux sont-ils décalés d'une rangée à l'autre (en quinconce ou décalé) ? */
export function isStaggered(p: Pick<TileLayoutData, "pattern" | "shiftPct">): boolean {
  if (p.pattern === "quinconce") return (p.shiftPct ?? 50) % 100 !== 0;
  return p.pattern === "demi" || p.pattern === "tiers";
}

export interface Cell {
  /** Polygone de la partie de carreau posée, en mètres (repère du plan). */
  poly: Pt[];
  area: number;
  full: boolean;
  /** Dimensions (m) de la pièce découpée, dans le repère du carreau. */
  w: number;
  h: number;
  /** Chute trop étroite pour être posée proprement. */
  sliver: boolean;
  /** Repère du carreau dans le plan (m) : coin d'origine, axes unitaires de sa longueur et de sa largeur, dimensions. Sert à plaquer la photo du produit. */
  o?: Pt;
  ux?: Pt;
  uy?: Pt;
  tl?: number;
  tw?: number;
}

export interface LayoutStats {
  cells: Cell[];
  full: number;
  cut: number;
  total: number;
  roomArea: number;
  tileArea: number;
  /** Perte = surface de carreaux achetés non posée, en % des carreaux achetés. */
  wastePct: number;
  slivers: number;
  /** Estimation avec réemploi des chutes. */
  needReuse: number;
}

export type LayoutParams = Pick<TileLayoutData, "pattern" | "swap" | "offX" | "offY" | "jointMm" | "minCutCm"> &
  Partial<Pick<TileLayoutData, "shiftPct" | "shiftMode" | "shiftAxis" | "angleDeg" | "centered" | "origin">>;

export function polyArea(p: Pt[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length];
    a += p[i].x * q.y - q.x * p[i].y;
  }
  return Math.abs(a) / 2;
}

/** Sutherland–Hodgman : découpe un polygone par un rectangle. */
function clipRect(poly: Pt[], x0: number, y0: number, x1: number, y1: number): Pt[] {
  type E = [(p: Pt) => boolean, (a: Pt, b: Pt) => Pt];
  const edges: E[] = [
    [(p) => p.x >= x0, (a, b) => ({ x: x0, y: a.y + ((x0 - a.x) / (b.x - a.x)) * (b.y - a.y) })],
    [(p) => p.x <= x1, (a, b) => ({ x: x1, y: a.y + ((x1 - a.x) / (b.x - a.x)) * (b.y - a.y) })],
    [(p) => p.y >= y0, (a, b) => ({ x: a.x + ((y0 - a.y) / (b.y - a.y)) * (b.x - a.x), y: y0 })],
    [(p) => p.y <= y1, (a, b) => ({ x: a.x + ((y1 - a.y) / (b.y - a.y)) * (b.x - a.x), y: y1 })],
  ];
  let out = poly;
  for (const [inside, inter] of edges) {
    const inp = out;
    out = [];
    if (!inp.length) break;
    for (let i = 0; i < inp.length; i++) {
      const cur = inp[i];
      const prev = inp[(i + inp.length - 1) % inp.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(inter(prev, cur));
        out.push(cur);
      } else if (inside(prev)) out.push(inter(prev, cur));
    }
  }
  return out;
}

export function computeLayout(
  points: Pt[],
  tile: { tileL: number; tileW: number },
  p: LayoutParams,
  keepCells = true,
): LayoutStats {
  const roomArea = polyArea(points);
  const cols = p.shiftAxis === "colonnes";
  // Décaler les colonnes = décaler les rangées d'une grille tournée de 90° (carreau inversé dans le repère de la grille).
  const L0 = p.swap ? tile.tileW : tile.tileL;
  const W0 = p.swap ? tile.tileL : tile.tileW;
  const L = cols ? W0 : L0;
  const W = cols ? L0 : W0;
  const tileArea = L * W;
  const j = Math.max(0, p.jointMm) / 1000;
  const px = L + j;
  const py = W + j;
  const base = PATTERNS[p.pattern];
  const rad = (effectiveAngle(p) * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const minPX = Math.min(...points.map((q) => q.x));
  const maxPX = Math.max(...points.map((q) => q.x));
  const minPY = Math.min(...points.map((q) => q.y));
  const maxPY = Math.max(...points.map((q) => q.y));
  const sx = p.origin === "hd" || p.origin === "bd" ? -1 : 1;
  const sy = p.origin === "bg" || p.origin === "bd" ? -1 : 1;
  const o = { x: sx > 0 ? minPX : maxPX, y: sy > 0 ? minPY : maxPY };
  const raw = (q: Pt): Pt => {
    const dx = (q.x - o.x) * sx;
    const dy = (q.y - o.y) * sy;
    return { x: dx * c + dy * s, y: -dx * s + dy * c };
  };
  let offX = p.offX;
  let offY = p.offY;
  if (p.centered) {
    // un carreau centré sur le centre de la pièce : coupes égales de chaque côté
    const r = points.map(raw);
    const cx = (Math.min(...r.map((q) => q.x)) + Math.max(...r.map((q) => q.x))) / 2;
    const cy = (Math.min(...r.map((q) => q.y)) + Math.max(...r.map((q) => q.y))) / 2;
    offX = cx - L / 2;
    offY = cy - W / 2;
  }
  const toF = (q: Pt): Pt => {
    const r = raw(q);
    return { x: r.x - offX, y: r.y - offY };
  };
  const toW = (f: Pt): Pt => {
    const x = f.x + offX;
    const y = f.y + offY;
    const dx = x * c - y * s;
    const dy = x * s + y * c;
    return { x: o.x + dx * sx, y: o.y + dy * sy };
  };
  const pf = points.map(toF);
  const minX = Math.min(...pf.map((q) => q.x));
  const maxX = Math.max(...pf.map((q) => q.x));
  const minY = Math.min(...pf.map((q) => q.y));
  const maxY = Math.max(...pf.map((q) => q.y));
  const minCut = p.minCutCm / 100;
  const frac = p.pattern === "quinconce" ? ((p.shiftPct ?? 50) / 100) % 1 : base.shift;
  const progressive = p.pattern === "tiers" || (p.pattern === "quinconce" && p.shiftMode === "progressif");

  const cells: Cell[] = [];
  let full = 0;
  let cut = 0;
  let slivers = 0;
  let cutArea = 0;

  for (let r = Math.floor(minY / py); r <= Math.floor(maxY / py); r++) {
    const k = progressive ? (((r * frac) % 1) + 1) % 1 : (((r % 2) + 2) % 2) * frac;
    const ro = k * px;
    for (let col = Math.floor((minX - ro) / px); col <= Math.floor((maxX - ro) / px); col++) {
      const x0 = col * px + ro;
      const y0 = r * py;
      const cl = clipRect(pf, x0, y0, x0 + L, y0 + W);
      if (cl.length < 3) continue;
      const area = polyArea(cl);
      if (area < 1e-4) continue;
      const xs = cl.map((q) => q.x);
      const ys = cl.map((q) => q.y);
      const w = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(...ys) - Math.min(...ys);
      const isFull = area >= tileArea - 1e-4;
      const sliver = !isFull && ((w < minCut && w < L - 1e-3) || (h < minCut && h < W - 1e-3));
      if (isFull) full++;
      else {
        cut++;
        cutArea += area;
      }
      if (sliver) slivers++;
      // dimensions de la coupe exprimées dans le repère du carreau réel (longueur × largeur)
      let frame: Partial<Cell> = {};
      if (keepCells) {
        const ow = toW({ x: x0, y: y0 });
        const wx = toW({ x: x0 + 1, y: y0 });
        const wy = toW({ x: x0, y: y0 + 1 });
        frame = { o: ow, ux: { x: wx.x - ow.x, y: wx.y - ow.y }, uy: { x: wy.x - ow.x, y: wy.y - ow.y }, tl: L, tw: W };
      }
      cells.push({ poly: keepCells ? cl.map(toW) : [], area, full: isFull, w: cols ? h : w, h: cols ? w : h, sliver, ...frame });
    }
  }
  const total = full + cut;
  return {
    cells,
    full,
    cut,
    total,
    roomArea,
    tileArea,
    wastePct: total > 0 ? ((total * tileArea - roomArea) / (total * tileArea)) * 100 : 0,
    slivers,
    needReuse: full + Math.ceil((cutArea / tileArea) * 1.1 - 1e-9),
  };
}

/** Cherche le motif, le sens et le décalage qui minimisent le nombre de carreaux (et les chutes inutilisables). */
export function optimizeLayout(
  points: Pt[],
  tile: { tileL: number; tileW: number },
  base: LayoutParams,
  patterns: PatternId[],
): LayoutParams {
  const score = (st: LayoutStats) => st.total + st.slivers * 0.5 + st.cut * 0.002;
  const best = { p: base, sc: Infinity };
  const test = (p: LayoutParams) => {
    const sc = score(computeLayout(points, tile, p, false));
    if (sc < best.sc - 1e-9) {
      best.p = p;
      best.sc = sc;
    }
  };
  const square = Math.abs(tile.tileL - tile.tileW) < 1e-3;
  const variants: { pattern: PatternId; shiftPct?: number }[] = [];
  for (const pattern of patterns) {
    if (pattern === "quinconce") {
      if (base.pattern === "quinconce") variants.push({ pattern, shiftPct: base.shiftPct ?? 50 });
      else for (const sp of [25, 33, 50]) variants.push({ pattern, shiftPct: sp });
    } else variants.push({ pattern });
  }
  for (const { pattern, shiftPct } of variants) {
    for (const swap of square ? [false] : [false, true]) {
      const L = swap ? tile.tileW : tile.tileL;
      const W = swap ? tile.tileL : tile.tileW;
      const j = base.jointMm / 1000;
      const px = L + j;
      const py = W + j;
      const sx = Math.max(0.03, px / 12);
      const sy = Math.max(0.03, py / 12);
      for (let ox = 0; ox < px - 1e-9; ox += sx)
        for (let oy = 0; oy < py - 1e-9; oy += sy) test({ ...base, pattern, ...(shiftPct != null ? { shiftPct } : {}), swap, offX: ox, offY: oy, centered: false });
    }
  }
  // Affinage autour du meilleur candidat
  const c0 = { ...best.p };
  for (let dx = -0.03; dx <= 0.03 + 1e-9; dx += 0.005)
    for (let dy = -0.03; dy <= 0.03 + 1e-9; dy += 0.005) test({ ...c0, offX: c0.offX + dx, offY: c0.offY + dy, centered: false });
  return best.p;
}
