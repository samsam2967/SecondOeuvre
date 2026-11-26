import type { Floor, Project, Pt, Room, VmcDevice, VmcRun } from "../types";
import { pointsForRoom } from "./geometry";
import { uid } from "./id";
import { inPoly } from "./elecPlan";
import { analyzeVmc, defaultFlow, DIAMS, defaultLimits, type VmcAnalysis } from "./vmcPlan";

const WET = new Set(["cuisine", "sdb", "sde", "wc", "buanderie"]);
const DRY = new Set(["salon", "sejour", "chambre", "bureau", "salle_manger"]);
const TECH = new Set(["cellier", "buanderie", "garage", "combles"]);
const HALL = new Set(["couloir", "degagement", "palier", "entree"]);
const QUIET = new Set(["chambre", "bureau", "salon", "sejour", "salle_manger"]);

export interface AutoVmcResult {
  devices: Map<string, VmcDevice[]>;
  runs: VmcRun[];
  analysis: VmcAnalysis;
  caissonRoom: string;
  caissonFloor: string;
  strategy: "direct" | "te";
  score: number;
}

type RoomRef = { f: Floor; r: Room; poly: Pt[] };

function bboxCenter(poly: Pt[]): Pt {
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

/** Point situé dans la pièce, le plus proche possible du centre. */
function interiorPoint(poly: Pt[]): Pt {
  const c = bboxCenter(poly);
  if (inPoly(c, poly)) return c;
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  let best: Pt = poly[0];
  let bd = Infinity;
  for (let i = 0; i <= 20; i++)
    for (let j = 0; j <= 20; j++) {
      const p = { x: x0 + ((x1 - x0) * i) / 20, y: y0 + ((y1 - y0) * j) / 20 };
      if (!inPoly(p, poly)) continue;
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
  return best;
}

/** Déplace un point (dans la pièce) vers une cible, sans sortir de la pièce. */
function pullInside(poly: Pt[], from: Pt, to: Pt, frac: number): Pt {
  for (const k of [frac, frac * 0.7, frac * 0.45, frac * 0.2, 0]) {
    const p = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
    if (k === 0 || inPoly(p, poly)) return p;
  }
  return from;
}

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const diamFor = (flow: number, vMax: number): 80 | 125 | 160 =>
  (DIAMS.find((d) => flow / 3600 / (Math.PI * (d / 1000) ** 2 / 4) <= vMax) ?? 160) as 80 | 125 | 160;

/**
 * Place automatiquement le caisson, les bouches, les tés et les gaines, puis choisit la solution qui donne
 * le moins de longueur et de coudes en respectant les limites (longueur équivalente, vitesse d'air).
 */
export function autoVmcLayout(project: Project): AutoVmcResult | null {
  const floors = project.floors;
  const rooms: RoomRef[] = floors.flatMap((f) => f.rooms.map((r) => ({ f, r, poly: pointsForRoom(r, f.planScale || 40) }))).filter((x) => x.poly.length >= 3);
  if (!rooms.length) return null;
  const dbl = project.settings.vmc.type === "double_flux";
  const limits = { ...defaultLimits, ...(project.vmcPlan?.limits ?? {}) };
  const vMax = limits.vMax || 5;

  const targets = rooms.filter((x) => WET.has(x.r.type) || (dbl && DRY.has(x.r.type)));
  if (!targets.some((x) => WET.has(x.r.type))) return null;

  const build = (cRoom: RoomRef, strategy: "direct" | "te") => {
    const devices = new Map<string, VmcDevice[]>(floors.map((f) => [f.id, []]));
    const runs: VmcRun[] = [];
    const cPos = interiorPoint(cRoom.poly);
    const caisson: VmcDevice = { id: uid(), kind: "caisson", x: cPos.x, y: cPos.y, label: "Caisson VMC" };
    devices.get(cRoom.f.id)!.push(caisson);

    // bouches regroupées par étage
    const byFloor = new Map<string, { ref: RoomRef; kind: VmcDevice["kind"]; pos: Pt; flow: number }[]>();
    for (const t of targets) {
      const kind: VmcDevice["kind"] = WET.has(t.r.type) ? "extraction" : "insufflation";
      const arr = byFloor.get(t.f.id) ?? [];
      arr.push({ ref: t, kind, pos: interiorPoint(t.poly), flow: defaultFlow(kind, t.r.type) });
      byFloor.set(t.f.id, arr);
    }

    for (const [fid, list] of byFloor) {
      const sameFloor = fid === cRoom.f.id;
      const useTe = strategy === "te" && list.length >= 2;
      let te: VmcDevice | null = null;
      if (useTe) {
        const mx = median(list.map((b) => b.pos.x));
        const my = median(list.map((b) => b.pos.y));
        // le té se place dans un dégagement proche de la médiane des bouches, sinon dans la pièce la plus centrale
        const halls = rooms.filter((x) => x.f.id === fid && HALL.has(x.r.type));
        const pool = halls.length ? halls : rooms.filter((x) => x.f.id === fid);
        const near = pool.slice().sort((a, b) => {
          const ca = bboxCenter(a.poly);
          const cb = bboxCenter(b.poly);
          return Math.hypot(ca.x - mx, ca.y - my) - Math.hypot(cb.x - mx, cb.y - my);
        })[0];
        const base = interiorPoint(near.poly);
        const p = inPoly({ x: mx, y: my }, near.poly) ? { x: mx, y: my } : pullInside(near.poly, base, { x: mx, y: my }, 1);
        te = { id: uid(), kind: "te", x: p.x, y: p.y, label: "Té" };
        devices.get(fid)!.push(te);
      }
      const hub = te ?? caisson;
      const hubPos = te ? { x: te.x, y: te.y } : cPos;
      const total = list.reduce((s, b) => s + b.flow, 0);
      if (te) {
        const rise = sameFloor ? [] : [{ floorId: cRoom.f.id, x: te.x, y: te.y }];
        runs.push({ id: uid(), fromId: caisson.id, toId: te.id, points: rise, diameter: diamFor(total, vMax), flexible: false, ortho: true });
      }
      for (const b of list) {
        // la bouche se rapproche du té / du caisson tout en restant dans sa pièce
        const pos = pullInside(b.ref.poly, b.pos, hubPos, 0.5);
        const dev: VmcDevice = { id: uid(), kind: b.kind, x: pos.x, y: pos.y, label: b.ref.r.name };
        devices.get(fid)!.push(dev);
        const rise = !te && !sameFloor ? [{ floorId: cRoom.f.id, x: dev.x, y: dev.y }] : [];
        runs.push({ id: uid(), fromId: hub.id, toId: dev.id, points: rise, diameter: diamFor(b.flow, vMax), flexible: true, ortho: true });
      }
    }
    return { devices, runs, caisson };
  };

  const evaluate = (devices: Map<string, VmcDevice[]>, runs: VmcRun[]) => {
    const tp: Project = {
      ...project,
      floors: floors.map((f) => ({ ...f, vmcDevices: devices.get(f.id) ?? [] })),
      vmcPlan: { runs, limits: project.vmcPlan?.limits ?? structuredClone(defaultLimits) },
    };
    const an = analyzeVmc(tp);
    const errors = an.issues.filter((i) => i.level === "error").length;
    const warns = an.issues.filter((i) => i.level === "warn").length;
    const length = an.totals[80] + an.totals[125] + an.totals[160];
    return { an, errors, warns, length };
  };

  let best: AutoVmcResult | null = null;
  for (const cRoom of rooms) {
    for (const strategy of ["direct", "te"] as const) {
      const b = build(cRoom, strategy);
      const ev = evaluate(b.devices, b.runs);
      let score = ev.errors * 1000 + ev.warns * 40 + ev.length + ev.an.bends * 0.8;
      if (TECH.has(cRoom.r.type)) score -= 6;
      if (QUIET.has(cRoom.r.type)) score += 30;
      if (WET.has(cRoom.r.type) && cRoom.r.type !== "buanderie") score += 8;
      if (!best || score < best.score) best = { devices: b.devices, runs: b.runs, analysis: ev.an, caissonRoom: cRoom.r.name, caissonFloor: cRoom.f.name, strategy, score };
    }
  }
  return best;
}
