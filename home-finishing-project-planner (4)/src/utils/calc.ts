import {
  advisedPrises,
  ELEC_NORMS,
  ISOLANTS,
  PLAQUE_INFO,
  QUALITY_TARGETS,
  ROOM_TYPES,
  rValue,
} from "../data/catalogs";
import type { Floor, LineItem, PostId, Project, Room } from "../types";
import { uid } from "./id";
import { allPartitions, allRooms, defaultElec, partitionArea, roomEdges, roomSurfaces, totals } from "./surfaces";

function item(
  post: PostId,
  category: string,
  name: string,
  spec: string,
  unit: string,
  quantity: number,
  unitPrice: number,
  notes = "",
  extra?: { roomId?: string; floorId?: string; photo?: string; productId?: string },
): LineItem {
  return {
    id: uid(),
    post,
    category,
    name,
    spec,
    unit,
    quantity: Math.max(0, quantity),
    unitPrice,
    notes,
    ...extra,
  };
}

function waste(q: number, pct: number) {
  return q * (1 + pct / 100);
}

function findIsolant(list: typeof ISOLANTS, id: string) {
  return list.find((i) => i.id === id) ?? list[0];
}

export interface ResolvedTile {
  id: string;
  name: string;
  tileL: number;
  tileW: number;
  priceM2: number;
  photo?: string;
  link?: string;
  custom: boolean;
}

export interface ResolvedPaint {
  id: string;
  name: string;
  potL: number;
  yieldM2L: number;
  pricePot: number;
  photo?: string;
  link?: string;
  custom: boolean;
}

function defaultTile(S: Project["settings"]): ResolvedTile {
  const t = S.carrelage.tiles?.[0];
  if (t) return { id: t.id, name: t.name, tileL: t.tileL, tileW: t.tileW, priceM2: t.priceM2, photo: t.photo, link: t.link, custom: false };
  return { id: "__global__", name: "Carrelage standard", tileL: S.carrelage.tileL || 0.6, tileW: S.carrelage.tileW || 0.6, priceM2: S.carrelage.prices.carreau_m2 ?? 24, custom: false };
}

function defaultPaint(S: Project["settings"], usage: "mur" | "plafond"): ResolvedPaint {
  const list = S.peinture.paints ?? [];
  const pick = list.find((p) => p.usage === usage) ?? list.find((p) => p.usage === "universel") ?? list[0];
  if (pick) return { id: pick.id, name: pick.name, potL: pick.potL, yieldM2L: pick.yieldM2L, pricePot: pick.pricePot, photo: pick.photo, link: pick.link, custom: false };
  const globalPrice = usage === "mur" ? (S.peinture.prices.peinture_mur_10l ?? 49) : (S.peinture.prices.peinture_plafond_10l ?? 42);
  return { id: "__global__", name: usage === "mur" ? "Peinture murs" : "Peinture plafond", potL: S.peinture.potL || 10, yieldM2L: usage === "mur" ? S.peinture.yieldWall || 11 : S.peinture.yieldCeiling || 12, pricePot: globalPrice, custom: false };
}

/** Carrelage effectif d'une pièce : produit du catalogue, sinon ancien réglage pièce, sinon produit par défaut. */
export function resolveTile(S: Project["settings"], room: Room, kind: "sol" | "mur"): ResolvedTile {
  const catalog = S.carrelage.tiles ?? [];
  const id = kind === "sol" ? room.tileSolId : room.tileMurId;
  if (id) {
    const t = catalog.find((x) => x.id === id);
    if (t) return { id: t.id, name: t.name, tileL: t.tileL, tileW: t.tileW, priceM2: t.priceM2, photo: t.photo, link: t.link, custom: false };
  }
  // Anciens réglages par pièce (prix / format saisis à la main) → produit synthétique.
  if (kind === "sol" && ((room.prixCarrelageM2 ?? 0) > 0 || (room.carreauL ?? 0) > 0)) {
    return {
      id: `__legacy-sol-${room.id}`,
      name: `${room.name} (ancien réglage)`,
      tileL: (room.carreauL ?? 0) > 0 ? room.carreauL : S.carrelage.tileL || 0.6,
      tileW: (room.carreauW ?? 0) > 0 ? room.carreauW : S.carrelage.tileW || 0.6,
      priceM2: (room.prixCarrelageM2 ?? 0) > 0 ? room.prixCarrelageM2 : (S.carrelage.prices.carreau_m2 ?? 24),
      custom: true,
    };
  }
  if (kind === "mur" && ((room.prixFaienceM2 ?? 0) > 0 || (room.faienceL ?? 0) > 0 || (room.prixCarrelageM2 ?? 0) > 0)) {
    const l = (room.faienceL ?? 0) > 0 ? room.faienceL : (room.carreauL ?? 0) > 0 ? room.carreauL : S.carrelage.tileL || 0.6;
    const w = (room.faienceW ?? 0) > 0 ? room.faienceW : (room.carreauW ?? 0) > 0 ? room.carreauW : S.carrelage.tileW || 0.6;
    const price = (room.prixFaienceM2 ?? 0) > 0 ? room.prixFaienceM2 : (room.prixCarrelageM2 ?? 0) > 0 ? room.prixCarrelageM2 : (S.carrelage.prices.carreau_m2 ?? 24);
    return { id: `__legacy-mur-${room.id}`, name: `${room.name} (ancien réglage)`, tileL: l, tileW: w, priceM2: price, custom: true };
  }
  return defaultTile(S);
}

/** Peinture effective d'une pièce : produit du catalogue, sinon ancien prix pièce, sinon produit par défaut. */
export function resolvePaint(S: Project["settings"], room: Room, kind: "mur" | "plafond"): ResolvedPaint {
  const catalog = S.peinture.paints ?? [];
  const id = kind === "mur" ? room.paintWallId : room.paintCeilId;
  if (id) {
    const p = catalog.find((x) => x.id === id);
    if (p) return { id: p.id, name: p.name, potL: p.potL, yieldM2L: p.yieldM2L, pricePot: p.pricePot, photo: p.photo, link: p.link, custom: false };
  }
  const legacyPrice = kind === "mur" ? (room.prixPeintureMurPot ?? 0) : (room.prixPeinturePlafondPot ?? 0);
  if (legacyPrice > 0) {
    const d = defaultPaint(S, kind);
    return { ...d, id: `__legacy-${kind}-${room.id}`, name: `${room.name} (ancien réglage)`, pricePot: legacyPrice, custom: true };
  }
  return defaultPaint(S, kind);
}

function postMarginPct(S: Project["settings"], post: PostId): number {
  const v =
    post === "placo" ? S.placo.marginPct
    : post === "isolation" ? S.isolation.marginPct
    : post === "electricite" ? S.elec.marginPct
    : post === "sanitaire" ? S.sanitaire.marginPct
    : post === "vmc" ? S.vmc.marginPct
    : post === "chauffage" ? S.chauffage.marginPct
    : post === "peinture" ? S.peinture.marginPct
    : post === "carrelage" ? S.carrelage.marginPct
    : S.quincaillerie.marginPct;
  return Math.max(0, v ?? 0);
}

function plaquePrice(project: Project, type: Room["placoType"]) {
  return project.settings.placo.prices[type] ?? project.settings.placo.prices.ba13;
}

function plaqueLabel(type: Room["placoType"]) {
  return PLAQUE_INFO[type].label;
}

export interface RoomElecNeed {
  room: Room;
  floorName: string;
  area: number;
  prises: number;
  prisesNorm: number;
  interrupteurs: number;
  vaEtVient: number;
  poussoirs: number;
  dcl: number;
  spots: number;
  rj45: number;
  tv: number;
  specialised: string[];
  placement: string[];
  notes: string[];
}

export interface CalcResult {
  items: LineItem[];
  byPost: Record<PostId, LineItem[]>;
  costByPost: Record<PostId, number>;
  costTotal: number;
  /** Marge financière par poste (€) = coût de base × marginPct. */
  marginByPost: Record<PostId, number>;
  /** Coût avec marge par poste. */
  costWithMarginByPost: Record<PostId, number>;
  costWithMarginTotal: number;
  surfaces: ReturnType<typeof totals>;
  elec: RoomElecNeed[];
  isolation: {
    rMur: number;
    rCloison: number;
    rSol: number;
    rPlafond: number;
    target: (typeof QUALITY_TARGETS)[keyof typeof QUALITY_TARGETS];
    re2020Mur: boolean;
    re2020Sol: boolean;
    re2020Plafond: boolean;
    murIsolant: ReturnType<typeof findIsolant>;
    cloisonIsolant: ReturnType<typeof findIsolant>;
    solIsolant: ReturnType<typeof findIsolant>;
    comparisons: {
      id: string;
      name: string;
      family: string;
      thickness: number;
      r: number;
      priceM2: number;
      bio: boolean;
      ok: boolean;
      notes: string;
    }[];
  };
  perRoom: {
    room: Room;
    floorName: string;
    surfaces: ReturnType<typeof roomSurfaces>;
    placoM2: number;
    plaques: number;
    paintM2: number;
    tileM2: number;
  }[];
  perFloor: {
    floor: Floor;
    surfaces: ReturnType<typeof totals>;
    cost: number;
  }[];
  chauffage: {
    surface: number;
    tubeM: number;
    loops: number;
    collecteurs: number;
    puissanceW: number;
  };
}

export function compute(project: Project): CalcResult {
  const items: LineItem[] = [];
  const rooms = allRooms(project.floors);
  const parts = allPartitions(project.floors);
  const surf = totals(project.floors);
  const S = project.settings;
  const isolants = S.isolants?.length ? S.isolants : ISOLANTS;
  const roomScale = project.floors[0]?.planScale || 40;
  const scaleByFloor = new Map(project.floors.map((f) => [f.id, f.planScale || 40]));
  const railL = S.placo.railLength || 3;
  const montL = S.placo.montantLength || 3;
  const fourL = S.placo.fourrureLength || 3;

  /** Dimensions de la plaque selon son type (BA13, hydro…) — repli sur la taille globale. */
  const plaqueSize = (type: string) => {
    const sz = S.placo.plaqueSizes?.[type];
    const l = sz?.l && sz.l > 0 ? sz.l : S.placo.plaqueL;
    const w = sz?.w && sz.w > 0 ? sz.w : S.placo.plaqueW;
    return { l, w, m2: Math.max(0.1, l * w) };
  };

  const perRoom = rooms.map((room) => {
    const floorName = project.floors.find((f) => f.id === room.floorId)?.name ?? "";
    const rs = roomSurfaces(room);
    const placoWalls = room.placoWalls ? rs.wallsNet : 0;
    const placoCeil = room.placoCeiling ? rs.ceiling : 0;
    const placoM2 = placoWalls + placoCeil;
    const plaqueM2 = plaqueSize(room.placoType).m2;
    const plaques = plaqueM2 > 0 ? waste(placoM2, S.placo.wastePct) / plaqueM2 : 0;
    const paintM2 =
      (room.paintWalls ? rs.wallsNet : 0) +
      (room.paintCeiling ? rs.ceiling : 0) +
      (room.paintFloor ? rs.floor : 0);
    const tileM2 =
      (room.tileFloor ? rs.floor : 0) +
      (room.tileWalls ? Math.max(0, rs.perimeter * room.tileWallHeight - rs.openingsSingle) : 0);
    return { room, floorName, surfaces: rs, placoM2, plaques, paintM2, tileM2 };
  });

  // ----- PLACO doublage + plafonds -----
  const byPlaque = new Map<string, { m2: number; rooms: string[] }>();
  let corniereM = 0;
  let resilienteM = 0;
  let visOssature = 0;

  // Surfaces de placo par paroi et par type : les passages (entre deux pièces)
  // sont exclus, et chaque paroi peut avoir son propre type de plaque.
  const roomPlacoByType = new Map<string, { m2: number; rooms: string[] }>();
  const roomExteriorByType = new Map<string, number>();
  let placoPassageM2 = 0;

  for (const pr of perRoom) {
    const { room, surfaces: rs } = pr;
    const edges = roomEdges(room, scaleByFloor.get(room.floorId) ?? roomScale);
    // Une ouverture déclarée en "cloison" perce les 2 faces : elle est déclarée
    // une seule fois (dans une seule pièce) et compte double ici.
    const openingsArea = room.openings.reduce((s, o) => s + o.width * o.height * (o.wall === "cloison" ? 2 : 1), 0);

    const local = new Map<string, number>();
    let grossWithPlaco = 0;
    let grossAll = 0;

    for (const e of edges) {
      const surface = e.lengthM * room.height;
      grossAll += surface;
      if (e.passage) {
        placoPassageM2 += surface;
        continue;
      }
      grossWithPlaco += surface;
      local.set(e.placoType, (local.get(e.placoType) ?? 0) + surface);
      if (e.exterior) {
        roomExteriorByType.set(e.placoType, (roomExteriorByType.get(e.placoType) ?? 0) + surface);
      }
    }

    // Ouvertures déduites au prorata des parois de la pièce.
    const net = Math.max(0, grossWithPlaco - openingsArea);
    const factor = grossWithPlaco > 0 ? net / grossWithPlaco : 0;

    for (const [type, m2] of local) {
      const value = m2 * factor;
      const cur = roomPlacoByType.get(type) ?? { m2: 0, rooms: [] };
      cur.m2 += value;
      if (!cur.rooms.includes(room.name)) cur.rooms.push(room.name);
      roomPlacoByType.set(type, cur);
    }
    for (const [type, m2] of Array.from(roomExteriorByType)) {
      roomExteriorByType.set(type, m2);
    }

    if (room.placoCeiling) {
      const key = room.placoType === "hydro" ? "hydro" : "ba13";
      const cur = byPlaque.get(key) ?? { m2: 0, rooms: [] };
      cur.m2 += rs.ceiling;
      cur.rooms.push(room.name + " (plafond)");
      byPlaque.set(key, cur);
    }
    const extLen = edges.filter((e) => e.exterior && !e.passage).reduce((s, e) => s + e.lengthM, 0);
    if (extLen > 0) resilienteM += extLen;
    corniereM += edges.filter((e) => !e.passage).length * room.height * 0.25;
  }

  // Reprise des surfaces de placo des pièces (hors cloisons) par type
  for (const [type, val] of roomPlacoByType) {
    const cur = byPlaque.get(type) ?? { m2: 0, rooms: [] };
    cur.m2 += val.m2;
    cur.rooms.push(...val.rooms);
    byPlaque.set(type, cur);
  }

  // Isolation : surfaces extérieures par type de paroi (les passages ne s'isolent pas)
  let extAreaTotal = 0;
  for (const v of roomExteriorByType.values()) extAreaTotal += v;

  // Cloisons — 2 faces
  let cloisonM2ByType: Record<string, number> = {};
  let montant48m = 0;
  let montant70m = 0;
  let montant90m = 0;
  let rail48m = 0;
  let rail70m = 0;
  let doorReinforcements = 0;

  for (const p of parts) {
    const face = partitionArea(p);
    const faces = face * 2;
    const t =
      p.type === "hydro" || p.type === "hydro_phonique"
        ? "hydro"
        : p.type === "phonique"
          ? "phonique"
          : p.type === "coupe_feu"
            ? "feu"
            : "ba13";
    cloisonM2ByType[t] = (cloisonM2ByType[t] ?? 0) + faces;
    const spacing = S.placo.montantSpacing;
    const montants = Math.ceil(p.length / spacing) + 1 + p.doorCount * 2;
    const lmMontants = montants * p.height;
    if (p.thickness <= 48) montant48m += lmMontants;
    else if (p.thickness <= 70) montant70m += lmMontants;
    else montant90m += lmMontants;
    const rails = p.length * 2;
    if (p.thickness <= 48) rail48m += rails;
    else rail70m += rails;
    resilienteM += p.length * 2 + p.height * 2;
    doorReinforcements += p.doorCount;
  }

  const addPlaques = (type: string, m2: number, note: string) => {
    if (m2 <= 0.05) return;
    const sz = plaqueSize(type);
    const qty = Math.ceil(waste(m2, S.placo.wastePct) / sz.m2);
    items.push(
      item(
        "placo",
        "Plaques",
        `Plaque ${plaqueLabel(type as Room["placoType"])}`,
        `${sz.l} × ${sz.w} m`,
        "u",
        qty,
        plaquePrice(project, type as Room["placoType"]),
        `${fmt(m2)} m² à couvrir — ${note}`,
      ),
    );
  };

  for (const [type, v] of byPlaque) addPlaques(type, v.m2, v.rooms.slice(0, 6).join(", "));
  for (const [type, m2] of Object.entries(cloisonM2ByType)) addPlaques(type, m2, "cloisons (2 faces)");

  const totalPlacoM2 =
    [...byPlaque.values()].reduce((s, v) => s + v.m2, 0) +
    Object.values(cloisonM2ByType).reduce((s, v) => s + v, 0);

  const railLm = rail48m + rail70m + rooms.reduce((s, r) => s + (r.placoCeiling ? r.length + r.width : 0) * 2, 0);
  const fourrurePlafond = rooms.reduce((s, r) => {
    if (!r.placoCeiling) return s;
    return s + Math.ceil(r.width / 0.5) * r.length;
  }, 0);

  if (rail48m > 0)
    items.push(item("placo", "Ossature cloisons", `Rail 48 mm (${railL} m)`, "R48", "u", Math.ceil(waste(rail48m, 8) / railL), S.placo.prices.rail48_3m, `${fmt(rail48m)} ml`));
  if (rail70m > 0)
    items.push(item("placo", "Ossature cloisons", `Rail 70 mm (${railL} m)`, "R70", "u", Math.ceil(waste(rail70m, 8) / railL), S.placo.prices.rail70_3m, `${fmt(rail70m)} ml`));
  if (montant48m > 0)
    items.push(item("placo", "Ossature cloisons", `Montant 48 mm (${montL} m)`, "M48-50", "u", Math.ceil(waste(montant48m, 8) / montL), S.placo.prices.montant48_3m, `${fmt(montant48m)} ml`));
  if (montant70m > 0)
    items.push(item("placo", "Ossature cloisons", `Montant 70 mm (${montL} m)`, "M70-50", "u", Math.ceil(waste(montant70m, 8) / montL), S.placo.prices.montant70_3m, `${fmt(montant70m)} ml`));
  if (montant90m > 0)
    items.push(item("placo", "Ossature cloisons", `Montant 90 mm (${montL} m)`, "M90", "u", Math.ceil(waste(montant90m, 8) / montL), S.placo.prices.montant90_3m, `${fmt(montant90m)} ml`));
  if (fourrurePlafond > 0)
    items.push(item("placo", "Plafonds", `Fourrure plafond (${fourL} m)`, "F530", "u", Math.ceil(waste(fourrurePlafond, 10) / fourL), S.placo.prices.fourrure_3m, `${fmt(fourrurePlafond)} ml`));

  if (totalPlacoM2 > 0.05) {
    const visPlaco = Math.ceil(waste(totalPlacoM2 * S.placo.visPerM2, 5));
    items.push(item("placo", "Fixations", `Vis à placo TTPC 3,5×${S.placo.visMm || 25}`, "boîte de 1000", "boîte", Math.ceil(visPlaco / 1000), S.placo.prices.vis_1000, `${visPlaco} vis`));
    visOssature = Math.ceil((railLm + montant48m + montant70m + montant90m) / 0.6);
    items.push(item("placo", "Fixations", "Vis + chevilles frappe ossature", "boîte de 100", "boîte", Math.ceil(visOssature / 100), S.placo.prices.cheville_frappe_100, `${visOssature} fixations`));

    const bandeM = waste(totalPlacoM2 * S.placo.bandePerM2, 10);
    items.push(item("placo", "Joints", `Bande à joint papier ${S.placo.bandeWidthMm || 50} mm`, "rouleau 150 m", "rouleau", Math.max(1, Math.ceil(bandeM / 150)), S.placo.prices.bande_150m, `${fmt(bandeM)} ml`));
    items.push(item("placo", "Joints", "Bande armée angles sortants", "rouleau 30 m", "rouleau", Math.max(1, Math.ceil(corniereM / 30)), S.placo.prices.bande_armee, `${fmt(corniereM)} ml d'angles`));
    items.push(item("placo", "Joints", `Cornière métallique ${railL} m`, "angle sortant", "u", Math.max(0, Math.ceil(corniereM / railL)), S.placo.prices.corniere_3m));
    items.push(item("placo", "Joints", "Calicot / bande précollée", "90 m", "rouleau", Math.max(1, Math.ceil(bandeM / 4 / 90)), S.placo.prices.calicot_90m));

    const enduitJointKg = waste(totalPlacoM2 * S.placo.enduitJointKgM2, 10);
    const enduitFinKg = waste(totalPlacoM2 * S.placo.enduitFinitionKgM2, 10);
    items.push(item("placo", "Enduits", "Enduit à joint", "sac 25 kg", "sac", Math.max(1, Math.ceil(enduitJointKg / 25)), S.placo.prices.enduit_25kg, `${fmt(enduitJointKg)} kg`));
    items.push(item("placo", "Enduits", "Enduit de finition / lissage", "sac 25 kg", "sac", Math.max(1, Math.ceil(enduitFinKg / 25)), S.placo.prices.enduit_finition_25kg, `${fmt(enduitFinKg)} kg`));
    items.push(item("placo", "Consommables", "Liaisons de rails / éclisses", "u", "u", Math.ceil(railLm / railL), S.placo.prices.liaisons_rail));
    items.push(item("placo", "Consommables", "Pâte d'accrochage / MAP", "sac 25 kg", "sac", Math.max(1, Math.ceil(surf.exterior / 40)), S.placo.prices.pate_accrochage, "Calage d'ossature / semi-rigide"));
  }

  if (resilienteM > 0)
    items.push(item("placo", "Acoustique", "Bande résiliente sous rail", "rouleau 30 m", "rouleau", Math.ceil(waste(resilienteM, 10) / 30), S.placo.prices.bande_resiliente_30m, `${fmt(resilienteM)} ml — sol, plafond, retours`));
  if (doorReinforcements > 0)
    items.push(item("placo", "Ossature cloisons", "Renforts bois 36×36 pour huisseries", "ml", "ml", doorReinforcements * 5.2, 3.2, `${doorReinforcements} portes — 2 montants + linteau`));

  // ----- ISOLATION murs -----
  const murIsolant = findIsolant(isolants, S.isolation.isolantMurId);
  const cloisonIsolant = findIsolant(isolants, S.isolation.isolantCloisonId);
  const solIsolant = findIsolant(isolants, S.isolation.isolantSolId);
  const plafondIsolant = findIsolant(isolants, S.isolation.isolantPlafondId);

  // Surface extérieure isolation : parois porteuses uniquement (hors passages)
  const extM2 = extAreaTotal > 0.05 ? extAreaTotal : surf.exterior;
  if (extM2 > 0.1) {
    const panelM2 = murIsolant.panelL * murIsolant.panelW;
    const panels = Math.ceil(waste(extM2, S.isolation.wastePct) / panelM2);
    items.push(
      item(
        "isolation",
        "Murs périphériques",
        murIsolant.name,
        `${murIsolant.thickness} mm — ${murIsolant.panelL}×${murIsolant.panelW} m — R = ${rValue(murIsolant.lambda, murIsolant.thickness).toFixed(2)}`,
        "panneau",
        panels,
        murIsolant.priceM2 * panelM2,
        `${fmt(extM2)} m² · λ ${murIsolant.lambda}`,
      ),
    );

    const extLenTotal = rooms.reduce(
      (s, r) =>
        s +
        roomEdges(r, scaleByFloor.get(r.floorId) ?? roomScale)
          .filter((e) => e.exterior && !e.passage)
          .reduce((a, e) => a + e.lengthM, 0),
      0,
    );
    const montants = Math.ceil(extLenTotal / S.isolation.montantSpacing);
    const appuis = Math.ceil(
      rooms.reduce((s, r) => {
        const len = roomEdges(r, scaleByFloor.get(r.floorId) ?? roomScale)
          .filter((e) => e.exterior && !e.passage)
          .reduce((a, e) => a + e.lengthM, 0);
        if (len <= 0) return s;
        const nMont = Math.ceil(len / S.isolation.appuisHSpacing) + 1;
        const nVert = Math.max(2, Math.ceil(r.height / S.isolation.appuisVSpacing) + 1);
        return s + nMont * nVert;
      }, 0),
    );
    items.push(item("isolation", "Système de pose", "Appuis d'isolation", `entraxe ${S.isolation.appuisHSpacing * 100} cm / ${S.isolation.appuisVSpacing} m`, "u", appuis, S.isolation.prices.appui));
    items.push(item("isolation", "Système de pose", `Montants / fourrures F530 (${S.isolation.railLength || 3} m)`, "GTL + support placo", "u", Math.ceil(waste(montants * 2.5, 8) / (S.isolation.railLength || 3)), S.isolation.prices.montant_f530, `GTL ${S.isolation.gtlMm} mm`));
    items.push(item("isolation", "Système de pose", "Chevilles isolation / frappe", "boîte 100", "boîte", Math.ceil(appuis / 100), S.isolation.prices.cheville_isolation_100));
    items.push(item("isolation", "Étanchéité à l'air", "Pare-vapeur / frein-vapeur", "m²", "m²", Math.ceil(waste(extM2, 15)), S.isolation.prices.pare_vapeur_m2, "Côté chaud, continu, marouflé"));
    items.push(item("isolation", "Étanchéité à l'air", "Scotch d'étanchéité", "rouleau 60 m", "rouleau", Math.max(2, Math.ceil(extM2 / 25)), S.isolation.prices.scotch_etanche_60m));
    items.push(item("isolation", "Étanchéité à l'air", "Mastic d'étanchéité", "cartouche", "u", Math.max(4, Math.ceil(extM2 / 20)), S.isolation.prices.mastic_etanche));
    items.push(item("isolation", "Étanchéité à l'air", "Rosaces / manchons étanches", "passages de câbles", "u", Math.max(10, rooms.length * 4), S.isolation.prices.rosace_etanche));
  }

  const cloisonIsolM2 = parts.filter((p) => p.insulated).reduce((s, p) => s + partitionArea(p), 0);
  if (cloisonIsolM2 > 0.1) {
    const panelM2 = cloisonIsolant.panelL * cloisonIsolant.panelW;
    items.push(
      item(
        "isolation",
        "Cloisons",
        cloisonIsolant.name,
        `${cloisonIsolant.thickness} mm — R = ${rValue(cloisonIsolant.lambda, cloisonIsolant.thickness).toFixed(2)}`,
        "panneau",
        Math.ceil(waste(cloisonIsolM2, S.isolation.wastePct) / panelM2),
        cloisonIsolant.priceM2 * panelM2,
        `${fmt(cloisonIsolM2)} m² de cloisons isolées`,
      ),
    );
  }

  const heatFloorM2 = rooms.filter((r) => r.floorHeating).reduce((s, r) => s + r.length * r.width, 0);
  const solM2ForIsol = heatFloorM2 > 0 ? heatFloorM2 : 0;
  if (solM2ForIsol > 0) {
    const panelM2 = Math.max(0.1, solIsolant.panelL * solIsolant.panelW);
    items.push(
      item(
        "isolation",
        "Sol / plancher chauffant",
        solIsolant.name,
        `${solIsolant.thickness} mm — R = ${rValue(solIsolant.lambda, solIsolant.thickness).toFixed(2)}`,
        "panneau",
        Math.ceil(waste(solM2ForIsol, S.isolation.wastePct) / panelM2),
        solIsolant.priceM2 * panelM2,
      ),
    );
  }

  const comblesM2 = rooms.filter((r) => r.type === "combles").reduce((s, r) => s + r.length * r.width, 0);
  if (comblesM2 > 0) {
    const panelM2 = plafondIsolant.panelL * plafondIsolant.panelW;
    items.push(
      item(
        "isolation",
        "Combles / plafond",
        plafondIsolant.name,
        `${plafondIsolant.thickness} mm — R = ${rValue(plafondIsolant.lambda, plafondIsolant.thickness).toFixed(2)}`,
        "panneau",
        Math.ceil(waste(comblesM2, 10) / panelM2),
        plafondIsolant.priceM2 * panelM2,
      ),
    );
  }

  // ----- ELECTRICITE -----
  const elecNeeds: RoomElecNeed[] = rooms.map((room) => {
    const floorName = project.floors.find((f) => f.id === room.floorId)?.name ?? "";
    const area = room.length * room.width;
    const d = defaultElec(room);
    const n = ELEC_NORMS[room.type];
    return {
      room,
      floorName,
      area,
      prises: d.prises,
      prisesNorm: advisedPrises(room.type, area),
      interrupteurs: d.interrupteurs,
      vaEtVient: d.vaEtVient,
      poussoirs: d.poussoirs,
      dcl: d.dcl,
      spots: d.spots,
      rj45: d.rj45,
      tv: d.tv,
      specialised: d.specialised,
      placement: n.placement,
      notes: n.notes,
    };
  });

  const sum = (fn: (e: RoomElecNeed) => number) => elecNeeds.reduce((s, e) => s + fn(e), 0);
  const nPrises = sum((e) => e.prises);
  const nInter = sum((e) => e.interrupteurs);
  const nVV = sum((e) => e.vaEtVient);
  const nPous = sum((e) => e.poussoirs);
  const nDcl = sum((e) => e.dcl);
  const nSpots = sum((e) => e.spots);
  const nRj = sum((e) => e.rj45);
  const nTv = sum((e) => e.tv);
  let prisesStd = 0;
  let prisesConn = 0;
  let interStd = 0;
  let interConn = 0;
  let dclStd = 0;
  let dclConn = 0;
  let spotStd = 0;
  let spotConn = 0;
  for (const e of elecNeeds) {
    const room = e.room;
    const connP = room.elec.override ? room.elec.prisesConnectees ?? 0 : room.elec.prisesConnected ? e.prises : 0;
    const connI = room.elec.override ? room.elec.intersConnectes ?? 0 : room.elec.interConnected ? e.interrupteurs : 0;
    const connD = room.elec.override ? room.elec.dclConnectes ?? 0 : 0;
    const connS = room.elec.override ? room.elec.spotsConnectes ?? 0 : 0;
    prisesConn += connP;
    prisesStd += Math.max(0, e.prises - connP);
    interConn += connI;
    interStd += Math.max(0, e.interrupteurs - connI);
    dclConn += connD;
    dclStd += Math.max(0, e.dcl - connD);
    spotConn += connS;
    spotStd += Math.max(0, e.spots - connS);
  }

  if (prisesStd) items.push(item("electricite", "Appareillage", "Prise 16 A (2 pôles + terre)", "mécanisme seul, à encastrer", "u", prisesStd, S.elec.prices.prise));
  if (prisesConn) items.push(item("electricite", "Appareillage", "Prise 16 A connectée (pilotable)", "mécanisme seul, à encastrer", "u", prisesConn, S.elec.prices.prise_connectee));
  // Interrupteurs « connectés » = interrupteur CLASSIQUE + micro-module placé
  // derrière, dans une boîte d'encastrement plus profonde (50 mm).
  if (interStd + interConn)
    items.push(item("electricite", "Appareillage", "Interrupteur simple allumage", "mécanisme seul — y compris les points pilotés (le module se met derrière)", "u", interStd + interConn, S.elec.prices.inter));
  if (interConn)
    items.push(
      item(
        "electricite",
        "Appareillage",
        "Micro-module connecté pour interrupteur",
        "module Wi-Fi / Zigbee (type Shelly, Sonoff…) logé derrière l'interrupteur classique",
        "u",
        interConn,
        S.elec.prices.module_connecte ?? S.elec.prices.inter_connecte,
        "Nécessite une boîte profonde 50 mm (comptée dans la section Boîtes).",
      ),
    );
  if (dclStd) items.push(item("electricite", "Appareillage", "DCL plafond + couvercle", "DCL = dispositif de connexion luminaire (douille + fiche normalisées)", "u", dclStd, S.elec.prices.dcl));
  if (dclConn) items.push(item("electricite", "Appareillage", "DCL connecté", "point lumineux pilotable / variateur", "u", dclConn, S.elec.prices.dcl_connecte ?? S.elec.prices.dcl));
  if (spotStd) items.push(item("electricite", "Appareillage", "Spot encastré LED", "IP44 obligatoire au-dessus d'une douche (IP = protection eau/poussière)", "u", spotStd, S.elec.prices.spot));
  if (spotConn) items.push(item("electricite", "Appareillage", "Spot connecté", "pilotable Wi-Fi ou Zigbee", "u", spotConn, S.elec.prices.spot_connecte ?? S.elec.prices.spot));
  if (nVV) items.push(item("electricite", "Appareillage", "Interrupteur va-et-vient", "commande d'un même éclairage depuis 2 endroits — mécanisme seul", "u", nVV, S.elec.prices.vaetvient));
  if (nPous) items.push(item("electricite", "Appareillage", "Bouton poussoir", "pour télérupteur (3 points de commande et +)", "u", nPous, S.elec.prices.poussoir));

  // Plaques de finition : le cache qui recouvre chaque mécanisme encastré.
  // Les prix "mécanisme seul" ne les incluent pas (sauf produits vendus complets).
  const nFinitions = prisesStd + prisesConn + interStd + interConn + nVV + nPous + nRj + nTv;
  if (nFinitions)
    items.push(
      item(
        "electricite",
        "Appareillage",
        "Plaque de finition (enjoliveur / cache)",
        "1 par mécanisme mural — prendre des plaques multipostes si prises groupées",
        "u",
        nFinitions,
        S.elec.prices.plaque_finition ?? 2.5,
        "Non comprise dans le prix des mécanismes. Mettez 0 € si vos appareillages sont vendus complets (mécanisme + plaque).",
      ),
    );

  if (nRj) items.push(item("electricite", "Courants faibles", "Prise réseau RJ45 catégorie 6", "RJ45 = prise internet filaire — mécanisme seul", "u", nRj, S.elec.prices.rj45));
  if (nTv) items.push(item("electricite", "Courants faibles", "Prise TV coaxiale", "antenne / TNT — mécanisme seul", "u", nTv, S.elec.prices.tv_coax));

  const nBoites = nPrises + nInter + nVV + nPous + nRj + nTv;
  // Boîtes profondes (50 mm) là où un micro-module se loge derrière l'interrupteur.
  const nBoitesProfondes = interConn;
  const nBoitesStd = Math.max(0, nBoites - nBoitesProfondes);
  items.push(item("electricite", "Boîtes", `Boîte d'encastrement Ø${S.elec.boiteDiamMm || 67} mm — prof. 40 mm`, "pot scellé dans la cloison qui reçoit le mécanisme", "u", nBoitesStd, S.elec.prices.boite_encast));
  if (nBoitesProfondes)
    items.push(
      item(
        "electricite",
        "Boîtes",
        `Boîte d'encastrement PROFONDE Ø${S.elec.boiteDiamMm || 67} mm — prof. 50 mm`,
        "obligatoire aux interrupteurs équipés d'un micro-module (place derrière le mécanisme)",
        "u",
        nBoitesProfondes,
        S.elec.prices.boite_profonde ?? S.elec.prices.boite_encast * 1.5,
      ),
    );
  items.push(item("electricite", "Boîtes", "Boîte d'encastrement étanche à l'air", "spéciale parois isolées : préserve l'étanchéité RE2020 (test Q4)", "u", Math.ceil(nBoites * 0.7), S.elec.prices.boite_etanche, "Pour les boîtes posées dans les murs extérieurs doublés / isolés"));
  items.push(item("electricite", "Boîtes", "Boîte DCL plafond", "boîte noyée au plafond qui reçoit le DCL (point lumineux)", "u", nDcl, S.elec.prices.dcl_boite));

  const cable25 = waste((nPrises + nRj + nTv) * S.elec.cablePriseM, S.elec.wastePct);
  const cable15 = waste((nInter + nVV + nDcl + nSpots + nPous) * S.elec.cableEclairageM, S.elec.wastePct);
  const nSpe = elecNeeds.reduce((s, e) => s + e.specialised.length, 0);
  const cableSpe = waste(nSpe * 12, S.elec.wastePct);
  const cable6 = rooms.some((r) => r.type === "cuisine") ? 18 : 0;

  if (rooms.length) {
    items.push(item("electricite", "Câbles", `Câble 3G${S.elec.cable25 || 2.5} mm²`, "3G = 3 conducteurs dont terre — circuits prises et spécialisés", "m", Math.ceil(cable25 + cableSpe), S.elec.prices.cable_25));
    items.push(item("electricite", "Câbles", `Câble 3G${S.elec.cable15 || 1.5} mm²`, "circuits éclairage", "m", Math.ceil(cable15), S.elec.prices.cable_15));
    if (cable6) items.push(item("electricite", "Câbles", `Câble 3G${S.elec.cable6 || 6} mm²`, "circuit dédié plaque de cuisson 32 A", "m", cable6, S.elec.prices.cable_6));
    items.push(item("electricite", "Gaines", `Gaine ICTA Ø${S.elec.gainePriseMm || 20} mm`, "ICTA = gaine annelée souple de protection des câbles — circuits prises", "m", Math.ceil(waste(cable25, S.elec.gaineMarge)), S.elec.prices.gaine_20));
    items.push(item("electricite", "Gaines", `Gaine ICTA Ø${S.elec.gaineEclairageMm || 16} mm`, "circuits éclairage", "m", Math.ceil(waste(cable15, S.elec.gaineMarge)), S.elec.prices.gaine_16));
    items.push(item("electricite", "Gaines", `Gaine ICTA Ø${S.elec.gaineSpeMm || 25} mm`, "circuits spécialisés (four, lave-linge…)", "m", Math.ceil(cableSpe + cable6 + 10), S.elec.prices.gaine_25));
  }

  const circuitsEcl = Math.max(1, Math.ceil((nDcl + nSpots) / 8));
  const circuitsPrises = Math.max(1, Math.ceil(nPrises / 8));
  const circuitsSpe = nSpe;
  const nDisj10 = circuitsEcl;
  const nDisj16 = circuitsPrises;
  const nDisj20 = Math.max(2, Math.ceil(circuitsSpe * 0.7));
  const nDisj32 = rooms.some((r) => r.type === "cuisine") ? 1 : 0;
  const nDDR = Math.max(2, Math.ceil((nDisj10 + nDisj16 + nDisj20 + nDisj32) / 8));

  if (rooms.length) {
    items.push(item("electricite", "Tableau", "Coffret 4 rangées (13 modules)", "avec GTL", "u", 1, S.elec.prices.tableau_4r));
    items.push(item("electricite", "Tableau", "Interrupteur différentiel 30 mA type AC", "coupe le courant en cas de fuite — type AC = circuits classiques (40 ou 63 A)", "u", Math.ceil(nDDR / 2), S.elec.prices.ddr_ac));
    items.push(item("electricite", "Tableau", "Interrupteur différentiel 30 mA type A", "obligatoire pour lave-linge et plaque de cuisson (40 ou 63 A)", "u", Math.max(1, Math.floor(nDDR / 2)), S.elec.prices.ddr_a));
    items.push(item("electricite", "Tableau", "Disjoncteur 10 A", "protège un circuit éclairage (8 points max)", "u", nDisj10, S.elec.prices.disj_10a));
    items.push(item("electricite", "Tableau", "Disjoncteur 16 ou 20 A", "protège un circuit de prises (8 prises max)", "u", nDisj16, S.elec.prices.disj_16a));
    items.push(item("electricite", "Tableau", "Disjoncteur 20 A", "1 par appareil spécialisé : four, lave-linge, lave-vaisselle…", "u", nDisj20, S.elec.prices.disj_20a));
    if (nDisj32) items.push(item("electricite", "Tableau", "Disjoncteur 32 A", "circuit dédié plaque de cuisson", "u", nDisj32, S.elec.prices.disj_32a));
    items.push(item("electricite", "Tableau", "Peigne de raccordement", "barre qui alimente les disjoncteurs d'une rangée sans ponts de fils", "u", 4, S.elec.prices.peigne));
    items.push(item("electricite", "Tableau", "Bornier de terre et de neutre", "barrettes de regroupement des fils dans le tableau", "u", 2, S.elec.prices.bornier));
    items.push(item("electricite", "Tableau", "Parafoudre type 2", "protège des surtensions d'orage — recommandé selon la région", "u", 1, S.elec.prices.parafoudre));
    items.push(item("electricite", "Tableau", "Interrupteur sectionneur général", "coupure générale du tableau (en aval du disjoncteur de branchement EDF)", "u", 1, S.elec.prices.id_40a));
    items.push(item("electricite", "Administratif", "Visa Consuel (estimation)", "contrôle officiel de conformité, obligatoire en neuf / rénovation lourde", "u", 1, S.elec.prices.consuel));
    items.push(item("electricite", "Consommables", "Bornes de connexion automatiques (type Wago)", "raccordement des fils dans les boîtes — le sachet de 50", "sachet", Math.max(2, Math.ceil(nBoites / 20)), S.elec.prices.wago50));
    items.push(item("electricite", "Consommables", "Colliers de serrage nylon", "fixation des gaines — le sachet de 100", "sachet", Math.max(2, Math.ceil((cable15 + cable25) / 80)), S.elec.prices.collier_100));
    items.push(item("electricite", "Consommables", "Lubrifiant de tirage de câbles", "facilite le passage des fils dans les gaines — le tube", "u", 2, S.elec.prices.greencol));
  }

  // ----- SANITAIRE -----
  const nSdb = rooms.filter((r) => r.type === "sdb" || r.type === "sde").length;
  const wcOnly = rooms.filter((r) => r.type === "wc").length;
  const nCuisine = rooms.filter((r) => r.type === "cuisine").length;
  const nBuand = rooms.filter((r) => r.type === "buanderie").length;
  const waterPoints =
    nSdb * 3 + wcOnly * 1 + nCuisine * 2 + nBuand * 2 + rooms.filter((r) => r.type === "sde").length;

  if (nCuisine) {
    items.push(item("sanitaire", "Cuisine", "Évier inox / céramique", "", "u", nCuisine, S.sanitaire.prices.evier));
    items.push(item("sanitaire", "Cuisine", "Mitigeur évier", "", "u", nCuisine, S.sanitaire.prices.mitigeur_evier));
    items.push(item("sanitaire", "Cuisine", "Siphon + bonde évier", "", "u", nCuisine, S.sanitaire.prices.siphon + S.sanitaire.prices.bonde));
  }
  if (nSdb) {
    items.push(item("sanitaire", "Salle de bain", "Receveur de douche", "extra-plat 90×90 / 120×80", "u", nSdb, S.sanitaire.prices.douche_receveur));
    items.push(item("sanitaire", "Salle de bain", "Paroi de douche", "", "u", nSdb, S.sanitaire.prices.paroi));
    items.push(item("sanitaire", "Salle de bain", "Mitigeur douche thermostatique", "recommandé", "u", nSdb, S.sanitaire.prices.mitigeur_douche));
    items.push(item("sanitaire", "Salle de bain", "Meuble vasque", "", "u", nSdb, S.sanitaire.prices.meuble_vasque));
    items.push(item("sanitaire", "Salle de bain", "Vasque", "", "u", nSdb, S.sanitaire.prices.vasque));
    items.push(item("sanitaire", "Salle de bain", "Mitigeur vasque", "", "u", nSdb, S.sanitaire.prices.mitigeur_vasque));
    items.push(item("sanitaire", "Salle de bain", "Miroir", "", "u", nSdb, S.sanitaire.prices.miroir));
    items.push(item("sanitaire", "Salle de bain", "Sèche-serviettes électrique", "ou eau chaude si PAC", "u", nSdb, S.sanitaire.prices.seche_serviette));
    items.push(item("sanitaire", "Salle de bain", "Kit étanchéité receveur", "SPEC + manchons", "u", nSdb, S.sanitaire.prices.apply_etanche_kit));
  }
  if (wcOnly) {
    items.push(item("sanitaire", "WC", "WC suspendu + abattant", "", "u", wcOnly, S.sanitaire.prices.wc_suspendu));
    items.push(item("sanitaire", "WC", "Bâti-support", "", "u", wcOnly, S.sanitaire.prices.bati_wc));
    items.push(item("sanitaire", "WC", "Lave-mains + mitigeur", "", "u", wcOnly, S.sanitaire.prices.lave_mains + 60));
  }
  const perM = waste(waterPoints * S.sanitaire.tubePerPointM, S.sanitaire.wastePct);
  if (waterPoints > 0) {
    items.push(item("sanitaire", "Alimentation", `Tube PER Ø${S.sanitaire.perDiameter}`, "nu à calorifuger", "m", Math.ceil(perM), S.sanitaire.prices.per_16_ml));
    items.push(item("sanitaire", "Alimentation", "Isolant tubes (calorifuge)", "ml", "m", Math.ceil(perM), S.sanitaire.prices.isolant_tube_ml, "Obligatoire ECS et recommandé EF"));
    items.push(item("sanitaire", "Alimentation", "Collecteur / nourrice 4 sorties", "", "u", Math.max(2, Math.ceil(waterPoints / 4)), S.sanitaire.prices.collecteur_4, "EF + ECS"));
    items.push(item("sanitaire", "Alimentation", "Vannes d'arrêt", "1/4 de tour", "u", waterPoints + 4, S.sanitaire.prices.vanne));
    items.push(item("sanitaire", "Alimentation", "Raccords PER à sertir / glissement", "", "u", waterPoints * 6, S.sanitaire.prices.raccord_per));
    items.push(item("sanitaire", "Alimentation", "Colliers / chevilles tubes", "", "u", Math.ceil(perM / 0.8), S.sanitaire.prices.collier));
    items.push(item("sanitaire", "Alimentation", "Flexibles de raccordement", "", "u", waterPoints * 2, S.sanitaire.prices.flexible));
    items.push(item("sanitaire", "Évacuation", "PVC Ø32", "lavabos", "m", Math.ceil(nSdb * 3 + wcOnly * 2 + nCuisine * 2), S.sanitaire.prices.pvc_32));
    items.push(item("sanitaire", "Évacuation", "PVC Ø40", "éviers / douches", "m", Math.ceil(nSdb * 4 + nCuisine * 4), S.sanitaire.prices.pvc_40));
    items.push(item("sanitaire", "Évacuation", "PVC Ø50", "collecteurs", "m", Math.ceil(nSdb * 3 + nCuisine * 2 + 6), S.sanitaire.prices.pvc_50));
    items.push(item("sanitaire", "Évacuation", "PVC Ø100", "chutes WC", "m", Math.ceil(wcOnly * 4 + nSdb * 2 + 6), S.sanitaire.prices.pvc_100));
  }

  // ----- VMC -----
  const wetRooms = rooms.filter((r) => ["sdb", "sde", "wc", "cuisine", "buanderie"].includes(r.type));
  const dryRooms = rooms.filter((r) => ["salon", "sejour", "chambre", "bureau", "salle_manger"].includes(r.type));
  const vmcType = S.vmc.type;
  if (rooms.length && vmcType === "double_flux") {
    items.push(item("vmc", "Caisson", "VMC double flux haut rendement", "échanges > 85 %, filtres F7/M5", "u", 1, S.vmc.prices.caisson_df));
    items.push(item("vmc", "Bouches", "Bouche d'extraction", "pièces humides", "u", wetRooms.length, S.vmc.prices.bouche_hygro_sdb));
    items.push(item("vmc", "Bouches", "Bouche d'insufflation", "pièces sèches", "u", Math.max(1, dryRooms.length), S.vmc.prices.bouche_insufflation));
    const gaine = waste((wetRooms.length + dryRooms.length) * S.vmc.gaineMPerBouche, 15);
    items.push(item("vmc", "Gaines", "Gaine isolée Ø160 / Ø125", "éviter condensation", "m", Math.ceil(gaine), S.vmc.prices.gaine_isolee_160));
    items.push(item("vmc", "Entretien", "Filtres DF (lot)", "1 an", "lot", 2, S.vmc.prices.filtre_df));
    items.push(item("vmc", "Accessoires", "Siphon condensats", "", "u", 1, S.vmc.prices.condensat));
  } else if (rooms.length) {
    items.push(item("vmc", "Caisson", vmcType === "simple_hygro_b" ? "VMC simple flux hygro B" : "VMC simple flux autoréglable", "caisson combles ou local", "u", 1, S.vmc.prices.caisson_hygrob));
    const nCuisineBouche = rooms.filter((r) => r.type === "cuisine").length || 1;
    const nSdbBouche = rooms.filter((r) => r.type === "sdb" || r.type === "sde" || r.type === "buanderie").length;
    const nWcBouche = rooms.filter((r) => r.type === "wc").length;
    items.push(item("vmc", "Bouches", "Bouche extraction cuisine hygro", "Ø125", "u", nCuisineBouche, S.vmc.prices.bouche_hygro_cuisine));
    items.push(item("vmc", "Bouches", "Bouche extraction SDB hygro", "Ø80", "u", Math.max(1, nSdbBouche), S.vmc.prices.bouche_hygro_sdb));
    if (nWcBouche) items.push(item("vmc", "Bouches", "Bouche extraction WC", "Ø80", "u", nWcBouche, S.vmc.prices.bouche_wc));
    items.push(item("vmc", "Entrées d'air", "Entrée d'air menuiserie", "pièces sèches", "u", Math.max(2, dryRooms.length), S.vmc.prices.entree_air));
    const gaine = waste(wetRooms.length * S.vmc.gaineMPerBouche, 15);
    items.push(item("vmc", "Gaines", "Gaine souple Ø80", "", "m", Math.ceil(gaine * 0.6), S.vmc.prices.gaine_80));
    items.push(item("vmc", "Gaines", "Gaine souple Ø125", "cuisine + raccord caisson", "m", Math.ceil(gaine * 0.5 + 6), S.vmc.prices.gaine_125));
  }
  if (rooms.length) {
    items.push(item("vmc", "Accessoires", "Manchons / tés / réductions", "", "u", wetRooms.length * 2 + 6, S.vmc.prices.manchon));
    items.push(item("vmc", "Accessoires", "Colliers de gaine", "", "u", wetRooms.length * 4 + 10, S.vmc.prices.collier_gaine));
    items.push(item("vmc", "Accessoires", "Ruban adhésif gaine", "rouleau", "u", 3, S.vmc.prices.ruban));
    items.push(item("vmc", "Accessoires", "Sortie toiture / grillage", "", "u", 1, S.vmc.prices.sortie_toiture));
  }

  // ----- CHAUFFAGE -----
  const heatM2 = rooms.filter((r) => r.floorHeating).reduce((s, r) => s + r.length * r.width, 0);
  const pasM = S.chauffage.pasMm / 1000;
  const tubeM = pasM > 0 ? waste(heatM2 / pasM, S.chauffage.wastePct) : 0;
  const loops = Math.max(1, Math.ceil(tubeM / S.chauffage.maxLoopM));
  const collecteurs = Math.max(1, Math.ceil(loops / 10));
  const puissanceW = heatM2 * 55; // W, well insulated house ~40-70

  if (heatM2 > 0) {
    items.push(item("chauffage", "Plancher", `Tube PER-a / PER-b Ø${S.chauffage.tubeDiameter}`, `pas ${S.chauffage.pasMm} mm`, "m", Math.ceil(tubeM), S.chauffage.prices.tube_per_16, `${fmt(heatM2)} m² chauffants`));
    items.push(item("chauffage", "Plancher", "Sortie de collecteur (départ+retour)", "", "u", loops, S.chauffage.prices.collecteur_sortie));
    items.push(item("chauffage", "Plancher", "Armoire / coffret collecteur", "", "u", collecteurs, S.chauffage.prices.armoire_collecteur));
    items.push(item("chauffage", "Plancher", "Agrafes / cavaliers de fixation", "boîte 100", "boîte", Math.ceil((heatM2 * 8) / 100), S.chauffage.prices.agrafe_100, "~8 / m²"));
    items.push(item("chauffage", "Plancher", "Bande périphérique 5 mm", "désolidarisation chape", "m", Math.ceil(rooms.filter((r) => r.floorHeating).reduce((s, r) => s + 2 * (r.length + r.width), 0)), S.chauffage.prices.bande_peripherique));
    items.push(item("chauffage", "Plancher", "Film polyane 150 µm", "m²", "m²", Math.ceil(waste(heatM2, 10)), S.chauffage.prices.film_polyane));
    items.push(item("chauffage", "Régulation", "Servomoteur électrothermique", "", "u", loops, S.chauffage.prices.servomoteur));
    const nThermo = new Set(rooms.filter((r) => r.floorHeating).map((r) => r.id)).size;
    items.push(item("chauffage", "Régulation", S.elec.connected ? "Thermostat d'ambiance connecté" : "Thermostat d'ambiance", "1 / zone", "u", Math.min(nThermo, Math.max(1, collecteurs * 4)), S.elec.connected ? S.chauffage.prices.thermostat_connecte : S.chauffage.prices.thermostat));
    items.push(item("chauffage", "Chape", "Chape fluide (estimation pose+mat.)", "m²", "m²", Math.ceil(heatM2), S.chauffage.prices.chape_m2, "Après mise en pression 6 bar"));
  }
  if (rooms.length) {
    items.push(item("chauffage", "Production", `Pompe à chaleur air/eau ${S.chauffage.pacPuissanceKw} kW`, "fourniture seule — dimensionnement final à valider sur les déperditions du logement", "u", 1, S.chauffage.prices.pac_air_eau ?? S.chauffage.pacPrix, `Besoin indicatif ${Math.round(puissanceW / 1000 * 10) / 10} kW à 55 W/m²`));
    items.push(item("chauffage", "Production", `Ballon ECS ${S.chauffage.ballonL} L`, "thermodynamique ou sur PAC", "u", 1, S.chauffage.prices.ballon));
    items.push(item("chauffage", "Production", "Glycol / antigel PAC", "bidon 20 L", "u", 2, S.chauffage.prices.glycol_20l));
    items.push(item("chauffage", "Production", "Vanne 3 voies + circulateur", "si non inclus PAC", "u", 1, S.chauffage.prices.vanne_3voies + S.chauffage.prices.circulateur));
  }

  // ----- PEINTURE -----
  let paintWallM2 = 0;
  let paintCeilM2 = 0;
  let paintFloorM2 = 0;
  for (const pr of perRoom) {
    if (pr.room.paintWalls) paintWallM2 += pr.surfaces.wallsNet;
    if (pr.room.paintCeiling) paintCeilM2 += pr.surfaces.ceiling;
    if (pr.room.paintFloor) paintFloorM2 += pr.surfaces.floor;
  }
  const floorLiters = waste((paintFloorM2 * S.peinture.coatsFloor) / S.peinture.yieldFloor, S.peinture.wastePct);
  const primerM2 = S.peinture.sousCouche ? paintWallM2 + paintCeilM2 : 0;
  const primerLiters = waste(primerM2 / S.peinture.yieldPrimer, S.peinture.wastePct);

  // Murs et plafonds : regroupés par PRODUIT du catalogue (1 produit = 1 pot + 1 rendement + 1 prix).
  // Chaque pièce choisit sa peinture murs et sa peinture plafond dans l'onglet Peinture.
  const groupPaint = (
    kind: "mur" | "plafond",
    coats: number,
    getM2: (pr: (typeof perRoom)[number]) => number,
  ) => {
    const groups = new Map<string, { p: ResolvedPaint; m2: number; rooms: string[] }>();
    for (const pr of perRoom) {
      const m2 = getM2(pr);
      if (m2 <= 0.05) continue;
      const p = resolvePaint(S, pr.room, kind);
      const g = groups.get(p.id) ?? { p, m2: 0, rooms: [] };
      g.m2 += m2;
      g.rooms.push(pr.room.name);
      groups.set(p.id, g);
    }
    const sorted = [...groups.values()].sort((a, b) => b.m2 - a.m2);
    const multi = sorted.length > 1;
    for (const g of sorted) {
      const y = Math.max(0.5, g.p.yieldM2L);
      const pot = Math.max(0.5, g.p.potL);
      const liters = waste((g.m2 * coats) / y, S.peinture.wastePct);
      const m2PerPot = pot * y;
      items.push(
        item(
          "peinture",
          kind === "mur" ? "Murs" : "Plafonds",
          multi ? `${g.p.name} — ${g.rooms.slice(0, 3).join(", ")}${g.rooms.length > 3 ? "…" : ""}` : g.p.name,
          `pot ${pot} L — ${y} m²/L (≈ ${Math.round(m2PerPot)} m²/pot), ${coats} couche(s)`,
          "pot",
          Math.max(1, Math.ceil(liters / pot)),
          g.p.pricePot,
          `${fmt(g.m2)} m² · ${fmt(liters)} L`,
          { photo: g.p.photo, productId: g.p.id.startsWith("__") ? undefined : g.p.id },
        ),
      );
    }
  };

  groupPaint("mur", S.peinture.coatsWall, (pr) => (pr.room.paintWalls ? pr.surfaces.wallsNet : 0));
  groupPaint("plafond", S.peinture.coatsCeiling, (pr) => (pr.room.paintCeiling ? pr.surfaces.ceiling : 0));
  if (floorLiters > 0)
    items.push(item("peinture", "Sols", "Peinture de sol", `pot ${S.peinture.potL} L`, "pot", Math.max(1, Math.ceil(floorLiters / S.peinture.potL)), S.peinture.prices.peinture_sol_10l, `${fmt(paintFloorM2)} m²`));
  if (primerLiters > 0)
    items.push(item("peinture", "Sous-couche", "Impression / sous-couche placo", `pot ${S.peinture.primerPotL} L`, "pot", Math.max(1, Math.ceil(primerLiters / S.peinture.primerPotL)), S.peinture.prices.sous_couche_10l, `${fmt(primerM2)} m²`));
  const wetPaint = rooms.filter((r) => ROOM_TYPES.find((t) => t.id === r.type)?.wet && r.paintWalls).length;
  if (wetPaint)
    items.push(item("peinture", "Sous-couche", "Sous-couche pièces humides", "pot 10 L", "pot", Math.max(1, wetPaint), S.peinture.prices.sous_couche_hydro));
  items.push(item("peinture", "Consommables", "Ruban de masquage", "rouleau", "u", Math.max(6, rooms.length), S.peinture.prices.ruban_masque));
  items.push(item("peinture", "Consommables", "Bâche de protection", "", "u", Math.max(3, Math.ceil(surf.floor / 30)), S.peinture.prices.bache));
  items.push(item("peinture", "Consommables", "Rouleau + manchon", "", "u", 6, S.peinture.prices.rouleau));
  items.push(item("peinture", "Consommables", "Bac à peinture", "", "u", 3, S.peinture.prices.bac));
  items.push(item("peinture", "Consommables", "Pinceaux assortis", "", "u", 4, S.peinture.prices.pinceau));
  items.push(item("peinture", "Consommables", "Enduit de rebouchage", "pot", "u", 2, S.peinture.prices.enduit_rebouchage));

  // ----- CARRELAGE -----
  let tileFloor = 0;
  let tileWall = 0;
  let wetFloor = 0;
  for (const pr of perRoom) {
    if (pr.room.tileFloor) {
      tileFloor += pr.surfaces.floor;
      if (ROOM_TYPES.find((t) => t.id === pr.room.type)?.wet) wetFloor += pr.surfaces.floor;
    }
    if (pr.room.tileWalls) {
      tileWall += Math.max(0, pr.surfaces.perimeter * pr.room.tileWallHeight - pr.surfaces.openingsSingle);
    }
  }
  const tileM2 = tileFloor + tileWall;
  if (tileM2 > 0.05) {
    // Carreaux regroupés par PRODUIT du catalogue (1 produit = 1 format + 1 prix).
    // Chaque pièce choisit son produit sol et son produit mur dans l'onglet Carrelage.
    const tileGroups = new Map<string, { p: ResolvedTile; m2: number; rooms: string[]; kind: string }>();
    const pushTile = (kind: "sol" | "faïence", p: ResolvedTile, m2: number, roomName: string) => {
      if (m2 <= 0.05) return;
      const key = `${kind}|${p.id}`;
      const g = tileGroups.get(key) ?? { p, m2: 0, rooms: [], kind };
      g.m2 += m2;
      g.rooms.push(roomName);
      tileGroups.set(key, g);
    };
    for (const pr of perRoom) {
      const r = pr.room;
      if (r.tileFloor) pushTile("sol", resolveTile(S, r, "sol"), pr.surfaces.floor, r.name);
      if (r.tileWalls) {
        const m2 = Math.max(0, pr.surfaces.perimeter * r.tileWallHeight - pr.surfaces.openingsSingle);
        pushTile("faïence", resolveTile(S, r, "mur"), m2, r.name);
      }
    }
    const sortedTiles = [...tileGroups.values()].sort((a, b) => b.m2 - a.m2);
    const multi = sortedTiles.length > 1;
    for (const g of sortedTiles) {
      const m2Waste = Math.ceil(waste(g.m2, S.carrelage.wastePct));
      const area = Math.max(0.01, g.p.tileL * g.p.tileW);
      const tiles = Math.ceil(waste(g.m2, S.carrelage.wastePct) / area);
      items.push(
        item(
          "carrelage",
          "Carreaux",
          multi ? `${g.p.name} (${g.kind}) — ${g.rooms.slice(0, 3).join(", ")}${g.rooms.length > 3 ? "…" : ""}` : g.p.name,
          `${Math.round(g.p.tileL * 100)}×${Math.round(g.p.tileW * 100)} cm`,
          "m²",
          m2Waste,
          g.p.priceM2,
          `${tiles} dalles · ${fmt(g.m2)} m²`,
          { photo: g.p.photo, productId: g.p.id.startsWith("__") ? undefined : g.p.id },
        ),
      );
    }
    if (S.carrelage.natte && tileFloor > 0) {
      items.push(item("carrelage", "Natte", "Natte de désolidarisation", `${S.carrelage.natteL}×${S.carrelage.natteW} m / rouleau`, "m²", Math.ceil(waste(tileFloor, 8)), S.carrelage.prices.natte_m2));
    }
    const colleKg = waste(tileM2 * S.carrelage.colleKgM2, 8);
    items.push(item("carrelage", "Colle", "Mortier-colle C2 S1", "sac 25 kg", "sac", Math.max(1, Math.ceil(colleKg / 25)), S.carrelage.prices.colle_25kg, `${fmt(colleKg)} kg · ${S.carrelage.colleKgM2} kg/m²`));
    const jointKg = waste(tileM2 * S.carrelage.jointKgM2, 15);
    items.push(item("carrelage", "Joints", `Joint ${S.carrelage.jointMm} mm`, "sac 5 kg", "sac", Math.max(1, Math.ceil(jointKg / 5)), S.carrelage.prices.joint_5kg, `${fmt(jointKg)} kg`));
    items.push(item("carrelage", "Primaire", "Primaire d'accrochage", "bidon 5 L", "u", Math.max(1, Math.ceil((tileM2 * S.carrelage.primaireLperM2) / 5)), S.carrelage.prices.primaire_5l));
    items.push(item("carrelage", "Accessoires", "Croisillons", "sachet 500", "sachet", Math.max(1, Math.ceil(tileM2 / 8)), S.carrelage.prices.croisillons_500));
    items.push(item("carrelage", "Accessoires", "Croisillons autonivelants", "sachet 100", "sachet", Math.max(1, Math.ceil(tileM2 / 6)), S.carrelage.prices.croisillons_autonivel_100, "Grands formats ≥ 60 cm"));
    items.push(item("carrelage", "Accessoires", "Profilé d'arrêt / nez de marche", "barre 3 m", "u", Math.max(2, Math.ceil(tileWall / 8)), S.carrelage.prices.profile_3m));
    const plintheCarrel = rooms.filter((r) => r.tileFloor).reduce((s, r) => s + 2 * (r.length + r.width) - r.openings.filter((o) => o.type === "porte").reduce((a, o) => a + o.width, 0), 0);
    items.push(item("carrelage", "Plinthes", "Plinthe carrelage / carreau retombé", "ml", "m", Math.ceil(waste(plintheCarrel, 10)), S.carrelage.prices.plinthe_carrelage_ml));
    items.push(item("carrelage", "Outils", "Peigne / spatule crantée", "", "u", 2, S.carrelage.prices.spatule));
    items.push(item("carrelage", "Outils", "Ventouse de pose", "", "u", 2, S.carrelage.prices.ventouse));
  }
  if (S.carrelage.spec && (wetFloor > 0 || tileWall > 0)) {
    items.push(item("carrelage", "Étanchéité", "Kit SPEC / SEL pièces humides", "sous carrelage douche", "u", Math.max(1, nSdb), S.carrelage.prices.spe_kit, "CPT / DTU 52.2 — receveur à carreler ou à poser"));
  }

  // ----- QUINCAILLERIE -----
  const interiorDoors = parts.reduce((s, p) => s + p.doorCount, 0) || (rooms.length ? Math.max(0, rooms.length - 1) : 0);
  if (interiorDoors > 0) {
    items.push(item("quincaillerie", "Portes", "Porte intérieure postformée", `largeur ${S.quincaillerie.porteWidth * 100} cm`, "u", interiorDoors, S.quincaillerie.prices.porte_iso));
    items.push(item("quincaillerie", "Portes", "Huisserie / chambranle", "", "u", interiorDoors, S.quincaillerie.prices.huisserie));
    items.push(item("quincaillerie", "Portes", "Poignée / béquille", "rosaces", "u", interiorDoors, S.quincaillerie.prices.poignee));
    items.push(item("quincaillerie", "Portes", "Paumelles", "3 / porte", "u", interiorDoors * 3, S.quincaillerie.prices.paumelle));
    items.push(item("quincaillerie", "Portes", "Serrure à condamnation", "", "u", interiorDoors, S.quincaillerie.prices.serrure));
    items.push(item("quincaillerie", "Portes", "Mousse PU pistolet", "bombonne", "u", Math.max(2, interiorDoors), S.quincaillerie.prices.mousse_pu));
    items.push(item("quincaillerie", "Portes", "Calés de pose", "sachet 50", "sachet", Math.max(1, Math.ceil(interiorDoors / 3)), S.quincaillerie.prices.cales_50));
  }

  const plintheLm = rooms.reduce((s, r) => {
    if (r.tileFloor) return s;
    const peri = 2 * (r.length + r.width);
    const doors = r.openings.filter((o) => o.type === "porte").reduce((a, o) => a + o.width, 0);
    return s + Math.max(0, peri - doors);
  }, 0);
  // subtract partition doors roughly
  const plintheNet = Math.max(0, plintheLm - interiorDoors * 0.8);
  if (plintheNet > 0) {
    items.push(item("quincaillerie", "Plinthes", `Plinthe MDF/massif H ${S.quincaillerie.plintheH} mm`, `barre ${S.quincaillerie.plintheL} m`, "barre", Math.ceil(waste(plintheNet, S.quincaillerie.wastePct) / S.quincaillerie.plintheL), S.quincaillerie.prices.plinthe_ml * S.quincaillerie.plintheL, `${fmt(plintheNet)} ml`));
    items.push(item("quincaillerie", "Plinthes", "Angles / raccord plinthe", "", "u", rooms.length * 4, S.quincaillerie.prices.angle_plinthe));
    items.push(item("quincaillerie", "Plinthes", "Pointes / vis plinthes", "boîte", "boîte", Math.max(1, Math.ceil(plintheNet / 20)), S.quincaillerie.prices.vis_plinthe_boite));
  }
  if (rooms.length) {
    const parquetM2 = rooms.filter((r) => r.solType === "parquet").reduce((s, r) => s + r.length * r.width, 0);
    if (parquetM2 > 0) {
      items.push(item("quincaillerie", "Parquet", "Parquet (fourniture)", "m² + 10 % chutes", "m²", Math.ceil(waste(parquetM2, 10)), 42, `${fmt(parquetM2)} m²`));
      items.push(item("quincaillerie", "Parquet", "Sous-couche parquet / solivage", "m²", "m²", Math.ceil(waste(parquetM2, 8)), 3.8));
      items.push(item("quincaillerie", "Parquet", "Barre de seuil", "u", "u", Math.max(1, interiorDoors), 18));
    }
    items.push(item("quincaillerie", "Étanchéité", "Silicone sanitaire", "cartouche", "u", Math.max(4, nSdb * 3 + nCuisine * 2), S.quincaillerie.prices.silicone));
    items.push(item("quincaillerie", "Étanchéité", "Mastic acrylique (plinthes, fissures)", "cartouche", "u", Math.max(4, rooms.length), S.quincaillerie.prices.acrylique));
    items.push(item("quincaillerie", "Visserie", "Coffret vis assorties", "", "u", 2, S.quincaillerie.prices.vis_assortie));
    items.push(item("quincaillerie", "Visserie", "Coffret chevilles assorties", "", "u", 2, S.quincaillerie.prices.cheville_assortie));
    items.push(item("quincaillerie", "EPI", "Casque de chantier", "", "u", 2, S.quincaillerie.prices.epi_casque));
    items.push(item("quincaillerie", "EPI", "Gants", "paires", "u", 6, S.quincaillerie.prices.gants));
    items.push(item("quincaillerie", "EPI", "Lunettes de protection", "", "u", 2, S.quincaillerie.prices.lunettes));
    items.push(item("quincaillerie", "EPI", "Masques FFP2 (boîte)", "placo / isolation", "u", 2, S.quincaillerie.prices.masque_fpp2));
  }

  // Filter empty
  const clean = items.filter((i) => i.quantity > 0 && Number.isFinite(i.quantity));

  // Relie chaque ligne au matériau dont elle tire son prix unitaire : permet
  // d'afficher le lien d'achat saisi dans l'onglet Matériaux (clé mat:post:priceKey).
  const priceMaps: Partial<Record<PostId, Record<string, number>>> = {
    placo: S.placo.prices,
    isolation: S.isolation.prices,
    electricite: S.elec.prices,
    sanitaire: S.sanitaire.prices,
    vmc: S.vmc.prices,
    chauffage: S.chauffage.prices,
    peinture: S.peinture.prices,
    carrelage: S.carrelage.prices,
    quincaillerie: S.quincaillerie.prices,
  };
  for (const i of clean) {
    const rec = priceMaps[i.post];
    if (!rec) continue;
    const matches = Object.entries(rec).filter(([, v]) => v === i.unitPrice);
    if (matches.length === 1) i.linkKey = matches[0][0];
  }

  const byPost = {} as Record<PostId, LineItem[]>;
  const costByPost = {} as Record<PostId, number>;
  const marginByPost = {} as Record<PostId, number>;
  const costWithMarginByPost = {} as Record<PostId, number>;
  const posts: PostId[] = ["placo", "isolation", "electricite", "sanitaire", "vmc", "chauffage", "peinture", "carrelage", "quincaillerie"];
  for (const p of posts) {
    byPost[p] = clean.filter((i) => i.post === p);
    costByPost[p] = byPost[p].reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    marginByPost[p] = (costByPost[p] * postMarginPct(S, p)) / 100;
    costWithMarginByPost[p] = costByPost[p] + marginByPost[p];
  }
  const costTotal = clean.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const costWithMarginTotal = posts.reduce((s, p) => s + costWithMarginByPost[p], 0);

  const target = QUALITY_TARGETS[S.isolation.quality];
  const rMur = rValue(murIsolant.lambda, murIsolant.thickness);
  const rCloison = rValue(cloisonIsolant.lambda, cloisonIsolant.thickness);
  const rSol = rValue(solIsolant.lambda, solIsolant.thickness);
  const rPlafond = rValue(plafondIsolant.lambda, plafondIsolant.thickness);

  const comparisons = isolants.filter((i) => i.usages.includes("mur")).map((i) => {
    const r = rValue(i.lambda, i.thickness);
    return {
      id: i.id,
      name: i.name,
      family: i.family,
      thickness: i.thickness,
      r,
      priceM2: i.priceM2,
      bio: i.bio,
      ok: r >= target.rMur,
      notes: i.notes,
    };
  });

  const perFloor = project.floors.map((floor) => {
    const st = totals([floor]);
    // approximate cost share by floor area
    const share = surf.floor > 0 ? st.floor / surf.floor : 0;
    return { floor, surfaces: st, cost: costTotal * share };
  });

  return {
    items: clean,
    byPost,
    costByPost,
    costTotal,
    marginByPost,
    costWithMarginByPost,
    costWithMarginTotal,
    surfaces: surf,
    elec: elecNeeds,
    isolation: {
      rMur,
      rCloison,
      rSol,
      rPlafond,
      target,
      re2020Mur: rMur >= 4,
      re2020Sol: rSol >= 3.2,
      re2020Plafond: rPlafond >= 6 || comblesM2 === 0,
      murIsolant,
      cloisonIsolant,
      solIsolant,
      comparisons,
    },
    perRoom,
    perFloor,
    chauffage: {
      surface: heatM2,
      tubeM,
      loops,
      collecteurs,
      puissanceW,
    },
  };
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

export function lineTotal(i: LineItem) {
  return i.quantity * i.unitPrice;
}

export interface RoomMaterialLine {
  post: PostId;
  name: string;
  qty: number;
  unit: string;
  note?: string;
}

/**
 * Détail des matériaux prévus pour UNE pièce (quantités arrondies à l'unité
 * d'achat). Les éléments partagés du chantier (tableau électrique, PAC,
 * caisson VMC, consommables globaux…) ne sont pas ventilés par pièce.
 */
export function roomMaterials(project: Project, roomId: string): RoomMaterialLine[] {
  const S = project.settings;
  const floor = project.floors.find((f) => f.rooms.some((r) => r.id === roomId));
  const room = floor?.rooms.find((r) => r.id === roomId);
  if (!floor || !room) return [];
  const scale = floor.planScale || 40;
  const rs = roomSurfaces(room);
  const edges = roomEdges(room, scale);
  const out: RoomMaterialLine[] = [];
  const isolants = S.isolants?.length ? S.isolants : ISOLANTS;

  const plaqueSz = (type: string) => {
    const sz = S.placo.plaqueSizes?.[type];
    const l = sz?.l && sz.l > 0 ? sz.l : S.placo.plaqueL;
    const w = sz?.w && sz.w > 0 ? sz.w : S.placo.plaqueW;
    return { l, w, m2: Math.max(0.1, l * w) };
  };

  // ---- PLACO murs (par type de paroi, passages exclus) ----
  const openingsArea = room.openings.reduce((s, o) => s + o.width * o.height * (o.wall === "cloison" ? 2 : 1), 0);
  const byType = new Map<string, number>();
  let grossWalls = 0;
  for (const e of edges) {
    if (e.passage) continue;
    const m2 = e.lengthM * room.height;
    grossWalls += m2;
    byType.set(e.placoType, (byType.get(e.placoType) ?? 0) + m2);
  }
  const wallFactor = grossWalls > 0 ? Math.max(0, grossWalls - openingsArea) / grossWalls : 0;
  let placoM2 = 0;
  for (const [type, m2raw] of byType) {
    const m2 = m2raw * wallFactor;
    placoM2 += m2;
    const sz = plaqueSz(type);
    out.push({
      post: "placo",
      name: `Plaque ${PLAQUE_INFO[type as Room["placoType"]]?.label ?? type} (${sz.l}×${sz.w} m)`,
      qty: Math.ceil(waste(m2, S.placo.wastePct) / sz.m2),
      unit: "plaques",
      note: `murs · ${fmt(m2)} m²`,
    });
  }
  if (room.placoCeiling) {
    const type = room.placoType === "hydro" ? "hydro" : "ba13";
    const sz = plaqueSz(type);
    placoM2 += rs.ceiling;
    out.push({
      post: "placo",
      name: `Plaque ${PLAQUE_INFO[type as Room["placoType"]].label} (${sz.l}×${sz.w} m)`,
      qty: Math.ceil(waste(rs.ceiling, S.placo.wastePct) / sz.m2),
      unit: "plaques",
      note: `plafond · ${fmt(rs.ceiling)} m²`,
    });
    out.push({
      post: "placo",
      name: `Fourrure F530 (${S.placo.fourrureLength || 3} m)`,
      qty: Math.ceil(waste(Math.ceil(room.width / 0.5) * room.length, 10) / (S.placo.fourrureLength || 3)),
      unit: "barres",
      note: "ossature plafond",
    });
  }
  if (placoM2 > 0.05) {
    out.push({ post: "placo", name: "Vis à placo", qty: Math.ceil(waste(placoM2 * S.placo.visPerM2, 5)), unit: "vis" });
    out.push({ post: "placo", name: "Bande à joint", qty: Math.ceil(waste(placoM2 * S.placo.bandePerM2, 10)), unit: "m" });
    out.push({
      post: "placo",
      name: "Enduit à joint",
      qty: Math.round(waste(placoM2 * S.placo.enduitJointKgM2, 10) * 10) / 10,
      unit: "kg",
    });
  }

  // ---- ISOLATION murs extérieurs ----
  const extLen = edges.filter((e) => e.exterior && !e.passage).reduce((s, e) => s + e.lengthM, 0);
  if (extLen > 0.05) {
    const extOpen = room.openings
      .filter((o) => o.wall === "exterieur")
      .reduce((s, o) => s + o.width * o.height, 0);
    const extM2 = Math.max(0, extLen * room.height - extOpen);
    const iso = isolants.find((i) => i.id === S.isolation.isolantMurId) ?? isolants[0];
    const panelM2 = Math.max(0.1, iso.panelL * iso.panelW);
    out.push({
      post: "isolation",
      name: `${iso.name} ${iso.thickness} mm`,
      qty: Math.ceil(waste(extM2, S.isolation.wastePct) / panelM2),
      unit: "panneaux",
      note: `${fmt(extM2)} m² de murs extérieurs`,
    });
    const nMont = Math.ceil(extLen / S.isolation.appuisHSpacing) + 1;
    const nVert = Math.max(2, Math.ceil(room.height / S.isolation.appuisVSpacing) + 1);
    out.push({ post: "isolation", name: "Appuis d'isolation", qty: nMont * nVert, unit: "u" });
    out.push({ post: "isolation", name: "Pare-vapeur", qty: Math.ceil(waste(extM2, 15)), unit: "m²" });
  }

  // ---- ÉLECTRICITÉ ----
  const d = defaultElec(room);
  const connP = room.elec.override ? room.elec.prisesConnectees ?? 0 : room.elec.prisesConnected ? d.prises : 0;
  const connI = room.elec.override ? room.elec.intersConnectes ?? 0 : room.elec.interConnected ? d.interrupteurs : 0;
  const prisesStd = Math.max(0, d.prises - connP);
  if (prisesStd) out.push({ post: "electricite", name: "Prise 16 A classique", qty: prisesStd, unit: "u" });
  if (connP) out.push({ post: "electricite", name: "Prise 16 A connectée", qty: connP, unit: "u" });
  if (d.interrupteurs)
    out.push({
      post: "electricite",
      name: "Interrupteur simple (classique)",
      qty: d.interrupteurs,
      unit: "u",
      note: connI ? `dont ${connI} piloté(s) par micro-module` : undefined,
    });
  if (connI) {
    out.push({ post: "electricite", name: "Micro-module connecté (derrière l'inter)", qty: connI, unit: "u" });
    out.push({ post: "electricite", name: "Boîte d'encastrement PROFONDE 50 mm", qty: connI, unit: "u" });
  }
  if (d.vaEtVient) out.push({ post: "electricite", name: "Va-et-vient", qty: d.vaEtVient, unit: "u" });
  if (d.dcl) out.push({ post: "electricite", name: "DCL plafond (point lumineux)", qty: d.dcl, unit: "u" });
  if (d.spots) out.push({ post: "electricite", name: "Spot encastré", qty: d.spots, unit: "u" });
  if (d.rj45) out.push({ post: "electricite", name: "Prise RJ45 (réseau)", qty: d.rj45, unit: "u" });
  if (d.tv) out.push({ post: "electricite", name: "Prise TV", qty: d.tv, unit: "u" });
  const muraux = d.prises + d.interrupteurs + d.vaEtVient + d.poussoirs + d.rj45 + d.tv;
  if (muraux) {
    out.push({ post: "electricite", name: "Boîte d'encastrement 40 mm", qty: Math.max(0, muraux - connI), unit: "u" });
    out.push({ post: "electricite", name: "Plaque de finition (cache)", qty: muraux, unit: "u" });
  }

  // ---- PEINTURE ----
  if (room.paintWalls && rs.wallsNet > 0.05) {
    const p = resolvePaint(S, room, "mur");
    const liters = waste((rs.wallsNet * S.peinture.coatsWall) / Math.max(0.5, p.yieldM2L), S.peinture.wastePct);
    out.push({
      post: "peinture",
      name: p.name,
      qty: Math.max(1, Math.ceil(liters / Math.max(0.5, p.potL))),
      unit: `pot(s) de ${p.potL} L`,
      note: `murs · ${fmt(rs.wallsNet)} m² · ${fmt(liters)} L (≈ ${Math.round(p.potL * p.yieldM2L)} m²/pot)`,
    });
  }
  if (room.paintCeiling && rs.ceiling > 0.05) {
    const p = resolvePaint(S, room, "plafond");
    const liters = waste((rs.ceiling * S.peinture.coatsCeiling) / Math.max(0.5, p.yieldM2L), S.peinture.wastePct);
    out.push({
      post: "peinture",
      name: p.name,
      qty: Math.max(1, Math.ceil(liters / Math.max(0.5, p.potL))),
      unit: `pot(s) de ${p.potL} L`,
      note: `plafond · ${fmt(rs.ceiling)} m² (≈ ${Math.round(p.potL * p.yieldM2L)} m²/pot)`,
    });
  }

  // ---- CARRELAGE ----
  if (room.tileFloor) {
    const t = resolveTile(S, room, "sol");
    const dalles = Math.ceil(waste(rs.floor, S.carrelage.wastePct) / Math.max(0.01, t.tileL * t.tileW));
    out.push({
      post: "carrelage",
      name: `${t.name} ${Math.round(t.tileL * 100)}×${Math.round(t.tileW * 100)} cm`,
      qty: Math.ceil(waste(rs.floor, S.carrelage.wastePct)),
      unit: "m²",
      note: `sol · ${dalles} dalles`,
    });
    out.push({
      post: "carrelage",
      name: "Mortier-colle",
      qty: Math.round(waste(rs.floor * S.carrelage.colleKgM2, 8) * 10) / 10,
      unit: "kg",
    });
    if (S.carrelage.natte) out.push({ post: "carrelage", name: "Natte de désolidarisation", qty: Math.ceil(waste(rs.floor, 8)), unit: "m²" });
  }
  if (room.tileWalls) {
    const m2 = Math.max(0, rs.perimeter * room.tileWallHeight - rs.openingsSingle);
    const t = resolveTile(S, room, "mur");
    const dalles = Math.ceil(waste(m2, S.carrelage.wastePct) / Math.max(0.01, t.tileL * t.tileW));
    out.push({
      post: "carrelage",
      name: `${t.name} ${Math.round(t.tileL * 100)}×${Math.round(t.tileW * 100)} cm (h ${fmt(room.tileWallHeight)} m)`,
      qty: Math.ceil(waste(m2, S.carrelage.wastePct)),
      unit: "m²",
      note: `murs · ${dalles} carreaux`,
    });
  }

  // ---- CHAUFFAGE / SOL ----
  if (room.floorHeating) {
    const pasM = (S.chauffage.pasMm || 150) / 1000;
    out.push({
      post: "chauffage",
      name: `Tube plancher chauffant Ø${S.chauffage.tubeDiameter}`,
      qty: Math.ceil(waste(rs.floor / pasM, S.chauffage.wastePct)),
      unit: "m",
      note: `pas ${S.chauffage.pasMm} mm`,
    });
  }
  if (!room.tileFloor && room.solType === "parquet") {
    out.push({ post: "quincaillerie", name: "Parquet", qty: Math.ceil(waste(rs.floor, 10)), unit: "m²" });
  }
  if (!room.tileFloor) {
    const doors = room.openings.filter((o) => o.type === "porte").reduce((a, o) => a + o.width, 0);
    const ml = Math.max(0, rs.perimeter - doors);
    if (ml > 0.1) out.push({ post: "quincaillerie", name: "Plinthes", qty: Math.round(waste(ml, S.quincaillerie.wastePct) * 10) / 10, unit: "m" });
  }

  return out;
}

/** Clé stable d'une ligne de quantitatif (pour la sélection de la liste de courses). */
export function lineKey(i: LineItem) {
  return `${i.post}|${i.category}|${i.name}|${i.spec}`;
}

export function groupByCategory(items: LineItem[]) {
  const map = new Map<string, LineItem[]>();
  for (const i of items) {
    const arr = map.get(i.category) ?? [];
    arr.push(i);
    map.set(i.category, arr);
  }
  return [...map.entries()];
}
