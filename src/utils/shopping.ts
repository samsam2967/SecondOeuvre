import type { LineItem, Project } from "../types";
import { lineKey } from "./calc";

/** Quantité déjà achetée d'une ligne. */
export const boughtQty = (project: Project, i: LineItem) => project.settings.shoppingBought?.[lineKey(i)] ?? 0;

/** Quantité restant à acheter. */
export const remainQty = (project: Project, i: LineItem) => Math.max(0, Math.round((i.quantity - boughtQty(project, i)) * 100) / 100);

/** Quantité à acheter maintenant : celle saisie, sans dépasser le reste (par défaut, tout le reste). */
export const nowQty = (project: Project, i: LineItem) => Math.min(remainQty(project, i), project.settings.shoppingNow?.[lineKey(i)] ?? remainQty(project, i));
