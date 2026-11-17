import type { MatTarget, PostId, Project } from "../types";
import { type CalcResult, roomMaterials } from "./calc";

/** Nom normalisé : minuscules, sans accents ni parenthèses, sans suffixe « — … ». */
export function normName(n: string): string {
  return n
    .split(" — ")[0]
    .replace(/\([^)]*\)/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ø]+/g, " ")
    .trim();
}

export interface ReconRow {
  post: PostId;
  name: string;
  category: string;
  spec: string;
  unit: string;
  qty: number;
  /** Coût de la ligne dans le chiffrage global (€). */
  total: number;
  /** Part déjà comptée dans le détail des pièces (€). */
  inRooms: number;
  /** total − inRooms : éléments communs, ou écart d'arrondi (€). */
  rest: number;
  /** Pièces qui contribuent à cette ligne. */
  rooms: string[];
  kind: "commun" | "arrondi" | "pieces" | "orphelin";
  /** Où retrouver ce matériau dans la page Matériaux. */
  mat?: MatTarget;
}

export interface Duplicate {
  title: string;
  detail: string;
  amount: number;
}

export interface Reconciliation {
  rows: ReconRow[];
  totalGlobal: number;
  totalRooms: number;
  duplicates: Duplicate[];
}

/** Paires de lignes qui couvrent probablement le même besoin dans deux postes différents. */
const KNOWN_OVERLAPS: { a: [PostId, string]; b: [PostId, string]; title: string; detail: string }[] = [
  {
    a: ["sanitaire", "Kit étanchéité receveur"],
    b: ["carrelage", "Kit SPEC / SEL pièces humides"],
    title: "Étanchéité de la douche comptée deux fois ?",
    detail:
      "Le sanitaire compte un « Kit étanchéité receveur » (SPEC + manchons) et le carrelage un « Kit SPEC / SEL pièces humides » : ce sont deux kits d'étanchéité pour la même douche. Un seul suffit en général — si c'est le cas, mettez le prix de l'un des deux à 0 € dans l'onglet Matériaux, ou décochez la SPEC dans l'onglet Carrelage.",
  },
];

export function reconcile(project: Project, calc: CalcResult): Reconciliation {
  const items = Object.values(calc.byPost).flat();

  // Lignes globales regroupées par poste + nom normalisé.
  const groups = new Map<string, ReconRow & { key: string; norm: string; cats: Set<string> }>();
  for (const i of items) {
    const base = i.name.split(" — ajustement")[0];
    const norm = normName(base);
    const key = `${i.post}|${norm}`;
    const g = groups.get(key);
    const cost = i.quantity * i.unitPrice;
    const matOf = (): MatTarget | undefined =>
      i.productId
        ? {
            post: i.post === "isolation" && project.settings.isolants?.some((x) => x.id === i.productId) ? "isolants" : i.post,
            productId: i.productId,
          }
        : i.linkKey
          ? { post: i.post, key: i.linkKey }
          : undefined;
    if (g) {
      g.total += cost;
      g.qty += i.quantity;
      g.cats.add(i.category);
      if (!g.mat) g.mat = matOf();
    } else {
      groups.set(key, {
        key,
        norm,
        post: i.post,
        name: base.split(" — ")[0],
        category: i.category,
        spec: i.spec,
        unit: i.unit,
        qty: i.quantity,
        total: cost,
        inRooms: 0,
        rest: 0,
        rooms: [],
        kind: "commun",
        mat: matOf(),
        cats: new Set([i.category]),
      });
    }
  }
  const byPost = new Map<PostId, (ReconRow & { key: string; norm: string })[]>();
  for (const g of groups.values()) byPost.set(g.post, [...(byPost.get(g.post) ?? []), g]);

  const find = (post: PostId, ref: string) => {
    const r = normName(ref);
    const list = byPost.get(post) ?? [];
    const exact = list.find((g) => g.norm === r);
    if (exact) return exact;
    let best: (typeof list)[number] | undefined;
    for (const g of list) {
      if ((g.norm.startsWith(r) || r.startsWith(g.norm)) && g.norm.length > 3 && r.length > 3) {
        if (!best || Math.abs(g.norm.length - r.length) < Math.abs(best.norm.length - r.length)) best = g;
      }
    }
    return best;
  };

  const orphans = new Map<string, ReconRow>();
  let totalRooms = 0;
  for (const f of project.floors) {
    for (const room of f.rooms) {
      for (const l of roomMaterials(project, room.id)) {
        const cost = l.qty * l.unitPrice;
        totalRooms += cost;
        const g = find(l.post, l.ref ?? l.name);
        if (g) {
          if (!g.mat && l.mat) g.mat = l.mat;
          g.inRooms += cost;
          if (!g.rooms.includes(room.name)) g.rooms.push(room.name);
        } else {
          const k = `${l.post}|${normName(l.name)}`;
          const o = orphans.get(k) ?? {
            post: l.post,
            name: l.name,
            category: "—",
            spec: "Compté dans la pièce mais absent du chiffrage global",
            unit: l.unit,
            qty: 0,
            total: 0,
            inRooms: 0,
            rest: 0,
            rooms: [],
            kind: "orphelin" as const,
            mat: l.mat,
          };
          o.inRooms += cost;
          o.qty += l.qty;
          if (!o.rooms.includes(room.name)) o.rooms.push(room.name);
          orphans.set(k, o);
        }
      }
    }
  }

  const rows: ReconRow[] = [...groups.values()].map((g) => {
    const rest = g.total - g.inRooms;
    let kind: ReconRow["kind"];
    if (g.inRooms < 0.005) kind = "commun";
    else if (Math.abs(rest) < 0.5) kind = "pieces";
    else kind = "arrondi";
    return { ...g, rest, kind };
  });
  for (const o of orphans.values()) rows.push({ ...o, rest: o.total - o.inRooms });

  const totalGlobal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  const duplicates: Duplicate[] = [];
  const costOf = (post: PostId, name: string) =>
    rows.filter((r) => r.post === post && normName(r.name) === normName(name)).reduce((s, r) => s + r.total, 0);
  for (const o of KNOWN_OVERLAPS) {
    const ca = costOf(...o.a);
    const cb = costOf(...o.b);
    if (ca > 0 && cb > 0) duplicates.push({ title: o.title, detail: o.detail, amount: Math.min(ca, cb) });
  }
  // Matériaux ajoutés à la main qui existent déjà dans le calcul automatique (même prix source).
  const autoByLink = new Map<string, (typeof items)[number]>();
  for (const i of items) if (i.linkKey && i.category !== "Ajouts par pièce" && i.category !== "Ajustements par pièce") autoByLink.set(`${i.post}:${i.linkKey}`, i);
  for (const i of items) {
    if (i.category !== "Ajouts par pièce" || !i.linkKey) continue;
    const auto = autoByLink.get(`${i.post}:${i.linkKey}`);
    if (auto)
      duplicates.push({
        title: `« ${i.name} » ajouté à la main alors qu'il est déjà compté automatiquement`,
        detail: `Déjà prévu par le calcul automatique (${auto.category} › ${auto.name}, ${auto.quantity} ${auto.unit}). Ce que vous avez ajouté (${i.quantity} ${i.unit}, ${i.notes}) s'ajoute en plus : retirez l'ajout si c'est le même matériel.`,
        amount: i.quantity * i.unitPrice,
      });
  }

  return { rows, totalGlobal, totalRooms, duplicates };
}
