import type { Floor, HeatCollector, Room } from "../types";
import { centroid, pointsForRoom } from "./geometry";

const TECH = new Set(["cellier", "buanderie", "garage", "couloir", "degagement", "palier", "entree"]);

/** Collecteurs de l'étage : ceux posés à la main, sinon un emplacement automatique dans un local technique ou un dégagement. */
export function floorCollectors(floor: Floor): (HeatCollector & { auto?: boolean })[] {
  if (floor.collectors?.length) return floor.collectors;
  const heated = floor.rooms.filter((r) => r.floorHeating);
  if (!heated.length) return [];
  const sc = floor.planScale || 40;
  const host: Room = floor.rooms.find((r) => TECH.has(r.type) && r.floorHeating) ?? floor.rooms.find((r) => TECH.has(r.type)) ?? heated[0];
  const c = centroid(pointsForRoom(host, sc));
  return [{ id: `auto:${floor.id}`, x: c.x, y: c.y, auto: true }];
}

/** Coin haut-gauche d'une pièce, en pixels : origine des zones non chauffées. */
export function roomOrigin(room: Room, scale: number) {
  const pts = pointsForRoom(room, scale);
  return { x: Math.min(...pts.map((p) => p.x)), y: Math.min(...pts.map((p) => p.y)) };
}
