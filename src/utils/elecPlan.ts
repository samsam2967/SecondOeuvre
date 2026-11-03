import type { ElecDevice, ElecDeviceKind, ElecRun, Floor, Project, Room } from "../types";
import { dist, pointsForRoom } from "./geometry";

/** Types d'éléments posables sur le plan : libellé, couleur, hauteur par défaut (m, « plafond » = sous plafond). */
export const DEVICE_KINDS: {
  id: ElecDeviceKind;
  label: string;
  short: string;
  color: string;
  z: number | "plafond";
}[] = [
  { id: "tableau", label: "Tableau électrique", short: "TE", color: "#111827", z: 1.6 },
  { id: "prise", label: "Prise 16 A", short: "P", color: "#1d4ed8", z: 0.3 },
  { id: "prise_double", label: "Prise double", short: "P2", color: "#1d4ed8", z: 0.3 },
  { id: "prise_triple", label: "Prise triple", short: "P3", color: "#1d4ed8", z: 0.3 },
  { id: "inter", label: "Interrupteur simple / poussoir", short: "I", color: "#b45309", z: 1.1 },
  { id: "inter_double", label: "Interrupteur double", short: "I2", color: "#b45309", z: 1.1 },
  { id: "va_et_vient", label: "Va-et-vient", short: "VV", color: "#b45309", z: 1.1 },
  { id: "poussoir", label: "Bouton poussoir", short: "BP", color: "#b45309", z: 1.1 },
  { id: "dcl", label: "Point lumineux (DCL)", short: "L", color: "#ca8a04", z: "plafond" },
  { id: "spot", label: "Spot encastré", short: "S", color: "#ca8a04", z: "plafond" },
  { id: "rj45", label: "Prise RJ45", short: "RJ", color: "#0f766e", z: 0.3 },
  { id: "tv", label: "Prise TV", short: "TV", color: "#0f766e", z: 0.3 },
  { id: "derivation", label: "Boîte de dérivation", short: "BD", color: "#7c3aed", z: 2.3 },
  { id: "specialise", label: "Point spécialisé (four, lave-linge…)", short: "SP", color: "#be123c", z: 0.3 },
];

export const kindInfo = (k: ElecDeviceKind) => DEVICE_KINDS.find((d) => d.id === k) ?? DEVICE_KINDS[1];

export function defaultDeviceZ(kind: ElecDeviceKind, floor: Floor): number {
  const z = kindInfo(kind).z;
  return z === "plafond" ? Math.max(1, floor.height - 0.05) : z;
}

/** Valeurs par défaut d'un trajet selon son usage. */
export const RUN_TYPES: Record<ElecRun["type"], { label: string; section: ElecRun["section"]; gaineMm: ElecRun["gaineMm"]; color: string }> = {
  prises: { label: "Prises", section: "2.5", gaineMm: 20, color: "#1d4ed8" },
  eclairage: { label: "Éclairage", section: "1.5", gaineMm: 16, color: "#ca8a04" },
  specialise: { label: "Spécialisé", section: "2.5", gaineMm: 25, color: "#be123c" },
  cuisson: { label: "Plaque de cuisson", section: "6", gaineMm: 25, color: "#9a3412" },
};

export function newRun(id: string, name: string, type: ElecRun["type"] = "prises"): ElecRun {
  const t = RUN_TYPES[type];
  return {
    id,
    name,
    type,
    section: t.section,
    gaine: true,
    gaineMm: t.gaineMm,
    routeMode: type === "eclairage" ? "plafond" : "sol",
    routeZ: 1,
    ortho: true,
    points: [],
  };
}

/** Point dans un polygone (pixels du plan). */
export function inPoly(p: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function roomAt(floor: Floor, p: { x: number; y: number }): Room | undefined {
  const scale = floor.planScale || 40;
  return floor.rooms.find((r) => inPoly(p, pointsForRoom(r, scale)));
}

/** Altitude du sol fini de chaque étage (m), en empilant les étages par niveau. */
export function floorElevations(floors: Floor[], slabM: number): Map<string, number> {
  const out = new Map<string, number>();
  let z = 0;
  for (const f of [...floors].sort((a, b) => a.level - b.level)) {
    out.set(f.id, z);
    z += f.height + slabM;
  }
  return out;
}

export function routeZFor(run: ElecRun, floor: Floor): number {
  if (run.routeMode === "plafond") return Math.max(0.5, floor.height - 0.15);
  if (run.routeMode === "sol") return 0.1;
  return run.routeZ;
}

export interface RunMetrics {
  runId: string;
  /** Longueur du trajet, sans réserve (m). */
  path: number;
  /** Réserve aux boîtiers (m). */
  slack: number;
  /** Longueur de câble = trajet + réserve (m), sans pertes. */
  cable: number;
  /** Longueur de gaine (m) : le trajet, si le circuit est sous gaine. */
  gaine: number;
  devices: number;
  /** Dont montées / descentes verticales (m). */
  vertical: number;
}

export interface ElecPlanTotals {
  runs: RunMetrics[];
  cable: Record<"1.5" | "2.5" | "6", number>;
  gaine: Record<"16" | "20" | "25", number>;
  perRoom: Record<string, { cable: Record<"1.5" | "2.5" | "6", number>; gaine: Record<"16" | "20" | "25", number> }>;
  /** Mètres de câble / gaine qui ne tombent dans aucune pièce (couloir technique, hors plan…). */
  unassigned: { cable: number; gaine: number };
}

const zeroCable = () => ({ "1.5": 0, "2.5": 0, "6": 0 }) as Record<"1.5" | "2.5" | "6", number>;
const zeroGaine = () => ({ "16": 0, "20": 0, "25": 0 }) as Record<"16" | "20" | "25", number>;

/** Calcule longueurs de câble et de gaine de tous les trajets tracés, avec ventilation par pièce. */
export function elecPlanTotals(project: Project): ElecPlanTotals {
  const S = project.settings.elec;
  const runs = project.elecRuns ?? [];
  const floorById = new Map(project.floors.map((f) => [f.id, f]));
  const elev = floorElevations(project.floors, S.slabM ?? 0.3);
  const devById = new Map<string, { dev: ElecDevice; floorId: string }>();
  for (const f of project.floors) for (const d of f.elecDevices ?? []) devById.set(d.id, { dev: d, floorId: f.id });

  const totals: ElecPlanTotals = {
    runs: [],
    cable: zeroCable(),
    gaine: zeroGaine(),
    perRoom: {},
    unassigned: { cable: 0, gaine: 0 },
  };
  const bucket = (roomId: string | undefined) => {
    if (!roomId) return null;
    return (totals.perRoom[roomId] ??= { cable: zeroCable(), gaine: zeroGaine() });
  };

  for (const run of runs) {
    // Position et altitude absolue de chaque point (un élément suit sa position actuelle sur le plan).
    const pts = run.points
      .map((p) => {
        const ref = p.deviceId ? devById.get(p.deviceId) : undefined;
        if (p.deviceId && !ref) return null; // élément supprimé : le point disparaît du trajet
        const floorId = ref ? ref.floorId : p.floorId;
        const floor = floorById.get(floorId);
        if (!floor) return null;
        const x = ref ? ref.dev.x : p.x;
        const y = ref ? ref.dev.y : p.y;
        const zLocal = ref ? ref.dev.z : routeZFor(run, floor);
        return { floor, x, y, zAbs: (elev.get(floorId) ?? 0) + zLocal, isDevice: !!ref };
      })
      .filter((p): p is NonNullable<typeof p> => !!p);

    let path = 0;
    let vertical = 0;
    const cable = run.section;
    const gKey = String(run.gaineMm) as "16" | "20" | "25";

    const add = (roomId: string | undefined, pathM: number, slackM: number) => {
      const b = bucket(roomId);
      if (b) {
        b.cable[cable] += pathM + slackM;
        if (run.gaine) b.gaine[gKey] += pathM;
      } else {
        totals.unassigned.cable += pathM + slackM;
        if (run.gaine) totals.unassigned.gaine += pathM;
      }
    };

    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const v = Math.abs(a.zAbs - b.zAbs);
      let h = 0;
      let roomId: string | undefined;
      if (a.floor.id === b.floor.id) {
        const sc = a.floor.planScale || 40;
        h = run.ortho ? (Math.abs(a.x - b.x) + Math.abs(a.y - b.y)) / sc : dist(a, b) / sc;
        roomId = roomAt(a.floor, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })?.id;
      } else {
        // Changement d'étage : on suppose que le câble passe par la trémie (points alignés), seule la hauteur compte.
        const lower = a.zAbs <= b.zAbs ? a : b;
        roomId = roomAt(lower.floor, lower)?.id;
      }
      path += h + v;
      vertical += v;
      add(roomId, h + v, 0);
    }

    // Réserve de câble à chaque boîtier.
    const slackEach = S.slackPerEndM ?? 0.3;
    let devices = 0;
    for (const p of pts) {
      if (!p.isDevice) continue;
      devices++;
      add(roomAt(p.floor, p)?.id, 0, slackEach);
    }
    const slack = devices * slackEach;

    totals.runs.push({
      runId: run.id,
      path,
      slack,
      cable: path + slack,
      gaine: run.gaine ? path : 0,
      devices,
      vertical,
    });
    totals.cable[cable] += path + slack;
    if (run.gaine) totals.gaine[gKey] += path;
  }
  return totals;
}

/** Nombre de points de la norme que représente un élément posé (double = 2, triple = 3). */
export function devicePoints(kind: ElecDeviceKind): number {
  return kind === "prise_double" || kind === "inter_double" ? 2 : kind === "prise_triple" ? 3 : 1;
}
