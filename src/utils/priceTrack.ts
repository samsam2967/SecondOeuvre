import type { PostId, Settings } from "../types";

/** Réglage → poste : sert à repérer quelle ligne de la grille des prix a servi à chiffrer une ligne. */
const BLOCKS: Record<string, PostId> = {
  placo: "placo",
  isolation: "isolation",
  elec: "electricite",
  sanitaire: "sanitaire",
  vmc: "vmc",
  chauffage: "chauffage",
  peinture: "peinture",
  carrelage: "carrelage",
  quincaillerie: "quincaillerie",
};

/** Mémorise les lignes de la grille des prix lues depuis la dernière remise à zéro. */
export interface PriceSink {
  reads: Map<string, { post: PostId; key: string; value: number }>;
}

export const newSink = (): PriceSink => ({ reads: new Map() });

/**
 * Enveloppe les réglages pour savoir quel prix de la page Matériaux a été lu pendant un calcul.
 * Ne change aucune valeur : lecture seule.
 */
export function trackPrices(S: Settings, sink: PriceSink): Settings {
  return new Proxy(S, {
    get(t, k, r) {
      const v = Reflect.get(t, k, r);
      const post = typeof k === "string" ? BLOCKS[k] : undefined;
      if (!post || !v || typeof v !== "object") return v;
      return new Proxy(v as object, {
        get(bt, bk, br) {
          const bv = Reflect.get(bt, bk, br);
          if (bk === "prices" && bv && typeof bv === "object") {
            return new Proxy(bv as object, {
              get(pt, pk, pr) {
                const val = Reflect.get(pt, pk, pr);
                if (typeof pk === "string" && pk !== "then") sink.reads.set(`${post}:${pk}`, { post, key: pk, value: Number(val) });
                return val;
              },
            });
          }
          return bv;
        },
      });
    },
  }) as Settings;
}

/**
 * Clé de prix de la ligne qu'on vient de chiffrer. Priorité :
 *  1. le seul prix lu qui vaut exactement le prix unitaire de la ligne ;
 *  2. sinon, s'il n'y a eu qu'UN prix lu (prix dérivé : boîte ÷ 1 000, barre × 2,2 m…) ;
 *  3. sinon rien (prix composé de plusieurs lignes : pas de correspondance unique dans Matériaux).
 * Remet le suivi à zéro.
 */
export function takeRef(sink: PriceSink, post: PostId, unitPrice: number): string | undefined {
  const own = [...sink.reads.values()].filter((r) => r.post === post);
  sink.reads.clear();
  const exact = own.filter((r) => Math.abs(r.value - unitPrice) < 1e-9);
  if (exact.length === 1) return exact[0].key;
  if (exact.length > 1) return undefined;
  return own.length === 1 ? own[0].key : undefined;
}
