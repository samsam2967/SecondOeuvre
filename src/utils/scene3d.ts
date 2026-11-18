import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ISOLANTS } from "../data/catalogs";
import type { ElecDevice, Fixture, FixtureKind, Floor, Opening, PostId, Project, Room } from "../types";
import { resolvePaint, resolveTile, roomMaterials, type ResolvedTile } from "./calc";
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
  /** Élément mural (prise, sanitaire…) sélectionné. */
  selectedFixture?: string | null;
  /** Couleurs et textures exactes du produit (sans ombrage), pour juger carrelage et peinture. */
  faithful?: boolean;
  /** Aperçu d'un déplacement en cours (glisser) : n'écrit rien dans le projet. */
  preview?: { id: string; edge: number; u: number } | null;
  /** Calcule aussi les éléments muraux de tous les postes (panneau d'édition ouvert). */
  fixturesAll?: boolean;
}

export interface TexCtx {
  cache: Map<string, THREE.Texture>;
  redraw: () => void;
  /** Relance la construction de la scène (ex. quand la couleur moyenne d'une photo vient d'être calculée). */
  rebuild?: () => void;
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
  /** Éléments muraux effectifs de chaque pièce (saisis à la main ou répartis automatiquement). */
  fixtures: Map<string, Fixture[]>;
  /** Pièces dont les éléments muraux sont encore répartis automatiquement (pas encore personnalisés). */
  autoRooms: Set<string>;
  /** Longueur de chaque paroi (m) et paroi ouverte (sans cloison), par « idPièce:numéroParoi ». */
  walls: Map<string, { len: number; open: boolean }>;
  /** Objets 3D des éléments (ouvertures et éléments muraux) : cliquables pour les sélectionner et les glisser. */
  elements: THREE.Object3D[];
  dispose: () => void;
}

/** Fiche de chaque élément mural : dimensions usuelles (m), hauteur et couleur. `z` = centre pour l'électricité, bas de l'objet pour le sanitaire. */
export const FIXTURE_SPEC: Record<FixtureKind, { label: string; w: number; d: number; h: number; z: number; color: string; elec: boolean }> = {
  prise: { label: "Prise 16 A", w: 0.08, d: 0.03, h: 0.08, z: 0.3, color: "#1d4ed8", elec: true },
  prise_double: { label: "Prise double", w: 0.16, d: 0.03, h: 0.08, z: 0.3, color: "#1d4ed8", elec: true },
  prise_triple: { label: "Prise triple", w: 0.23, d: 0.03, h: 0.08, z: 0.3, color: "#1d4ed8", elec: true },
  inter: { label: "Interrupteur", w: 0.08, d: 0.03, h: 0.08, z: 1.1, color: "#b45309", elec: true },
  inter_double: { label: "Interrupteur double", w: 0.16, d: 0.03, h: 0.08, z: 1.1, color: "#b45309", elec: true },
  poussoir: { label: "Poussoir", w: 0.08, d: 0.03, h: 0.08, z: 1.1, color: "#b45309", elec: true },
  rj45: { label: "Prise RJ45", w: 0.08, d: 0.03, h: 0.08, z: 0.3, color: "#0f766e", elec: true },
  tv: { label: "Prise TV", w: 0.08, d: 0.03, h: 0.08, z: 0.3, color: "#0e7490", elec: true },
  hdmi: { label: "Prise HDMI", w: 0.08, d: 0.03, h: 0.08, z: 0.3, color: "#7c3aed", elec: true },
  derivation: { label: "Boîte de dérivation", w: 0.12, d: 0.05, h: 0.12, z: 2.3, color: "#7c3aed", elec: true },
  tableau: { label: "Tableau électrique", w: 0.4, d: 0.15, h: 0.6, z: 1.6, color: "#111827", elec: true },
  evier: { label: "Évier", w: 1.2, d: 0.6, h: 0.9, z: 0, color: "#b8bec4", elec: false },
  receveur: { label: "Receveur de douche", w: 0.9, d: 0.9, h: 0.06, z: 0, color: "#f5f5f3", elec: false },
  paroi_douche: { label: "Paroi de douche", w: 0.9, d: 0.9, h: 2.0, z: 0, color: "#aedaf2", elec: false },
  baignoire: { label: "Baignoire", w: 1.7, d: 0.75, h: 0.55, z: 0, color: "#f5f5f3", elec: false },
  meuble_vasque: { label: "Meuble vasque", w: 0.8, d: 0.5, h: 0.85, z: 0, color: "#b99872", elec: false },
  vasque: { label: "Vasque", w: 0.6, d: 0.45, h: 0.15, z: 0.85, color: "#fafafa", elec: false },
  wc: { label: "WC suspendu", w: 0.36, d: 0.55, h: 0.4, z: 0, color: "#fafafa", elec: false },
  bati_wc: { label: "Bâti-support WC", w: 0.36, d: 0.15, h: 1.1, z: 0, color: "#9ca3af", elec: false },
  lave_mains: { label: "Lave-mains", w: 0.3, d: 0.2, h: 0.2, z: 0.9, color: "#fafafa", elec: false },
  lave_linge: { label: "Lave-linge", w: 0.6, d: 0.6, h: 0.85, z: 0, color: "#f3f4f6", elec: false },
  seche_serviettes: { label: "Sèche-serviettes", w: 0.5, d: 0.08, h: 1.2, z: 0.3, color: "#e5e7eb", elec: false },
  radiateur: { label: "Radiateur", w: 0.8, d: 0.1, h: 0.6, z: 0.15, color: "#f3f4f6", elec: false },
  miroir: { label: "Miroir", w: 0.6, d: 0.02, h: 0.8, z: 1.1, color: "#cfe3ee", elec: false },
};

export const ELEC_FIXTURES = (Object.keys(FIXTURE_SPEC) as FixtureKind[]).filter((k) => FIXTURE_SPEC[k].elec);
export const SANITARY_FIXTURES = (Object.keys(FIXTURE_SPEC) as FixtureKind[]).filter((k) => !FIXTURE_SPEC[k].elec);

/** Éléments sanitaires d'une pièce d'après ses matériaux (ce qui est vraiment prévu dans la pièce). */
function sanitaryKindsFromMaterials(project: Project, room: Room): FixtureKind[] {
  const out: FixtureKind[] = [];
  let hasMeuble = false;
  for (const l of roomMaterials(project, room.id)) {
    if (l.post !== "sanitaire") continue;
    const n = l.name.toLowerCase();
    if (/mitigeur|siphon|bonde|tube|per |pvc|collier|raccord|flexible|nourrice|vanne|calorifuge|kit|isolant|multicouche/.test(n)) continue;
    let k: FixtureKind | null = null;
    if (/évier|evier/.test(n)) k = "evier";
    else if (/receveur/.test(n)) k = "receveur";
    else if (/paroi/.test(n)) k = "paroi_douche";
    else if (/baignoire/.test(n)) k = "baignoire";
    else if (/meuble vasque/.test(n)) {
      k = "meuble_vasque";
      hasMeuble = true;
    } else if (/^vasque/.test(n)) k = "vasque";
    else if (/bâti|bati/.test(n)) k = "bati_wc";
    else if (/wc/.test(n)) k = "wc";
    else if (/lave-mains|lave mains/.test(n)) k = "lave_mains";
    else if (/sèche|seche/.test(n)) k = "seche_serviettes";
    else if (/miroir/.test(n)) k = "miroir";
    else if (/lave-linge|lave linge|machine/.test(n)) k = "lave_linge";
    if (!k) continue;
    const q = Math.max(1, Math.round(l.qty));
    for (let i = 0; i < Math.min(q, 4); i++) out.push(k);
  }
  if (room.type === "buanderie" && !out.includes("lave_linge")) out.push("lave_linge");
  // une vasque posée sur un meuble ne se dessine pas deux fois
  return hasMeuble ? out.filter((k) => k !== "vasque") : out;
}

// ───────────── Couleur moyenne d'une photo (aperçu fidèle d'une peinture ou d'un carrelage sans couleur saisie) ─────────────
const photoColorCache = new Map<string, string | null>();
function photoAverageColor(ctx: TexCtx, photo: string): string | null {
  const key = photo.length + photo.slice(-32);
  if (photoColorCache.has(key)) return photoColorCache.get(key) ?? null;
  photoColorCache.set(key, null);
  const img = new Image();
  img.onload = () => {
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 24;
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0, 24, 24);
      const d = g.getImageData(0, 0, 24, 24).data;
      let r = 0;
      let gg = 0;
      let b = 0;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 200) continue;
        r += d[i];
        gg += d[i + 1];
        b += d[i + 2];
        n++;
      }
      if (n) photoColorCache.set(key, `#${[r / n, gg / n, b / n].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`);
      ctx.rebuild?.();
    } catch {
      /* photo illisible */
    }
  };
  img.src = photo;
  return null;
}

/** Texture d'UN carreau (photo du produit, sinon couleur avec léger veinage) : sert au calepinage, carreau par carreau. */
function singleTileTexture(ctx: TexCtx, color: string, photo?: string): THREE.Texture {
  const key = `one|${color}|${photo ? photo.length + photo.slice(-24) : ""}`;
  const hit = ctx.cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  const paint = (img?: HTMLImageElement) => {
    if (img) g.drawImage(img, 0, 0, 512, 512);
    else {
      g.fillStyle = color;
      g.fillRect(0, 0, 512, 512);
      g.strokeStyle = "rgba(255,255,255,0.10)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(60, 150);
      g.lineTo(450, 320);
      g.moveTo(40, 380);
      g.lineTo(380, 200);
      g.stroke();
    }
  };
  paint();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  ctx.cache.set(key, tex);
  if (photo) {
    const img = new Image();
    img.onload = () => {
      paint(img);
      tex.needsUpdate = true;
      ctx.redraw();
    };
    img.src = photo;
  }
  return tex;
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
  /** Paroi ouverte : aucune cloison dessinée. */
  open: boolean;
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
  porte_garage: "Porte de garage",
  arche: "Arche / passage",
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
function tileTexture(ctx: TexCtx, t: ResolvedTile, jointMm: number, color: string, grout = "#8e8d89"): THREE.Texture {
  const j = Math.max(0.001, jointMm / 1000);
  const pw = (t.tileL + j) * 2;
  const ph = (t.tileW + j) * 2;
  const key = `tile|${t.tileL}|${t.tileW}|${j}|${color}|${grout}|${t.photo ? t.photo.length + t.photo.slice(-24) : ""}`;
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
    g.fillStyle = grout;
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

function wallShape(len: number, h: number, holes: { x0: number; x1: number; y0: number; y1: number; arch?: boolean }[]) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(len, 0);
  s.lineTo(len, h);
  s.lineTo(0, h);
  s.lineTo(0, 0);
  for (const o of holes) {
    const p = new THREE.Path();
    const r = (o.x1 - o.x0) / 2;
    if (o.arch && o.y1 - o.y0 > r + 0.2) {
      // arche : montants droits puis demi-cercle
      p.moveTo(o.x0, o.y0);
      p.lineTo(o.x0, o.y1 - r);
      p.absarc(o.x0 + r, o.y1 - r, r, Math.PI, 0, true);
      p.lineTo(o.x1, o.y0);
      p.lineTo(o.x0, o.y0);
    } else {
      p.moveTo(o.x0, o.y0);
      p.lineTo(o.x0, o.y1);
      p.lineTo(o.x1, o.y1);
      p.lineTo(o.x1, o.y0);
      p.lineTo(o.x0, o.y0);
    }
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
  const fixturesOut = new Map<string, Fixture[]>();
  const autoRooms = new Set<string>();
  const wallsInfo = new Map<string, { len: number; open: boolean }>();
  const elements: THREE.Object3D[] = [];
  const faithful = opts.faithful !== false;
  const groutColor = S.carrelage.jointColor || "#8e8d89";
  /** Décalage d'un étage dans la vue 3D (superposition des plans). */
  const offOf = (f: Floor) => ({ x: f.offsetX ?? 0, y: f.offsetY ?? 0 });
  /** Matériau de surface (murs, sols, plafonds) : couleur / texture exactes du produit en mode fidèle, sinon éclairé. */
  const srf = (color: string, extra: THREE.MeshBasicMaterialParameters = {}): THREE.Material =>
    faithful ? track(new THREE.MeshBasicMaterial({ color, ...extra })) : lam(color, extra as Partial<THREE.MeshLambertMaterialParameters>);
  const srfMap = (map: THREE.Texture, extra: THREE.MeshBasicMaterialParameters = {}): THREE.Material =>
    faithful ? track(new THREE.MeshBasicMaterial({ map, ...extra })) : lamMap(map, extra as Partial<THREE.MeshLambertMaterialParameters>);
  const jointOf = (room: Room) => (room.jointMm && room.jointMm > 0 ? room.jointMm : S.carrelage.jointMm);

  // Parois ouvertes : une paroi marquée « aucun placo — passage » dans Plans & pièces, ou qui touche
  // le passage ouvert d'une pièce voisine, n'a aucune cloison dans la vue 3D.
  type Seg = { ax: number; ay: number; bx: number; by: number; roomId: string };
  const roomSegs = (floor: Floor, room: Room): Seg[] => {
    const sc = floor.planScale || 40;
    const o = offOf(floor);
    const pp = pointsForRoom(room, sc).map((p) => ({ x: p.x / sc + o.x, y: p.y / sc + o.y }));
    return pp.map((a, i) => {
      const b = pp[(i + 1) % pp.length];
      return { ax: a.x, ay: a.y, bx: b.x, by: b.y, roomId: room.id };
    });
  };
  const openSegsByFloor = new Map<string, Seg[]>();
  for (const f of project.floors)
    openSegsByFloor.set(
      f.id,
      f.rooms.flatMap((r) => roomSegs(f, r).filter((_, i) => r.wallTypes?.[String(i)] === "none")),
    );
  const sharesOpen = (floor: Floor, seg: Seg): boolean => {
    const len = Math.hypot(seg.bx - seg.ax, seg.by - seg.ay);
    if (len < 0.05) return false;
    const dx = (seg.bx - seg.ax) / len;
    const dy = (seg.by - seg.ay) / len;
    for (const o of openSegsByFloor.get(floor.id) ?? []) {
      if (o.roomId === seg.roomId) continue;
      const dc = Math.abs((o.ax - seg.ax) * dy - (o.ay - seg.ay) * dx);
      const dd = Math.abs((o.bx - seg.ax) * dy - (o.by - seg.ay) * dx);
      if (dc > 0.15 || dd > 0.15) continue;
      const t1 = (o.ax - seg.ax) * dx + (o.ay - seg.ay) * dy;
      const t2 = (o.bx - seg.ax) * dx + (o.by - seg.ay) * dy;
      const overlap = Math.min(len, Math.max(t1, t2)) - Math.max(0, Math.min(t1, t2));
      const olen = Math.hypot(o.bx - o.ax, o.by - o.ay);
      if (overlap > 0.3 && overlap > 0.3 * Math.min(len, olen)) return true;
    }
    return false;
  };

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

  const defaultSill = (o: Opening) => (o.type === "fenetre" ? (o.height >= 1 ? 0.9 : 1.3) : 0);
  const colorOfTile = (t: ResolvedTile) => resolveTileColor(S.carrelage.tiles, t, tex);
  const colorOfPaint = (pp: { color?: string; photo?: string }) => pp.color ?? (pp.photo ? photoAverageColor(tex, pp.photo) : null) ?? "#f3efe6";

  // ───────────── Parois, sols, plafonds ─────────────
  for (const floor of floors) {
    const sc = floor.planScale || 40;
    const z0 = elev.get(floor.id) ?? 0;
    const fo = offOf(floor);
    for (const room of floor.rooms) {
      const pts = pointsForRoom(room, sc).map((p) => ({ x: p.x / sc + fo.x, y: p.y / sc + fo.y }));
      if (pts.length < 3) continue;
      const segsOfRoom = roomSegs(floor, room);
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
          open: room.wallTypes?.[String(i)] === "none" || sharesOpen(floor, segsOfRoom[i]),
          elev: z0,
          h,
          group: g,
          placed: [],
        };
        walls[i] = w;
        wallsInfo.set(`${room.id}:${i}`, { len, open: w.open });
        root.add(g);
      });
      const wl = walls.filter(Boolean);
      wallsByRoom.set(room.id, wl);

      // Placement des ouvertures : position saisie à la main, sinon répartition automatique.
      const rr: Record<string, number> = {};
      const autos = new Map<Wall, Opening[]>();
      const prev = opts.preview;
      for (const o of room.openings) {
        if (o.wall === "plafond" || o.type === "trappe") continue;
        const sill = o.sill ?? defaultSill(o);
        let edgeIdx = o.edge;
        let tt = o.t;
        if (prev && prev.id === o.id) {
          edgeIdx = prev.edge;
          tt = prev.u / Math.max(0.1, walls[prev.edge]?.len ?? 1);
        }
        const manual = edgeIdx != null ? walls[edgeIdx] : undefined;
        if (manual && tt != null && !manual.open) {
          const t = manual.swapped ? 1 - tt : tt;
          manual.placed.push({ o, center: t * manual.len, width: o.width, sill, height: o.height });
          placements.set(o.id, { roomId: room.id, edge: manual.idx, t: tt });
          continue;
        }
        let cand = wl.filter((w) => !w.open && (o.wall === "exterieur" ? w.exterior && !w.passage : !w.exterior));
        if (!cand.length) cand = wl.filter((w) => !w.open);
        if (!cand.length) continue;
        cand = cand.slice().sort((a, b) => b.len - a.len);
        const k = rr[o.wall] ?? 0;
        rr[o.wall] = k + 1;
        const w = cand[k % cand.length];
        autos.set(w, [...(autos.get(w) ?? []), o]);
      }
      for (const [w, list] of autos)
        list.forEach((o, i) => {
          const sill = o.sill ?? defaultSill(o);
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
        if (w.open) continue;
        const holes = w.placed
          .map((p) => ({
            x0: Math.max(0.02, p.center - p.width / 2),
            x1: Math.min(w.len - 0.02, p.center + p.width / 2),
            y0: Math.max(0.002, p.sill),
            y1: Math.min(h - 0.03, p.sill + p.height),
            arch: p.o.type === "arche",
          }))
          .filter((o) => o.x1 - o.x0 > 0.1 && o.y1 - o.y0 > 0.1);
        const geom = track(new THREE.ShapeGeometry(wallShape(w.len, h, holes)));

        let baseMat: THREE.Material;
        if (L.has("peinture") && room.paintWalls && !w.passage) {
          const pc = colorOfPaint(paintW);
          baseMat = srf(pc);
          addLegend(pc, `Peinture murs — ${paintW.name}`);
        } else if (L.has("placo") && room.placoWalls && !w.passage) {
          const sz = S.placo.plaqueSizes?.[w.placoType];
          const sl = sz?.l && sz.l > 0 ? sz.l : S.placo.plaqueL;
          const sw = sz?.w && sz.w > 0 ? sz.w : S.placo.plaqueW;
          const col = PLAQUE_COLOR[w.placoType] ?? PLAQUE_COLOR.ba13;
          baseMat = srfMap(sheetTexture(tex, col, sw, sl));
          addLegend(col, `${PLAQUE_LABEL[w.placoType] ?? "Plaque"} ${sl}×${sw} m (joints et vis visibles)`);
        } else if (L.has("isolation") && w.exterior && !w.passage) {
          const iso = (S.isolants?.length ? S.isolants : ISOLANTS).find((i) => i.id === S.isolation.isolantMurId) ?? ISOLANTS[0];
          const col = isolantColor(iso.name, iso.bio);
          baseMat = srfMap(panelTexture(tex, col, iso.panelL, iso.panelW));
          addLegend(col, `Isolant murs — ${iso.name} ${iso.thickness} mm (panneaux ${iso.panelL}×${iso.panelW} m)`);
        } else if (L.has("placo") && w.passage) {
          baseMat = lam("#d46a6a", { transparent: true, opacity: 0.18, depthWrite: false });
          addLegend("#d46a6a", "Paroi sans plaque");
        } else {
          baseMat = srf(NEUTRAL_WALL);
        }

        const face = new THREE.Mesh(geom, baseMat);
        if (tileBand > 0) {
          baseMat.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -(w.elev + tileBand))];
          const tileMat = srfMap(tileTexture(tex, tileW, jointOf(room), colorOfTile(tileW), groutColor), {
            clippingPlanes: [new THREE.Plane(new THREE.Vector3(0, -1, 0), w.elev + tileBand)],
          });
          const band = new THREE.Mesh(geom, tileMat);
          w.group.add(band);
          addLegend(colorOfTile(tileW), `Faïence — ${withDims(tileW.name, tileW.tileL, tileW.tileW)}, jusqu'à ${tileBand.toFixed(2)} m, joint ${jointOf(room)} mm`);
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

        // menuiseries : cadres, vantaux, vitrage
        for (const p of w.placed) {
          const y0 = Math.max(0.002, p.sill);
          const y1 = Math.min(h - 0.03, p.sill + p.height);
          const x0 = Math.max(0.02, p.center - p.width / 2);
          const x1 = Math.min(w.len - 0.02, p.center + p.width / 2);
          const ow = x1 - x0;
          const oh = y1 - y0;
          if (ow < 0.1 || oh < 0.1) continue;
          const selected = opts.selectedOpening === p.o.id;
          const eg = new THREE.Group();
          eg.userData = { element: "opening", id: p.o.id };
          const isDoor = p.o.type === "porte";
          const isGarage = p.o.type === "porte_garage";
          const interior = isDoor && p.o.wall !== "exterieur";
          const addEl = () => {
            w.group.add(eg);
            elements.push(eg);
          };
          if (p.o.type === "arche") {
            if (selected) {
              const hl = box(ow, oh, 0.01, "#f97316");
              hl.position.set(x0 + ow / 2, y0 + oh / 2, 0.012);
              (hl.material as THREE.MeshLambertMaterial).transparent = true;
              (hl.material as THREE.MeshLambertMaterial).opacity = 0.35;
              eg.add(hl);
            }
            addEl();
            continue;
          }
          if (interior && !L.has("quincaillerie")) {
            if (selected) {
              const hl = box(ow, oh, 0.01, "#f97316");
              hl.position.set(x0 + ow / 2, y0 + oh / 2, 0.012);
              eg.add(hl);
            }
            addEl();
            continue;
          }
          const fc = selected ? "#f97316" : isGarage ? "#cfd3d8" : isDoor ? (interior ? "#e8e4da" : "#5d4a3a") : "#f4f4f2";
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
            eg.add(f);
          }
          if (isGarage) {
            const leaf = box(ow - 0.1, oh - 0.06, 0.04, "#9aa3ad");
            leaf.position.set(x0 + ow / 2, y0 + oh / 2, 0.03);
            eg.add(leaf);
            const panels = Math.max(3, Math.round(oh / 0.5));
            for (let k = 1; k < panels; k++) {
              const ln = box(ow - 0.1, 0.012, 0.045, "#6b7480");
              ln.position.set(x0 + ow / 2, y0 + 0.03 + ((oh - 0.06) * k) / panels, 0.032);
              eg.add(ln);
            }
            addLegend("#9aa3ad", "Porte de garage sectionnelle");
          } else if (isDoor) {
            const leaf = box(ow - 0.1, oh - 0.06, 0.04, interior ? "#f1efe9" : "#6e5846");
            leaf.position.set(x0 + ow / 2, y0 + oh / 2 - 0.01, 0.03);
            eg.add(leaf);
            const hd = box(0.12, 0.02, 0.05, "#9aa0a6");
            hd.position.set(x1 - 0.12, y0 + 1.0, 0.07);
            eg.add(hd);
            if (interior) addLegend("#f1efe9", "Portes intérieures + huisseries");
          } else {
            const glass = new THREE.Mesh(
              track(new THREE.PlaneGeometry(ow - 0.1, oh - 0.1)),
              lam("#a9d3ee", { transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false }),
            );
            glass.position.set(x0 + ow / 2, y0 + oh / 2, 0.02);
            eg.add(glass);
          }
          addEl();
        }
      }

      // Sol
      const floorShape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.y)));
      const fGeom = track(new THREE.ShapeGeometry(floorShape));
      fGeom.rotateX(-Math.PI / 2);
      let fMat: THREE.Material | null = null;
      let layoutDrawn = false;
      // calepinage enregistré : repère en mètres du plan → on applique le décalage d'étage
      const layout = project.tileLayouts?.[room.id];
      const floorTile = resolveTile(S, room, "sol");
      if (!opts.xray && L.has("carrelage") && room.tileFloor) {
        const col = colorOfTile(floorTile);
        const lt = layout && layout.points.length >= 3 ? (S.carrelage.tiles ?? []).find((t) => t.id === layout.tileId) : undefined;
        if (layout && lt) {
          layoutDrawn = true;
          const grout = new THREE.Mesh(fGeom, srf(groutColor));
          grout.position.y = z0 + 0.001;
          root.add(grout);
          const st = computeLayout(layout.points, lt, layout, true);
          const groups: Record<"full" | "cut" | "sliver", THREE.BufferGeometry[]> = { full: [], cut: [], sliver: [] };
          for (const c of st.cells) {
            if (c.poly.length < 3) continue;
            const g = new THREE.ShapeGeometry(new THREE.Shape(c.poly.map((p) => new THREE.Vector2(p.x + fo.x, -(p.y + fo.y)))));
            // coordonnées de texture : la photo du produit est plaquée carreau par carreau (les coupes en montrent la partie posée)
            if (c.o && c.ux && c.uy && c.tl && c.tw) {
              const pos = g.getAttribute("position");
              const uv = new Float32Array(pos.count * 2);
              for (let i = 0; i < pos.count; i++) {
                const wx = pos.getX(i) - fo.x - c.o.x;
                const wy = -pos.getY(i) - fo.y - c.o.y;
                uv[i * 2] = (wx * c.ux.x + wy * c.ux.y) / c.tl;
                uv[i * 2 + 1] = 1 - (wx * c.uy.x + wy * c.uy.y) / c.tw;
              }
              g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
            }
            g.rotateX(-Math.PI / 2);
            groups[c.sliver ? "sliver" : c.full ? "full" : "cut"].push(g);
          }
          const lcol = lt.color ?? (lt.photo ? photoAverageColor(tex, lt.photo) : null) ?? guessTileColor(lt.name);
          const oneTex = singleTileTexture(tex, lcol, lt.photo);
          (["full", "cut", "sliver"] as const).forEach((k, n) => {
            if (!groups[k].length) return;
            const mg = mergeGeometries(groups[k], false);
            groups[k].forEach((g) => g.dispose());
            if (!mg) return;
            // couleur de repérage des coupes : simple teinte multipliée sur la texture réelle
            const tint = !opts.cuts || k === "full" ? "#ffffff" : k === "cut" ? "#ffcf9a" : "#ff8f8f";
            const mat = faithful
              ? track(new THREE.MeshBasicMaterial({ map: oneTex, color: tint }))
              : track(new THREE.MeshLambertMaterial({ map: oneTex, color: tint }));
            const mesh = new THREE.Mesh(track(mg), mat);
            mesh.position.y = z0 + 0.004 + n * 0.0002;
            root.add(mesh);
          });
          addLegend(lcol, `Carrelage sol — ${withDims(lt.name, lt.tileL, lt.tileW)} (calepinage : ${st.total} carreaux, perte ${st.wastePct.toFixed(1)} %, joint ${layout.jointMm} mm)`);
          if (opts.cuts) {
            addLegend("#f0a35c", "Carreaux coupés");
            addLegend("#e05c5c", "Chutes trop étroites");
          }
        } else {
          fMat = srfMap(tileTexture(tex, floorTile, jointOf(room), col, groutColor));
          addLegend(col, `Carrelage sol — ${withDims(floorTile.name, floorTile.tileL, floorTile.tileW)}, joint ${jointOf(room)} mm`);
        }
      } else if (!opts.xray && L.has("quincaillerie") && room.solType === "parquet" && !room.tileFloor) {
        fMat = srfMap(parquetTexture(tex));
        addLegend("#c9a77a", "Parquet");
      } else if (!opts.xray && L.has("peinture") && room.paintFloor) {
        fMat = srf("#7b8794");
        addLegend("#7b8794", "Peinture de sol");
      } else if (L.has("isolation") && room.floorHeating) {
        const iso = (S.isolants?.length ? S.isolants : ISOLANTS).find((i) => i.id === S.isolation.isolantSolId) ?? ISOLANTS[0];
        const col = isolantColor(iso.name, iso.bio);
        fMat = srfMap(panelTexture(tex, col, iso.panelL, iso.panelW));
        addLegend(col, `Isolant sous plancher chauffant — ${iso.name} ${iso.thickness} mm`);
      } else {
        fMat = srf(NEUTRAL_FLOOR, opts.xray ? { transparent: true, opacity: 0.55 } : {});
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
        let cMat: THREE.Material;
        if (L.has("peinture") && room.paintCeiling) {
          const pc = resolvePaint(S, room, "plafond");
          const cc = colorOfPaint({ color: pc.color, photo: pc.photo });
          cMat = srf(cc);
          addLegend(cc, `Peinture plafond — ${pc.name}`);
        } else if (L.has("placo") && room.placoCeiling) {
          const type = room.placoType === "hydro" ? "hydro" : "ba13";
          const sz = S.placo.plaqueSizes?.[type];
          const sl = sz?.l && sz.l > 0 ? sz.l : S.placo.plaqueL;
          const sw = sz?.w && sz.w > 0 ? sz.w : S.placo.plaqueW;
          cMat = srfMap(sheetTexture(tex, PLAQUE_COLOR[type], sl, sw));
          addLegend(PLAQUE_COLOR[type], `Plafond placo — plaques ${sl}×${sw} m`);
        } else cMat = srf("#f2f0ea");
        const cm = new THREE.Mesh(cGeom, cMat);
        cm.position.y = z0 + h - 0.001;
        root.add(cm);
      }
    }
  }

  const wallsOf = (room: Room) => (wallsByRoom.get(room.id) ?? []).filter((w) => !w.passage && !w.open && w.len > 0.4);

  const floorOfRoom = new Map<string, Floor>();
  for (const f of project.floors) for (const r of f.rooms) floorOfRoom.set(r.id, f);

  const mkFixture = (room: Room, kind: FixtureKind, edge: number, u: number, n: number, extra: Partial<Fixture> = {}): Fixture => {
    const sp = FIXTURE_SPEC[kind];
    return { id: `auto:${room.id}:${kind}:${n}`, kind, edge, u, z: sp.z, w: sp.w, d: sp.d, h: sp.h, ...extra };
  };

  /** Répartit `count` éléments le long du périmètre d'une pièce en évitant les ouvertures (répartition automatique). */
  const spread = (room: Room, kind: FixtureKind, count: number, startFrac: number, out: Fixture[]) => {
    const ws = wallsOf(room);
    const total = ws.reduce((a, w) => a + w.len, 0);
    if (!ws.length || count <= 0) return;
    const z = FIXTURE_SPEC[kind].z;
    for (let i = 0; i < count; i++) {
      let sPos = ((i + 0.5) / count + startFrac) * total;
      sPos = ((sPos % total) + total) % total;
      let acc = 0;
      for (const w of ws) {
        if (sPos <= acc + w.len || w === ws[ws.length - 1]) {
          let u = Math.min(Math.max(sPos - acc, 0.15), w.len - 0.15);
          for (const p of w.placed) {
            const x0 = p.center - p.width / 2 - 0.12;
            const x1 = p.center + p.width / 2 + 0.12;
            if (z < p.sill + p.height && u > x0 && u < x1) u = u - x0 < x1 - u ? Math.max(0.1, x0) : Math.min(w.len - 0.1, x1);
          }
          out.push(mkFixture(room, kind, w.idx, w.swapped ? w.len - u : u, out.length));
          break;
        }
        acc += w.len;
      }
    }
  };

  const autoElec = (room: Room, firstOfFloor: boolean): Fixture[] => {
    const out: Fixture[] = [];
    const d = defaultElec(room);
    spread(room, "prise", d.prisesSimples, 0, out);
    spread(room, "prise_double", d.prisesDoubles, 0.03, out);
    spread(room, "prise_triple", d.prisesTriples, 0.06, out);
    const doors = (wallsByRoom.get(room.id) ?? []).filter((w) => !w.open).flatMap((w) => w.placed.filter((p) => p.o.type === "porte").map((p) => ({ w, p })));
    const interKinds: FixtureKind[] = [
      ...Array<FixtureKind>(Math.max(0, d.intersSimples + d.vaEtVient)).fill("inter"),
      ...Array<FixtureKind>(d.intersDoubles).fill("inter_double"),
      ...Array<FixtureKind>(Math.max(0, d.poussoirs)).fill("poussoir"),
    ];
    if (doors.length) {
      interKinds.forEach((kind, i) => {
        const { w, p } = doors[i % doors.length];
        const u = Math.min(w.len - 0.1, p.center + p.width / 2 + 0.14 + Math.floor(i / doors.length) * 0.1);
        out.push(mkFixture(room, kind, w.idx, w.swapped ? w.len - u : u, out.length));
      });
    } else {
      const byKind = new Map<FixtureKind, number>();
      interKinds.forEach((k) => byKind.set(k, (byKind.get(k) ?? 0) + 1));
      for (const [k, n] of byKind) spread(room, k, n, 0.1, out);
    }
    spread(room, "rj45", d.rj45, 0.15, out);
    spread(room, "tv", d.tv, 0.2, out);
    spread(room, "hdmi", d.hdmi, 0.25, out);
    spread(room, "derivation", d.boitesDerivation, 0.35, out);
    if (firstOfFloor) {
      const ws = wallsOf(room);
      if (ws.length) {
        const u = Math.min(ws[0].len - 0.3, 0.5);
        out.push(mkFixture(room, "tableau", ws[0].idx, ws[0].swapped ? ws[0].len - u : u, out.length));
      }
    }
    return out;
  };

  const autoSanitary = (room: Room): Fixture[] => {
    const out: Fixture[] = [];
    const ws = wallsOf(room).slice().sort((a, b) => b.len - a.len);
    if (!ws.length) return out;
    const order: FixtureKind[] = ["evier", "baignoire", "receveur", "paroi_douche", "meuble_vasque", "vasque", "wc", "bati_wc", "lave_mains", "lave_linge", "seche_serviettes", "miroir", "radiateur"];
    const kinds = sanitaryKindsFromMaterials(project, room).sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const cursor = new Map<Wall, number>();
    kinds.forEach((kind, i) => {
      const sp = FIXTURE_SPEC[kind];
      if (kind === "paroi_douche") {
        const rec = [...out].reverse().find((f) => f.kind === "receveur");
        if (rec) {
          out.push(mkFixture(room, kind, rec.edge, rec.u, i, { w: rec.w, d: rec.d }));
          return;
        }
      }
      if (kind === "vasque") {
        const mv = [...out].reverse().find((f) => f.kind === "meuble_vasque");
        if (mv) {
          out.push(mkFixture(room, kind, mv.edge, mv.u, i, { w: Math.min(sp.w, mv.w), d: Math.min(sp.d, mv.d) }));
          return;
        }
      }
      let wall = ws.find((w) => (cursor.get(w) ?? 0.12) + sp.w <= w.len - 0.1);
      if (!wall) wall = ws[0];
      let u = cursor.get(wall) ?? 0.12;
      const hanging = sp.z > 0.2;
      for (const p of wall.placed) {
        const x0 = p.center - p.width / 2 - 0.05;
        const x1 = p.center + p.width / 2 + 0.05;
        if (!hanging && u < x1 && u + sp.w > x0 && p.sill < sp.h) u = x1;
      }
      const c = Math.min(wall.len - sp.w / 2, u + sp.w / 2);
      out.push(mkFixture(room, kind, wall.idx, wall.swapped ? wall.len - c : c, i));
      cursor.set(wall, u + sp.w + 0.05);
    });
    return out;
  };

  const ceilingPoints = (room: Room, floor: Floor, n: number) => {
    const sc = floor.planScale || 40;
    const fo2 = offOf(floor);
    const pts = pointsForRoom(room, sc).map((p) => ({ x: p.x / sc + fo2.x, y: p.y / sc + fo2.y }));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const cand: { x: number; y: number }[] = [];
    for (let x = Math.min(...xs) + 0.4; x < Math.max(...xs); x += 0.5)
      for (let y = Math.min(...ys) + 0.4; y < Math.max(...ys); y += 0.5) if (inPoly({ x, y }, pts)) cand.push({ x, y });
    if (!cand.length) return [{ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }];
    if (n >= cand.length) return cand;
    return Array.from({ length: n }, (_, i) => cand[Math.floor(((i + 0.5) * cand.length) / n)]);
  };

  // ───────────── Éléments muraux : prises, interrupteurs, sanitaire… (saisis à la main ou répartis automatiquement) ─────────────
  const needElec = L.has("electricite") || !!opts.fixturesAll;
  const needSani = L.has("sanitaire") || !!opts.fixturesAll;
  for (const floor of floors) {
    let firstRoom = true;
    for (const room of floor.rooms) {
      if (!wallsByRoom.has(room.id)) continue;
      let list: Fixture[];
      if (room.fixtures) list = room.fixtures;
      else {
        autoRooms.add(room.id);
        list = [...(needElec ? autoElec(room, firstRoom && !(floor.elecDevices ?? []).length) : []), ...(needSani ? autoSanitary(room) : [])];
      }
      firstRoom = false;
      fixturesOut.set(room.id, list);
      const manual = !!room.fixtures;
      const planDevices = (floor.elecDevices ?? []).length > 0;
      const waterKinds = new Set<FixtureKind>(["evier", "baignoire", "meuble_vasque", "lave_mains", "lave_linge", "wc", "bati_wc"]);
      for (const f0 of list) {
        const sp = FIXTURE_SPEC[f0.kind];
        if (!sp) continue;
        if (sp.elec ? !L.has("electricite") || (planDevices && !manual) : !L.has("sanitaire")) continue;
        const f = opts.preview && opts.preview.id === f0.id ? { ...f0, edge: opts.preview.edge, u: opts.preview.u } : f0;
        const wall = wallsByRoom.get(room.id)?.[f.edge];
        if (!wall || wall.open) continue;
        const u = Math.min(wall.len - 0.02, Math.max(0.02, wall.swapped ? wall.len - f.u : f.u));
        const selected = opts.selectedFixture === f.id;
        const eg = new THREE.Group();
        eg.userData = { element: "fixture", id: f.id, roomId: room.id };
        const glass = f.kind === "paroi_douche";
        const m = box(f.w, f.h, f.d, selected ? "#f97316" : sp.color);
        if (glass) {
          const mat = m.material as THREE.MeshLambertMaterial;
          mat.transparent = true;
          mat.opacity = selected ? 0.5 : 0.22;
          mat.depthWrite = false;
        }
        m.position.set(u, sp.elec ? f.z : f.z + f.h / 2, f.d / 2 + 0.012);
        eg.add(m);
        if (waterKinds.has(f.kind) && L.has("sanitaire")) {
          for (const [dx, col] of [[-0.05, "#2563eb"], [0.05, "#dc2626"]] as const) {
            const t = tube([new THREE.Vector3(u + dx, 0, 0.03), new THREE.Vector3(u + dx, 0.6, 0.03)], 0.011, col);
            if (t) eg.add(t);
          }
        }
        wall.group.add(eg);
        elements.push(eg);
        addLegend(sp.color, f.label ?? sp.label);
      }
    }
  }
  if (L.has("sanitaire")) {
    addLegend("#2563eb", "Arrivées d'eau froide");
    addLegend("#dc2626", "Arrivées d'eau chaude");
    notes.push("Les appareils sanitaires viennent des matériaux prévus dans chaque pièce. Place-les et ajuste leur taille dans « Éléments de mur » ci-dessous.");
  }

  // ───────────── Électricité : appareillage posé sur le plan, points lumineux, câbles ─────────────
  if (L.has("electricite")) {
    const devColor = (k: ElecDevice["kind"]) => kindInfo(k).color;
    for (const floor of floors) {
      const sc = floor.planScale || 40;
      const z0 = elev.get(floor.id) ?? 0;
      const fo = offOf(floor);
      const placed = floor.elecDevices ?? [];
      if (placed.length) {
        for (const d of placed) {
          const ceil = kindInfo(d.kind).z === "plafond";
          const m = ceil
            ? new THREE.Mesh(track(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 14)), lam(devColor(d.kind)))
            : box(d.kind === "tableau" ? 0.4 : d.kind === "derivation" ? 0.12 : 0.09, d.kind === "tableau" ? 0.6 : 0.09, d.kind === "tableau" ? 0.15 : 0.04, devColor(d.kind));
          m.position.set(d.x / sc + fo.x, z0 + d.z, d.y / sc + fo.y);
          root.add(m);
        }
        addLegend("#1d4ed8", "Appareillage posé sur le plan électrique");
        continue;
      }
      for (const room of floor.rooms) {
        const d = defaultElec(room);
        const lights = ceilingPoints(room, floor, d.dcl + d.spots);
        lights.slice(0, d.dcl + d.spots).forEach((p, i) => {
          const isSpot = i >= d.dcl;
          const m = new THREE.Mesh(track(new THREE.CylinderGeometry(isSpot ? 0.045 : 0.08, isSpot ? 0.045 : 0.08, 0.025, 14)), lam("#ca8a04"));
          m.position.set(p.x, z0 + room.height - 0.015, p.y);
          root.add(m);
        });
      }
    }
    addLegend("#ca8a04", "Points lumineux et spots au plafond");
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
        const fo = offOf(f);
        const zz = (elev.get(f.id) ?? 0) + (ref ? ref.d.z : run.routeMode === "plafond" ? f.height - 0.15 : run.routeMode === "sol" ? 0.1 : run.routeZ);
        const v = new THREE.Vector3((ref ? ref.d.x : p.x) / sc + fo.x, zz, (ref ? ref.d.y : p.y) / sc + fo.y);
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
    if (!floors.some((f) => (f.elecDevices ?? []).length)) notes.push("Aucun appareillage posé sur le plan électrique : les prises et interrupteurs sont répartis automatiquement ; personnalise-les dans « Éléments de mur ».");
    void DEVICE_KINDS;
  }

  // ───────────── VMC ─────────────
  if (L.has("vmc")) {
    const hasPlan = project.floors.some((f) => (f.vmcDevices ?? []).length > 0);
    if (hasPlan) {
      const an = analyzeVmc(project);
      const COL = { ok: "#16a34a", warn: "#d97706", error: "#dc2626" };
      for (const floor of floors) {
        const sc = floor.planScale || 40;
        const fo = offOf(floor);
        const z0 = (elev.get(floor.id) ?? 0) + floor.height - 0.2;
        for (const d of floor.vmcDevices ?? []) {
          let m: THREE.Mesh;
          if (d.kind === "caisson") m = box(0.6, 0.4, 0.4, "#1e293b");
          else if (d.kind === "te") m = box(0.12, 0.12, 0.12, "#e5e7eb");
          else m = new THREE.Mesh(track(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 16)), lam(d.kind === "extraction" ? "#ef4444" : "#3b82f6"));
          m.position.set(d.x / sc + fo.x, z0, d.y / sc + fo.y);
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
            const fo = offOf(f);
            return new THREE.Vector3(p.x / sc + fo.x, (elev.get(f.id) ?? 0) + f.height - 0.2, p.y / sc + fo.y);
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
      const fo = offOf(floor);
      const z0 = (elev.get(floor.id) ?? 0) + 0.012;
      for (const room of floor.rooms) {
        if (!room.floorHeating) continue;
        const covered =
          !opts.xray &&
          ((L.has("carrelage") && room.tileFloor) || (L.has("quincaillerie") && room.solType === "parquet" && !room.tileFloor) || (L.has("peinture") && room.paintFloor));
        if (covered) continue;
        const pts = pointsForRoom(room, sc).map((p) => ({ x: p.x / sc + fo.x, y: p.y / sc + fo.y }));
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
  if (wallsInfo.size && [...wallsInfo.values()].some((w) => w.open)) notes.push("Les passages ouverts (pièces ouvertes l'une sur l'autre) n'ont aucune cloison dans la vue 3D.");
  if (project.floors.length > 1 && opts.floorId === "all") notes.push("Les étages sont superposés d'après leur décalage réglé dans « Plans & pièces » (Superposition des étages).");
  return { root, pickables, box: bbox, legend, notes, placements, fixtures: fixturesOut, autoRooms, walls: wallsInfo, elements, dispose };
}

function resolveTileColor(catalog: Project["settings"]["carrelage"]["tiles"], t: ResolvedTile, ctx?: TexCtx): string {
  const p = (catalog ?? []).find((x) => x.id === t.id);
  if (p?.color) return p.color;
  const fromPhoto = t.photo && ctx ? photoAverageColor(ctx, t.photo) : null;
  return fromPhoto ?? guessTileColor(t.name);
}
