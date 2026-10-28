import { ROOM_COLORS, ROOM_TYPES } from "../data/catalogs";
import type { Floor, Opening, PlaqueType, Pt, Room, RoomType, SolType } from "../types";
import { rectPoints, syncFromPoints } from "./geometry";
import { uid } from "./id";

export function emptyElec() {
  return {
    override: false,
    prises: 0,
    interrupteurs: 0,
    vaEtVient: 0,
    poussoirs: 0,
    dcl: 0,
    spots: 0,
    rj45: 0,
    tv: 0,
    specialised: [] as string[],
    connected: false,
    prisesConnected: false,
    interConnected: false,
    prisesConnectees: 0,
    intersConnectes: 0,
    spotsConnectes: 0,
    dclConnectes: 0,
  };
}

export function makeRoom(floorId: string, name = "Nouvelle pièce", type: RoomType = "autre", extras: Partial<Room> = {}): Room {
  const meta = ROOM_TYPES.find((t) => t.id === type);
  const color = ROOM_COLORS[Math.floor(Math.random() * ROOM_COLORS.length)];
  const room: Room = {
    id: uid(),
    floorId,
    name,
    type,
    length: 4,
    width: 3,
    height: 2.5,
    exteriorWallLength: 7,
    openings: [],
    placoWalls: true,
    placoCeiling: true,
    placoType: (meta?.hydro ? "hydro" : "ba13") as PlaqueType,
    paintWalls: true,
    paintCeiling: true,
    paintFloor: false,
    tileFloor: meta?.defaultTile ?? false,
    tileWalls: type === "sdb" || type === "sde",
    tileWallHeight: type === "sdb" || type === "sde" ? 2.1 : 1.2,
    floorHeating: meta?.defaultHeating ?? true,
    solType: (meta?.defaultTile ? "carrelage" : "parquet") as SolType,
    notes: "",
    x: 40 + Math.random() * 80,
    y: 40 + Math.random() * 80,
    color,
    elec: emptyElec(),
    points: [],
    areaM2: 0,
    perimeterM: 0,
    exteriorEdges: [],
    wallTypes: {},
    prixCarrelageM2: 0,
    prixFaienceM2: 0,
    carreauL: 0,
    carreauW: 0,
    faienceL: 0,
    faienceW: 0,
    prixPeintureMurPot: 0,
    prixPeinturePlafondPot: 0,
    tileSolId: undefined,
    tileMurId: undefined,
    paintWallId: undefined,
    paintCeilId: undefined,
    ...extras,
  } as Room;
  const scale = 40;
  const pts: Pt[] =
    room.points.length >= 3 ? room.points : rectPoints(room.x, room.y, room.length * scale, room.width * scale);
  return syncFromPoints({ ...room, points: pts }, pts, scale);
}

export function makeOpening(): Opening {
  return { id: uid(), type: "fenetre", width: 1.2, height: 1.15, wall: "exterieur" };
}

export function makeFloor(name: string, level: number, height = 2.5): Floor {
  return {
    id: uid(),
    name,
    level,
    height,
    planImage: "",
    planScale: 40,
    planWidth: 1000,
    planHeight: 700,
    rooms: [],
    partitions: [],
  };
}

const TYPE_ALIASES: Record<string, RoomType> = {
  salon: "salon",
  sejour: "sejour",
  séjour: "sejour",
  "salle a manger": "salle_manger",
  "salle à manger": "salle_manger",
  sam: "salle_manger",
  cuisine: "cuisine",
  chambre: "chambre",
  ch: "chambre",
  bureau: "bureau",
  sdb: "sdb",
  "salle de bain": "sdb",
  "salle de bains": "sdb",
  "salle d'eau": "sde",
  sde: "sde",
  wc: "wc",
  toilette: "wc",
  toilettes: "wc",
  buanderie: "buanderie",
  cellier: "cellier",
  dressing: "dressing",
  entree: "entree",
  entrée: "entree",
  couloir: "couloir",
  degagement: "degagement",
  dégagement: "degagement",
  palier: "palier",
  escalier: "escalier",
  garage: "garage",
  combles: "combles",
};

const TYPE_COLOR: Partial<Record<RoomType, string>> = {
  salon: "#6e9c81",
  sejour: "#7fa98d",
  salle_manger: "#d09762",
  cuisine: "#c2a756",
  chambre: "#8493b6",
  bureau: "#659ca0",
  sdb: "#7d9bc0",
  sde: "#659ca0",
  wc: "#8fb0b3",
  buanderie: "#858b72",
  cellier: "#8a8577",
  dressing: "#9b85b8",
  entree: "#b0a58c",
  couloir: "#b3ac9c",
  degagement: "#b3ac9c",
  palier: "#a49a86",
};

export function labelDetectedRooms(
  rooms: { area: number; length: number; width: number }[],
): { name: string; type: RoomType; color: string }[] {
  const total = rooms.reduce((s, r) => s + r.area, 0) || 1;
  const idx = rooms.map((_, i) => i).sort((a, b) => rooms[b].area - rooms[a].area);
  const out: { name: string; type: RoomType; color: string }[] = rooms.map(() => ({
    name: "Pièce",
    type: "autre" as RoomType,
    color: "#6e9c81",
  }));
  const used = new Set<RoomType>();
  let nCh = 0;
  idx.forEach((i, rank) => {
    const room = rooms[i];
    const share = room.area / total;
    const ar = Math.max(room.length, room.width) / Math.max(0.1, Math.min(room.length, room.width));
    let type: RoomType = "autre";
    let name = `Pièce ${rank + 1}`;
    if (ar >= 2.7 && share < 0.18) {
      type = used.has("couloir") ? "degagement" : "couloir";
      name = type === "couloir" ? "Couloir" : "Dégagement";
    } else if (rank === 0 && share >= 0.14) {
      type = "salon";
      name = "Salon";
    } else if (share < 0.045 && ar < 1.8) {
      type = "wc";
      name = used.has("wc") ? "WC 2" : "WC";
    } else if (share < 0.09 && ar < 2.1) {
      type = used.has("sdb") ? "sde" : "sdb";
      name = type === "sdb" ? "Salle de bain" : "Salle d'eau";
    } else if (!used.has("cuisine") && share >= 0.07 && share <= 0.22 && rank <= 3) {
      type = "cuisine";
      name = "Cuisine";
    } else if (!used.has("entree") && share < 0.1 && rank >= 2) {
      type = "entree";
      name = "Entrée";
    } else {
      nCh++;
      type = "chambre";
      name = `Chambre ${nCh}`;
    }
    used.add(type);
    out[i] = { name, type, color: TYPE_COLOR[type] ?? "#6e9c81" };
  });
  return out;
}

export function guessType(name: string): RoomType {
  const strip = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const n = strip(name).trim();
  for (const [k, v] of Object.entries(TYPE_ALIASES)) {
    const kk = strip(k);
    if (n.includes(kk)) return v;
  }
  return "autre";
}

/** Parse "Salon 5.2x4.1, Cuisine 3.5 x 3, SDB 2.4*1.8 h=2.5" */
export function parseRoomText(text: string, floorId: string, defaultHeight: number): Room[] {
  const chunks = text
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const rooms: Room[] = [];
  let i = 0;
  for (const c of chunks) {
    const m = c.match(/^(.*?)[\s:_-]+(\d+[.,]?\d*)\s*[x×*]\s*(\d+[.,]?\d*)(?:\s*[x×*]\s*(\d+[.,]?\d*))?/i);
    if (!m) continue;
    const name = m[1].trim() || `Pièce ${i + 1}`;
    const length = parseFloat(m[2].replace(",", "."));
    const width = parseFloat(m[3].replace(",", "."));
    const height = m[4] ? parseFloat(m[4].replace(",", ".")) : defaultHeight;
    const type = guessType(name);
    const room = makeRoom(floorId, name, type, {
      length,
      width,
      height,
      exteriorWallLength: Math.round((length + width) * 10) / 10,
      x: 40 + (i % 4) * 140,
      y: 40 + Math.floor(i / 4) * 120,
    });
    rooms.push(room);
    i++;
  }
  return rooms;
}
