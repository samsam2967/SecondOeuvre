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

export function defaultElec(room: Room) {
  const area = room.length * room.width;
  const n = ELEC_NORMS[room.type];
  const e = room.elec;
  if (room.elec.override) {
    return {
      prises: e.prises,
      interrupteurs: e.interrupteurs,
      vaEtVient: e.vaEtVient,
      poussoirs: e.poussoirs,
      dcl: e.dcl,
      spots: e.spots,
      rj45: e.rj45,
      tv: e.tv,
      prisesConnectees: e.prisesConnectees ?? 0,
      intersConnectes: e.intersConnectes ?? 0,
      spotsConnectes: e.spotsConnectes ?? 0,
      dclConnectes: e.dclConnectes ?? 0,
      specialised: room.elec.specialised.length ? room.elec.specialised : n.specialised,
    };
  }
  const multiAccess = ["couloir", "degagement", "palier", "escalier", "entree"].includes(room.type);
  const prises = advisedPrises(room.type, area);
  const interrupteurs = multiAccess ? 0 : n.interrupteurs;
  return {
    prises,
    interrupteurs,
    vaEtVient: multiAccess ? Math.max(2, n.interrupteurs) : 0,
    poussoirs: 0,
    dcl: n.dcl,
    spots: 0,
    rj45: n.rj45,
    tv: n.tv,
    // Par défaut, tout l'appareillage connecté est suivi (réglable pièce par pièce).
    prisesConnectees: room.elec.prisesConnected ? prises : 0,
    intersConnectes: room.elec.interConnected ? interrupteurs : 0,
    spotsConnectes: 0,
    dclConnectes: 0,
    specialised: n.specialised,
  };
}
