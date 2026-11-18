import type { PostId, Project, Task } from "../types";
import { ROOM_TYPES } from "../data/catalogs";
import { defaultElec, roomSurfaces } from "./surfaces";
import type { CalcResult } from "./calc";

/** Journée de travail retenue : 8 h, en autoconstruction soignée (une personne). */
export const HOURS_PER_DAY = 8;

export interface Quantities {
  cloisonLm: number;
  cloisonM2: number;
  exteriorM2: number;
  placoM2: number;
  placoCeilingM2: number;
  heatedM2: number;
  floorM2: number;
  wetRooms: number;
  vmcPoints: number;
  elecPoints: number;
  tileFloorM2: number;
  tileWallM2: number;
  paintM2: number;
  doors: number;
  perimeterLm: number;
}

/** Quantités réelles du projet, relevées sur le plan : ce sont elles qui pilotent toutes les durées. */
export function projectQuantities(project: Project, calc: CalcResult): Quantities {
  const rooms = project.floors.flatMap((f) => f.rooms);
  let placoCeilingM2 = 0;
  let heatedM2 = 0;
  let tileFloorM2 = 0;
  let tileWallM2 = 0;
  let paintM2 = 0;
  let elecPoints = 0;
  let doors = 0;
  let perimeterLm = 0;
  for (const r of rooms) {
    const s = roomSurfaces(r);
    if (r.placoCeiling) placoCeilingM2 += s.ceiling;
    if (r.floorHeating) heatedM2 += s.floor;
    if (r.tileFloor) tileFloorM2 += s.floor;
    if (r.tileWalls) tileWallM2 += Math.max(0, s.perimeter * r.tileWallHeight - s.openingsSingle);
    if (r.paintWalls) paintM2 += s.wallsNet;
    if (r.paintCeiling) paintM2 += s.ceiling;
    perimeterLm += s.perimeter;
    const e = defaultElec(r);
    elecPoints += e.prises + e.interrupteurs + e.dcl + e.spots + e.rj45 + e.tv + e.hdmi;
    doors += r.openings.filter((o) => o.type === "porte" && o.wall !== "exterieur").length;
  }
  const wetRooms = rooms.filter((r) => ROOM_TYPES.find((t) => t.id === r.type)?.wet).length;
  const vmcDev = project.floors.reduce((a, f) => a + (f.vmcDevices?.length ?? 0), 0);
  const t = calc.surfaces;
  return {
    cloisonLm: t.cloisonLm,
    cloisonM2: t.cloison,
    exteriorM2: t.exterior,
    placoM2: calc.perRoom.reduce((a, p) => a + p.placoM2, 0) + t.cloison * 2,
    placoCeilingM2,
    heatedM2,
    floorM2: t.floor,
    wetRooms,
    vmcPoints: vmcDev || Math.max(1, rooms.filter((r) => !["couloir", "degagement", "palier", "escalier"].includes(r.type)).length),
    elecPoints,
    tileFloorM2,
    tileWallM2,
    paintM2,
    doors,
    perimeterLm,
  };
}

export interface Estimate {
  days: number;
  hours: number;
  qty: number;
  unit: string;
  rate: number;
  rateUnit: string;
  /** Phrase prête à afficher : « 150 ml ÷ 8 ml/jour = 18,75 jours ». */
  basis: string;
}

const fr = (n: number, d = 2) => n.toLocaleString("fr-FR", { maximumFractionDigits: d });

/** Cadence = quantité faite en UNE journée de 8 h par une personne soigneuse. */
interface Rule {
  match: RegExp;
  qty: (q: Quantities) => number;
  unit: string;
  rate: number;
  fixedDays?: number;
}

const RULES: Rule[] = [
  { match: /^Bande résiliente/i, qty: (q) => q.cloisonLm, unit: "ml", rate: 25 },
  { match: /^Ossature des cloisons/i, qty: (q) => q.cloisonLm, unit: "ml", rate: 8 },
  { match: /^Isolation des murs/i, qty: (q) => q.exteriorM2, unit: "m²", rate: 25 },
  { match: /^Pare-vapeur/i, qty: (q) => q.exteriorM2, unit: "m²", rate: 60 },
  { match: /^Isolant des cloisons/i, qty: (q) => q.cloisonM2, unit: "m²", rate: 30 },
  { match: /^Plaques/i, qty: (q) => q.placoM2, unit: "m² de plaques", rate: 20 },
  { match: /^Plafonds placo/i, qty: (q) => q.placoCeilingM2, unit: "m² de plafond", rate: 8 },
  { match: /^Bandes, corni/i, qty: (q) => q.placoM2 + q.placoCeilingM2, unit: "m² de plaques", rate: 30 },
  { match: /^Collecteurs plancher/i, qty: (q) => q.heatedM2, unit: "m² chauffés", rate: 120 },
  { match: /^Isolation sous chape/i, qty: (q) => q.heatedM2, unit: "m² chauffés", rate: 25 },
  { match: /^Chape/i, qty: (q) => q.floorM2, unit: "m² de chape", rate: 60 },
  { match: /^Réseaux d'eau/i, qty: (q) => q.wetRooms, unit: "pièces d'eau", rate: 1 },
  { match: /^Évacuations/i, qty: (q) => q.wetRooms, unit: "pièces d'eau", rate: 2 },
  { match: /^Pose appareils/i, qty: (q) => q.wetRooms, unit: "pièces d'eau", rate: 2 },
  { match: /^Caisson et réseau VMC/i, qty: (q) => q.vmcPoints, unit: "bouches", rate: 3 },
  { match: /^Bouches définitives/i, qty: (q) => q.vmcPoints, unit: "bouches", rate: 12 },
  { match: /^Tableau et colonnes/i, qty: () => 1, unit: "tableau", rate: 0.5 },
  { match: /^Tirage des gaines/i, qty: (q) => q.elecPoints, unit: "points", rate: 8 },
  { match: /^Appareillage/i, qty: (q) => q.elecPoints, unit: "points", rate: 15 },
  { match: /^SPEC/i, qty: (q) => q.wetRooms, unit: "pièces humides", rate: 2 },
  { match: /^Natte/i, qty: (q) => q.tileFloorM2, unit: "m² de carrelage", rate: 8 },
  { match: /^Faïence/i, qty: (q) => q.tileWallM2, unit: "m² de faïence", rate: 6 },
  { match: /^Sous-couche/i, qty: (q) => q.paintM2, unit: "m² à peindre", rate: 40 },
  { match: /^Peinture finition/i, qty: (q) => q.paintM2, unit: "m² à peindre", rate: 25 },
  { match: /^Huisseries/i, qty: (q) => q.doors, unit: "portes", rate: 1.5 },
  { match: /^Plinthes/i, qty: (q) => q.perimeterLm, unit: "ml de plinthes", rate: 30 },
];

/** Durée d'une tâche du conducteur calculée d'après les quantités du projet (null si aucune cadence connue). */
export function taskEstimate(q: Quantities, task: Pick<Task, "title">): Estimate | null {
  const rule = RULES.find((r) => r.match.test(task.title));
  if (!rule) return null;
  const qty = rule.qty(q);
  const days = qty / rule.rate;
  return {
    days,
    hours: Math.max(0, Math.round(days * HOURS_PER_DAY * 2) / 2),
    qty,
    unit: rule.unit,
    rate: rule.rate,
    rateUnit: `${rule.unit}/jour`,
    basis: `${fr(qty, 1)} ${rule.unit} ÷ ${fr(rule.rate)} ${rule.unit}/jour = ${fr(days)} jour${days >= 2 ? "s" : ""}`,
  };
}

/** Durée totale par poste = somme des tâches du conducteur qui ont une cadence + celles sans cadence (durée fixe). */
export function postDurations(project: Project, calc: CalcResult): Record<PostId | "general", { days: number; tasks: { title: string; days: number; basis: string }[] }> {
  const q = projectQuantities(project, calc);
  const out = {} as Record<PostId | "general", { days: number; tasks: { title: string; days: number; basis: string }[] }>;
  for (const t of project.tasks) {
    const e = taskEstimate(q, t);
    const days = e ? e.days : t.durationH / HOURS_PER_DAY;
    const row = (out[t.post] ??= { days: 0, tasks: [] });
    row.days += days;
    row.tasks.push({ title: t.title, days, basis: e ? e.basis : `durée forfaitaire ${fr(t.durationH, 1)} h` });
  }
  return out;
}

export const fmtDays = (d: number) => (d < 0.1 ? "< 1 h" : d < 1 ? `${fr(d * HOURS_PER_DAY, 1)} h` : `${fr(d)} j`);

const TUTO_TO_TASK: [RegExp, string][] = [
  [/cloison/i, "Ossature des cloisons"],
  [/bande|enduit|finition q|joints? de plaque/i, "Bandes, cornières"],
  [/plafond/i, "Plafonds placo"],
  [/plaque|doublage|placo/i, "Plaques"],
  [/pare-vapeur|étanchéité à l'air|etancheite a l'air/i, "Pare-vapeur"],
  [/isol|fibre de bois|laine/i, "Isolation des murs"],
  [/chape/i, "Chape"],
  [/plancher chauffant|tubes|collecteur/i, "Isolation sous chape"],
  [/faïence|faience/i, "Faïence"],
  [/spec/i, "SPEC"],
  [/carrel|carreau|calepinage|joint/i, "Natte"],
  [/sous-couche/i, "Sous-couche"],
  [/peintur/i, "Peinture finition"],
  [/plinthe/i, "Plinthes"],
  [/porte|huisserie/i, "Huisseries"],
  [/appareillage|prise|interrupteur/i, "Appareillage"],
  [/câbl|cabl|gaine|circuit|tirage/i, "Tirage des gaines"],
  [/vmc|bouche|caisson/i, "Caisson et réseau VMC"],
  [/évacuation|evacuation/i, "Évacuations"],
  [/eau|per\b|multicouche|alimentation|appareil/i, "Réseaux d'eau"],
];

/** Durée d'une fiche tutoriel pour CE projet, quand la fiche correspond à un travail mesurable. */
export function tutorialEstimate(q: Quantities, t: { title: string; post: string }): Estimate | null {
  if (t.post === "general") return null;
  const hit = TUTO_TO_TASK.find(([re]) => re.test(t.title));
  return hit ? taskEstimate(q, { title: hit[1] }) : null;
}
