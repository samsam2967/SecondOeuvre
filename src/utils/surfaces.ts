import type { Floor, Opening, Partition, PlaqueType, Pt, Room, RoomSurfaces } from "../types";
import { advisedPrises, ELEC_NORMS } from "../data/catalogs";
import { dist } from "./geometry";

export function openingArea(o: Opening) {
  return o.width * o.height;
}

/**
 * Déduction d'une ouverture dans les surfaces de placo / peinture.
 * Une porte ou une baie dans une CLOISON perce les deux faces (notre pièce et la
 * pièce voisine) : on la déclare UNE SEULE FOIS et elle compte double ici.
 * Une ouverture en mur extérieur ou plafond ne perce qu'une face côté intérieur.
 */
export function openingDeduction(o: Opening) {
  return o.width * o.height * (o.wall === "cloison" ? 2 : 1);
}

export interface WallEdgeInfo {
  index: number;
  lengthM: number;
  exterior: boolean;
  placoType: PlaqueType | "none";
  passage: boolean;
}

/** Découpe les parois d'une pièce : type de placo, mur extérieur, passage sans placo. */
export function roomEdges(room: Room, scale: number): WallEdgeInfo[] {
  const pts: Pt[] =
    room.points && room.points.length >= 3
      ? room.points
      : [
          { x: room.x, y: room.y },
          { x: room.x + room.length * scale, y: room.y },
          { x: room.x + room.length * scale, y: room.y + room.width * scale },
          { x: room.x, y: room.y + room.width * scale },
        ];
  const s = Math.max(1e-6, scale);
  const raw = pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length];
    return { index: i, lengthM: dist(p, q) / s };
  });

  // Murs extérieurs : si l'utilisateur n'a rien précisé, on affecte les parois
  // les plus longues jusqu'à atteindre le linéaire extérieur saisi.
  let exteriorSet = new Set(room.exteriorEdges ?? []);
  if (exteriorSet.size === 0 && room.exteriorWallLength > 0) {
    const target = room.exteriorWallLength;
    const sorted = [...raw].sort((a, b) => b.lengthM - a.lengthM);
    let sum = 0;
    for (const e of sorted) {
      if (sum >= target - 0.05) break;
      exteriorSet.add(e.index);
      sum += e.lengthM;
    }
  }

  return raw.map((e) => {
    const override = room.wallTypes?.[String(e.index)];
    const type = (override ?? room.placoType) as PlaqueType | "none";
    return {
      ...e,
      exterior: exteriorSet.has(e.index),
      placoType: type,
      passage: type === "none" || !room.placoWalls,
    };
  });
}

export function roomSurfaces(room: Room): RoomSurfaces {
  const floor = room.areaM2 > 0.05 ? room.areaM2 : room.length * room.width;
  const ceiling = floor;
  const perimeter = room.perimeterM > 0.05 ? room.perimeterM : 2 * (room.length + room.width);
  const wallsGross = perimeter * room.height;
  // Déduction placo/peinture : les ouvertures en cloison comptent double (2 faces).
  const openings = room.openings.reduce((s, o) => s + openingDeduction(o), 0);
  // Côté pièce uniquement (1 face) : utilisé pour la faïence murale.
  const openingsSingle = room.openings.reduce((s, o) => s + openingArea(o), 0);
  const wallsNet = Math.max(0, wallsGross - openings);
  const extOpen = room.openings
    .filter((o) => o.wall === "exterieur")
    .reduce((s, o) => s + openingArea(o), 0);
  const exteriorWalls = Math.max(0, room.exteriorWallLength * room.height - extOpen);
  return {
    floor,
    ceiling,
    wallsGross,
    openings,
    openingsSingle,
    wallsNet,
    exteriorWalls,
    perimeter,
    volume: floor * room.height,
  };
}

export function partitionArea(p: Partition) {
  const doors = p.doorCount * p.doorWidth * 2.04;
  return Math.max(0, p.length * p.height - doors);
}

export function allRooms(floors: Floor[]) {
  return floors.flatMap((f) => f.rooms);
}

export function allPartitions(floors: Floor[]) {
  return floors.flatMap((f) => f.partitions);
}

export function totals(floors: Floor[]) {
  const rooms = allRooms(floors);
  const parts = allPartitions(floors);
  let floor = 0;
  let walls = 0;
  let exterior = 0;
  let volume = 0;
  let ceiling = 0;
  for (const r of rooms) {
    const s = roomSurfaces(r);
    floor += s.floor;
    walls += s.wallsNet;
    exterior += s.exteriorWalls;
    volume += s.volume;
    ceiling += s.ceiling;
  }
  const cloison = parts.reduce((s, p) => s + partitionArea(p), 0);
  const cloisonLm = parts.reduce((s, p) => s + p.length, 0);
  return { floor, walls, exterior, volume, ceiling, cloison, cloisonLm, rooms: rooms.length, partitions: parts.length };
}

/**
 * Appareillage électrique effectif d'une pièce.
 *
 * Convention : `prises` et `interrupteurs` = nombre de POINTS (NF C 15-100).
 * Une prise double compte pour 2 points, une triple pour 3, un interrupteur
 * double pour 2 points de commande. Les « simples » sont le reste.
 * Si les doubles / triples dépassent la norme, le total est relevé en conséquence.
 */
export function defaultElec(room: Room) {
  const area = room.length * room.width;
  const n = ELEC_NORMS[room.type];
  const e = room.elec;
  const multiAccess = ["couloir", "degagement", "palier", "escalier", "entree"].includes(room.type);
  const cnt = (v: number | undefined) => Math.max(0, Math.round(v ?? 0));

  const prisesBase = e.override ? e.prises : advisedPrises(room.type, area);
  const interBase = e.override ? e.interrupteurs : multiAccess ? 0 : n.interrupteurs;

  const prisesTriples = cnt(e.prisesTriples);
  const prisesDoubles = cnt(e.prisesDoubles);
  const intersDoubles = cnt(e.intersDoubles);
  const prises = Math.max(prisesBase, 2 * prisesDoubles + 3 * prisesTriples);
  const interrupteurs = Math.max(interBase, 2 * intersDoubles);
  const prisesSimples = prises - 2 * prisesDoubles - 3 * prisesTriples;
  const intersSimples = interrupteurs - 2 * intersDoubles;

  // Connecté : un nombre saisi (> 0) est respecté ; sinon l'ancien interrupteur « tout connecté »
  // (hors mode forcé, où seul le nombre compte).
  const pick = (count: number | undefined, flag: boolean, all: number) => {
    const c = cnt(count);
    const v = e.override ? c : c > 0 ? c : flag ? all : 0;
    return Math.min(v, all);
  };
  const prisesConnectees = pick(e.prisesConnectees, e.prisesConnected, prisesSimples);
  const intersConnectes = pick(e.intersConnectes, e.interConnected, intersSimples);
  const intersDoublesConnectes = Math.min(cnt(e.intersDoublesConnectes), intersDoubles);

  const derivationAuto = area >= 20 ? 2 : 1;
  const boitesDerivation = e.boitesDerivation == null ? derivationAuto : cnt(e.boitesDerivation);

  return {
    prises,
    prisesSimples,
    prisesDoubles,
    prisesTriples,
    interrupteurs,
    intersSimples,
    intersDoubles,
    vaEtVient: e.override ? e.vaEtVient : multiAccess ? Math.max(2, n.interrupteurs) : 0,
    poussoirs: e.override ? e.poussoirs : 0,
    dcl: e.override ? e.dcl : n.dcl,
    spots: e.override ? e.spots : 0,
    rj45: e.override ? e.rj45 : n.rj45,
    tv: e.override ? e.tv : n.tv,
    prisesConnectees,
    intersConnectes,
    intersDoublesConnectes,
    spotsConnectes: e.override ? cnt(e.spotsConnectes) : 0,
    dclConnectes: e.override ? cnt(e.dclConnectes) : 0,
    boitesDerivation,
    boitesDerivationAuto: derivationAuto,
    specialised: e.override && e.specialised.length ? e.specialised : n.specialised,
  };
}
