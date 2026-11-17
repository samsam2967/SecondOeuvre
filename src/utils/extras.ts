import { getPriceLabels } from "../data/priceLabels";
import type { PostId, RoomExtra, Settings } from "../types";

/** Poste → clé du bloc de réglages qui contient sa grille de prix. */
export const POST_SETTINGS_KEY = {
  placo: "placo",
  isolation: "isolation",
  electricite: "elec",
  sanitaire: "sanitaire",
  vmc: "vmc",
  chauffage: "chauffage",
  peinture: "peinture",
  carrelage: "carrelage",
  quincaillerie: "quincaillerie",
} as const;

/** Prix gérés dans les catalogues produits (carrelages, peintures) : exclus de la grille de prix. */
const CATALOG_PRICE_KEYS: Partial<Record<PostId, string[]>> = {
  carrelage: ["carreau_m2"],
  peinture: ["peinture_mur_10l", "peinture_plafond_10l", "peinture_sol_10l"],
};

/** Unités proposées pour un matériau personnalisé : texte affiché + description pour « le prix d'… ». */
export const UNIT_PRESETS: { value: string; label: string; desc: string }[] = [
  { value: "u", label: "Quantité (à la pièce)", desc: "l'unité" },
  { value: "m", label: "Mètre (m)", desc: "le mètre" },
  { value: "m²", label: "Mètre carré (m²)", desc: "le m²" },
  { value: "m³", label: "Mètre cube (m³)", desc: "le m³" },
  { value: "kg", label: "Kilogramme (kg)", desc: "le kilo" },
  { value: "L", label: "Litre (L)", desc: "le litre" },
  { value: "sac", label: "Sac", desc: "le sac" },
  { value: "boîte", label: "Boîte / paquet", desc: "la boîte" },
  { value: "rouleau", label: "Rouleau", desc: "le rouleau" },
  { value: "pot", label: "Pot / bidon", desc: "le pot" },
  { value: "barre", label: "Barre / longueur", desc: "la barre" },
  { value: "plaque", label: "Plaque / panneau", desc: "la plaque" },
  { value: "palette", label: "Palette", desc: "la palette" },
  { value: "forfait", label: "Forfait / lot", desc: "le forfait" },
  { value: "h", label: "Heure de main-d'œuvre (h)", desc: "l'heure" },
  { value: "jour", label: "Jour de main-d'œuvre", desc: "le jour" },
];

export const unitDesc = (unit: string) => UNIT_PRESETS.find((u) => u.value === unit)?.desc ?? `par ${unit}`;

export type ExtraGroupId = PostId | "cat:tile" | "cat:paint" | "cat:isolant";

export interface ExtraOption {
  /** Clé stable dans le groupe (clé de prix ou id de produit). */
  ref: string;
  label: string;
  /** Nature de la ligne : prix de la grille, produit de catalogue ou matériau personnalisé. */
  kind: "price" | "tile" | "paint" | "isolant" | "custom";
}

export interface ResolvedExtra {
  post: PostId;
  name: string;
  /** Unité courte de la quantité saisie (u, m, m², pot, panneau…). */
  unit: string;
  unitPrice: number;
  /** Description exacte de l'unité du prix (ex. « l'unité, sans plaque »). */
  spec: string;
  /** Clé du prix pour retrouver le lien d'achat saisi dans Matériaux. */
  linkKey?: string;
  productId?: string;
  photo?: string;
}

function priceMap(S: Settings, post: PostId): Record<string, number> {
  const block = S[POST_SETTINGS_KEY[post]] as { prices?: Record<string, number> };
  return block.prices ?? {};
}

/** Unité courte déduite de la description du libellé : « le mètre » → m, « l'unité » → u… */
function shortUnit(desc: string): string {
  const m = desc.trim().match(/^(?:l['’]|le |la |les |un |une )?([^\s,(]+)/i);
  const w = (m?.[1] ?? "").toLowerCase();
  if (!w || w.startsWith("unit")) return "u";
  if (w.startsWith("mètre") || w === "ml" || w === "m") return "m";
  if (w === "m²") return "m²";
  return w;
}

/** Groupes proposés dans le sélecteur « Ajouter un matériau » : les 9 postes + les 3 catalogues produits. */
export function extraGroups(postLabels: { id: PostId; label: string }[]): { id: ExtraGroupId; label: string }[] {
  return [
    ...postLabels.map((p) => ({ id: p.id as ExtraGroupId, label: p.label })),
    { id: "cat:tile" as const, label: "Carrelages (catalogue)" },
    { id: "cat:paint" as const, label: "Peintures (catalogue)" },
    { id: "cat:isolant" as const, label: "Isolants (catalogue)" },
  ];
}

/** Tous les matériaux de la page Matériaux pour un groupe. */
export function extraOptions(S: Settings, group: ExtraGroupId): ExtraOption[] {
  if (group === "cat:tile") return (S.carrelage.tiles ?? []).map((t) => ({ ref: t.id, label: t.name, kind: "tile" as const }));
  if (group === "cat:paint") return (S.peinture.paints ?? []).map((p) => ({ ref: p.id, label: p.name, kind: "paint" as const }));
  if (group === "cat:isolant") return S.isolants.map((i) => ({ ref: i.id, label: `${i.name} ${i.thickness} mm`, kind: "isolant" as const }));
  const hidden = CATALOG_PRICE_KEYS[group] ?? [];
  const fromGrid = Object.entries(getPriceLabels(S)[group] ?? {})
    .filter(([k]) => !hidden.includes(k))
    .map(([ref, label]) => ({ ref, label, kind: "price" as const }));
  const mine = (S.customMaterials ?? [])
    .filter((c) => c.post === group)
    .map((c) => ({ ref: c.id, label: `★ ${c.name} (${c.unit})`, kind: "custom" as const }));
  return [...mine, ...fromGrid];
}

/** Retrouve nom, unité et prix actuels d'un matériau ajouté (suit les modifications faites dans Matériaux). */
export function resolveExtra(S: Settings, x: Pick<RoomExtra, "kind" | "post" | "ref">): ResolvedExtra | null {
  if (x.kind === "tile") {
    const t = (S.carrelage.tiles ?? []).find((p) => p.id === x.ref);
    if (!t) return null;
    return {
      post: "carrelage",
      name: t.name,
      unit: "m²",
      unitPrice: t.priceM2,
      spec: "le m²",
      productId: t.id,
      photo: t.photo,
    };
  }
  if (x.kind === "paint") {
    const p = (S.peinture.paints ?? []).find((q) => q.id === x.ref);
    if (!p) return null;
    return {
      post: "peinture",
      name: p.name,
      unit: "pot",
      unitPrice: p.pricePot,
      spec: `le pot de ${p.potL} L`,
      productId: p.id,
      photo: p.photo,
    };
  }
  if (x.kind === "isolant") {
    const i = S.isolants.find((q) => q.id === x.ref);
    if (!i) return null;
    return {
      post: "isolation",
      name: `${i.name} ${i.thickness} mm`,
      unit: "panneau",
      unitPrice: i.priceM2 * i.panelL * i.panelW,
      spec: `le panneau ${i.panelL} × ${i.panelW} m (${i.priceM2} €/m²)`,
      productId: i.id,
    };
  }
  if (x.kind === "custom") {
    const c = (S.customMaterials ?? []).find((m) => m.id === x.ref);
    if (!c) return null;
    return {
      post: c.post,
      name: c.name,
      unit: c.unit,
      unitPrice: c.price,
      spec: unitDesc(c.unit),
      productId: c.id,
    };
  }
  const label = getPriceLabels(S)[x.post]?.[x.ref];
  if (!label) return null;
  const cut = label.indexOf(" — ");
  const name = cut >= 0 ? label.slice(0, cut) : label;
  const spec = cut >= 0 ? label.slice(cut + 3) : "l'unité";
  return {
    post: x.post,
    name,
    unit: shortUnit(spec),
    unitPrice: priceMap(S, x.post)[x.ref] ?? 0,
    spec,
    linkKey: x.ref,
  };
}
