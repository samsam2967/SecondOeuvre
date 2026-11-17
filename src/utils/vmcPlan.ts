import { ROOM_TYPES } from "../data/catalogs";
import type { Floor, Project, VmcDevice, VmcLimits, VmcPlan, VmcRun } from "../types";
import { floorElevations, roomAt } from "./elecPlan";

export const DIAMS = [80, 125, 160] as const;
export type Status = "ok" | "warn" | "error";

export const defaultLimits: VmcLimits = {
  maxLen: { 80: 10, 125: 15, 160: 20 },
  maxTotal: 25,
  vMax: 5,
  bendK: 20,
  flexFactor: 1.3,
};
export const emptyVmcPlan = (): VmcPlan => ({ runs: [], limits: structuredClone(defaultLimits) });

export function defaultFlow(kind: VmcDevice["kind"], roomType?: string): number {
  if (kind === "insufflation") return roomType === "salon" || roomType === "sejour" ? 45 : 30;
  const m: Record<string, number> = { cuisine: 90, sdb: 45, sde: 45, wc: 30, buanderie: 30 };
  return m[roomType ?? ""] ?? 30;
}
export const deviceFlow = (d: VmcDevice, f: Floor) => d.flow ?? defaultFlow(d.kind, roomAt(f, d)?.type);

export interface RunInfo {
  id: string;
  length: number;
  bends: number;
  /** Longueur équivalente : longueur × facteur gaine souple + pertes des coudes. */
  leq: number;
  flow: number;
  velocity: number;
  recDiam: number;
  status: Status;
  msgs: string[];
  path: { floorId: string; x: number; y: number }[];
}
export interface Issue {
  level: Status;
  text: string;
  ref?: string;
}
export interface VmcAnalysis {
  runs: Record<string, RunInfo>;
  devStatus: Record<string, Status>;
  issues: Issue[];
  totals: { 80: number; 125: number; 160: number };
  bends: number;
  flowIn: number;
  flowOut: number;
  ok: boolean;
}

export function analyzeVmc(project: Project): VmcAnalysis {
  const plan = project.vmcPlan ?? emptyVmcPlan();
  const L: VmcLimits = { ...defaultLimits, ...plan.limits, maxLen: { ...defaultLimits.maxLen, ...(plan.limits?.maxLen ?? {}) } };
  const floors = project.floors;
  const elev = floorElevations(floors, project.settings.elec.slabM ?? 0.3);
  const devs = new Map<string, { dev: VmcDevice; floor: Floor }>();
  for (const f of floors) for (const d of f.vmcDevices ?? []) devs.set(d.id, { dev: d, floor: f });
  const runs = plan.runs.filter((r) => devs.has(r.fromId) && devs.has(r.toId));
  const issues: Issue[] = [];
  const push = (level: Status, text: string, ref?: string) => issues.push({ level, text, ref });
  const devName = (id: string) => {
    const d = devs.get(id)!;
    const k = { caisson: "Caisson", extraction: "Bouche d'extraction", insufflation: "Bouche d'insufflation", te: "Té" }[d.dev.kind];
    const room = roomAt(d.floor, d.dev)?.name;
    return `${d.dev.label || k}${room ? ` (${room})` : ""}`;
  };

  // Débit véhiculé par chaque gaine : somme des bouches en aval.
  const memo = new Map<string, number>();
  const flowOf = (r: VmcRun, seen = new Set<string>()): number => {
    if (memo.has(r.id)) return memo.get(r.id)!;
    if (seen.has(r.id)) return 0;
    seen.add(r.id);
    const to = devs.get(r.toId)!;
    const q = to.dev.kind === "te" ? runs.filter((x) => x.fromId === to.dev.id).reduce((s, x) => s + flowOf(x, seen), 0) : deviceFlow(to.dev, to.floor);
    memo.set(r.id, q);
    return q;
  };

  const zOf = (f: Floor) => (elev.get(f.id) ?? 0) + f.height - 0.2;
  const info: Record<string, RunInfo> = {};
  const totals = { 80: 0, 125: 0, 160: 0 };
  let bendsTotal = 0;

  for (const r of runs) {
    const a0 = devs.get(r.fromId)!;
    const b0 = devs.get(r.toId)!;
    type P = { floor: Floor; x: number; y: number; z: number };
    const raw: P[] = [
      { floor: a0.floor, x: a0.dev.x, y: a0.dev.y, z: zOf(a0.floor) },
      ...r.points.map((p) => {
        const f = floors.find((x) => x.id === p.floorId) ?? a0.floor;
        return { floor: f, x: p.x, y: p.y, z: zOf(f) };
      }),
      { floor: b0.floor, x: b0.dev.x, y: b0.dev.y, z: zOf(b0.floor) },
    ];
    const pts: P[] = [];
    raw.forEach((p, i) => {
      if (i > 0) {
        const a = raw[i - 1];
        if (r.ortho && a.floor.id === p.floor.id && Math.abs(a.x - p.x) > 1 && Math.abs(a.y - p.y) > 1) pts.push({ ...p, x: p.x, y: a.y });
      }
      pts.push(p);
    });
    let length = 0;
    let bends = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (a.floor.id === b.floor.id) length += Math.hypot(b.x - a.x, b.y - a.y) / (a.floor.planScale || 40);
      else {
        length += Math.abs(b.z - a.z);
        bends += 2;
      }
    }
    for (let i = 2; i < pts.length; i++) {
      const [a, b, c] = [pts[i - 2], pts[i - 1], pts[i]];
      if (a.floor.id !== b.floor.id || b.floor.id !== c.floor.id) continue;
      const v1 = { x: b.x - a.x, y: b.y - a.y };
      const v2 = { x: c.x - b.x, y: c.y - b.y };
      const n = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
      if (n > 0 && (v1.x * v2.x + v1.y * v2.y) / n < Math.cos((25 * Math.PI) / 180)) bends++;
    }
    const D = r.diameter / 1000;
    const leq = length * (r.flexible ? L.flexFactor : 1) + bends * L.bendK * D;
    const flow = flowOf(r);
    const vel = flow / 3600 / (Math.PI * D * D / 4);
    const recDiam = DIAMS.find((d) => flow / 3600 / (Math.PI * (d / 1000) ** 2 / 4) <= L.vMax) ?? 160;
    const msgs: string[] = [];
    const lv: Status[] = [];
    let status: Status = "ok";
    const rank = { ok: 0, warn: 1, error: 2 };
    const raise = (s: Status, m: string) => {
      msgs.push(m);
      lv.push(s);
      if (rank[s] > rank[status]) status = s;
    };
    const max = L.maxLen[r.diameter];
    const name = `${devName(r.fromId)} → ${devName(r.toId)}`;
    if (leq > max) raise("error", `Gaine trop longue : ${leq.toFixed(1)} m équivalents pour ${max} m max en Ø${r.diameter}.`);
    else if (leq > max * 0.85) raise("warn", `Proche de la limite : ${leq.toFixed(1)} m / ${max} m en Ø${r.diameter}.`);
    if (vel > L.vMax * 1.2) raise("error", `Vitesse d'air ${vel.toFixed(1)} m/s (max ${L.vMax}) : passe en Ø${recDiam}.`);
    else if (vel > L.vMax) raise("warn", `Vitesse d'air ${vel.toFixed(1)} m/s (max ${L.vMax}) : Ø${recDiam} conseillé.`);
    if (b0.dev.kind === "te") {
      const maxChild = Math.max(0, ...runs.filter((x) => x.fromId === b0.dev.id).map((x) => x.diameter));
      if (r.diameter < maxChild) raise("warn", `Le tronc (Ø${r.diameter}) est plus petit que ses branches (Ø${maxChild}).`);
    }
    info[r.id] = { id: r.id, length, bends, leq, flow, velocity: vel, recDiam, status, msgs, path: pts.map((p) => ({ floorId: p.floor.id, x: p.x, y: p.y })) };
    totals[r.diameter] += length;
    bendsTotal += bends;
    msgs.forEach((m, i) => push(lv[i], `${name} — ${m}`, r.id));
  }

  // Parcours caisson → bouche
  const devStatus: Record<string, Status> = {};
  const caissons = [...devs.values()].filter((d) => d.dev.kind === "caisson");
  const bouches = [...devs.values()].filter((d) => d.dev.kind === "extraction" || d.dev.kind === "insufflation");
  if (caissons.length === 0) push("error", "Aucun caisson (moteur) placé sur le plan.");
  if (caissons.length > 1) push("warn", `${caissons.length} caissons placés : vérifie que c'est voulu (un seul pour une maison standard).`);
  if (bouches.length === 0) push("error", "Aucune bouche placée.");
  for (const b of bouches) {
    let id = b.dev.id;
    let total = 0;
    let reached = false;
    for (let g = 0; g < 20; g++) {
      const r = runs.find((x) => x.toId === id);
      if (!r) break;
      total += info[r.id].leq;
      const from = devs.get(r.fromId)!.dev;
      if (from.kind === "caisson") {
        reached = true;
        break;
      }
      id = from.id;
    }
    if (!reached) {
      devStatus[b.dev.id] = "error";
      push("error", `${devName(b.dev.id)} n'est reliée à aucun caisson.`, b.dev.id);
    } else if (total > L.maxTotal) {
      devStatus[b.dev.id] = "error";
      push("error", `${devName(b.dev.id)} : ${total.toFixed(1)} m équivalents depuis le caisson (max ${L.maxTotal} m).`, b.dev.id);
    } else if (total > L.maxTotal * 0.85) {
      devStatus[b.dev.id] = "warn";
      push("warn", `${devName(b.dev.id)} : ${total.toFixed(1)} m depuis le caisson, proche de la limite (${L.maxTotal} m).`, b.dev.id);
    } else devStatus[b.dev.id] = "ok";
  }
  for (const t of [...devs.values()].filter((d) => d.dev.kind === "te")) {
    if (!runs.some((r) => r.toId === t.dev.id)) push("warn", `${devName(t.dev.id)} n'est alimenté par aucune gaine.`, t.dev.id);
    if (!runs.some((r) => r.fromId === t.dev.id)) push("warn", `${devName(t.dev.id)} ne dessert aucune bouche.`, t.dev.id);
  }

  // Couverture des pièces
  const dbl = project.settings.vmc.type === "double_flux";
  for (const f of floors)
    for (const room of f.rooms) {
      const wet = ROOM_TYPES.find((t) => t.id === room.type)?.wet && room.type !== "cellier";
      const dry = ["salon", "sejour", "chambre", "bureau", "salle_manger"].includes(room.type);
      const here = (k: VmcDevice["kind"]) => (f.vmcDevices ?? []).some((d) => d.kind === k && roomAt(f, d)?.id === room.id);
      if (wet && !here("extraction")) push("warn", `${room.name} : pièce humide sans bouche d'extraction.`);
      if (dbl && dry && !here("insufflation")) push("warn", `${room.name} : pièce sèche sans bouche d'insufflation (double flux).`);
    }
  const flowIn = bouches.filter((b) => b.dev.kind === "insufflation").reduce((s, b) => s + deviceFlow(b.dev, b.floor), 0);
  const flowOut = bouches.filter((b) => b.dev.kind === "extraction").reduce((s, b) => s + deviceFlow(b.dev, b.floor), 0);
  if (dbl && flowOut > 0 && Math.abs(flowIn - flowOut) / flowOut > 0.15) push("warn", `Débits déséquilibrés en double flux : insufflation ${flowIn} m³/h, extraction ${flowOut} m³/h (écart > 15 %).`);

  const ok = !issues.some((i) => i.level === "error") && caissons.length > 0 && bouches.length > 0;
  if (ok && issues.length === 0) push("ok", "Tout est conforme aux limites réglées : longueurs, vitesses et raccordements.");
  return { runs: info, devStatus, issues, totals, bends: bendsTotal, flowIn, flowOut, ok };
}

/** Mètres de gaine mesurés sur le plan, par diamètre. */
export function vmcPlanTotals(project: Project) {
  if (!project.vmcPlan?.runs.length) return null;
  const a = analyzeVmc(project);
  return { m: a.totals, bends: a.bends };
}
