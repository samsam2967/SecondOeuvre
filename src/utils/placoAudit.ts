import type { Project } from "../types";
import { sharedWalls, wallInsulated } from "./adjacency";
import { ISOLANTS } from "../data/catalogs";
import { partitionArea, roomEdges, roomSurfaces } from "./surfaces";
import { roomLayerAreas } from "./wallLayers";

export interface PlacoAuditRoom {
  id: string;
  name: string;
  floor: string;
  walls: number;
  ceiling: number;
  outer: number;
  /** Isolant des murs extérieurs (m²), angles inclus. */
  iso: number;
  wallsOff: boolean;
  ceilingOff: boolean;
  passageM: number;
}
export interface PlacoAuditWall {
  key: string;
  a: string;
  b: string;
  lengthM: number;
  heightM: number;
  facesA: boolean;
  facesB: boolean;
  passage: boolean;
  insulated: boolean;
}
export interface PlacoAuditPartition {
  id: string;
  name: string;
  m2: number;
  coveredByRooms: boolean;
}

/** Ce qui est compté en plaques de plâtre : pièces (murs, plafond, face extérieure), cloisons entre pièces, cloisons saisies à la main. */
export function placoAudit(project: Project) {
  const rooms: PlacoAuditRoom[] = [];
  const walls: PlacoAuditWall[] = [];
  const parts: PlacoAuditPartition[] = [];
  const touching = new Set<string>();
  for (const f of project.floors) {
    const sc = f.planScale || 40;
    for (const r of f.rooms) {
      const rs = roomSurfaces(r);
      const edges = roomEdges(r, sc);
      const isoList = project.settings.isolants?.length ? project.settings.isolants : ISOLANTS;
      const iso = isoList.find((i) => i.id === project.settings.isolation.isolantMurId) ?? isoList[0];
      const layers = roomLayerAreas(r, sc, (iso?.thickness ?? 100) / 1000);
      const outer = layers.outerM2;
      rooms.push({
        id: r.id,
        name: r.name,
        floor: f.name,
        // même formule que le chiffrage : parois avec placo, ouvertures déduites (cloison = 2 faces)
        walls: (() => {
          const gross = edges.filter((e) => !e.passage).reduce((a, e) => a + e.lengthM * r.height, 0);
          const open = r.openings.reduce((a, o) => a + o.width * o.height * (o.wall === "cloison" ? 2 : 1), 0);
          return Math.max(0, gross - open);
        })(),
        ceiling: r.placoCeiling ? rs.ceiling : 0,
        outer: r.placoWalls ? outer : 0,
        iso: layers.isoM2,
        wallsOff: !r.placoWalls,
        ceilingOff: !r.placoCeiling,
        passageM: edges.filter((e) => e.passage).reduce((a, e) => a + e.lengthM, 0),
      });
    }
    for (const w of sharedWalls(f)) {
      const A = f.rooms.find((r) => r.id === w.roomAId);
      const B = f.rooms.find((r) => r.id === w.roomBId);
      if (!A || !B) continue;
      touching.add([A.id, B.id].sort().join("|"));
      const eA = roomEdges(A, sc)[w.edgeA];
      const eB = roomEdges(B, sc)[w.edgeB];
      walls.push({
        key: `${A.id}${w.edgeA}${B.id}${w.edgeB}`,
        a: A.name,
        b: B.name,
        lengthM: w.lengthM,
        heightM: Math.min(A.height || 2.5, B.height || 2.5),
        facesA: A.placoWalls && !eA?.passage,
        facesB: B.placoWalls && !eB?.passage,
        passage: w.passage,
        insulated: wallInsulated(f, w),
      });
    }
    for (const p of f.partitions) {
      parts.push({
        id: p.id,
        name: p.name,
        m2: partitionArea(p) * 2,
        coveredByRooms: !!p.roomAId && !!p.roomBId && touching.has([p.roomAId, p.roomBId].sort().join("|")),
      });
    }
  }
  // les cloisons saisies sont rattachées après coup : on revérifie la couverture avec tous les étages
  for (const f of project.floors) for (const p of f.partitions) {
    const item = parts.find((x) => x.id === p.id);
    if (item) item.coveredByRooms = !!p.roomAId && !!p.roomBId && touching.has([p.roomAId, p.roomBId].sort().join("|"));
  }
  const total = rooms.reduce((a, r) => a + r.walls + r.ceiling + r.outer, 0) + parts.filter((p) => !p.coveredByRooms).reduce((a, p) => a + p.m2, 0);
  return { rooms, walls, parts, total };
}
