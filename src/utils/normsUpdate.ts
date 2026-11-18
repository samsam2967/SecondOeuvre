import { mergeNorms, NORMS, NORMS_STORAGE_KEY, setNormsMeta, type NormItem, type NormsMeta } from "../data/norms";

/** Liste officielle des normes, maintenue dans le dépôt du site (même fichier que celui publié avec le site). */
const SOURCES = [
  "https://raw.githubusercontent.com/samsam2967/SecondOeuvre/main/public/normes-a-jour.json",
  `${typeof location !== "undefined" ? location.origin : ""}/normes-a-jour.json`,
];

export interface NormsUpdateResult {
  ok: boolean;
  message: string;
  meta?: NormsMeta;
}

/** Un seul clic : télécharge la liste la plus récente, fusionne (ajoute / remplace) et mémorise sur cet appareil. */
export async function updateNorms(): Promise<NormsUpdateResult> {
  let lastErr = "";
  for (const url of SOURCES) {
    try {
      const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) {
        lastErr = `${res.status}`;
        continue;
      }
      const data = (await res.json()) as { version: string; date: string; norms: NormItem[] };
      if (!Array.isArray(data.norms) || !data.norms.every((n) => n && n.id && n.title && n.body && n.post)) {
        lastErr = "fichier invalide";
        continue;
      }
      const { added, changed } = mergeNorms(data.norms);
      const meta: NormsMeta = { version: data.version, date: data.date, checkedAt: new Date().toISOString(), source: url.includes("githubusercontent") ? "GitHub (dépôt du site)" : "fichier publié avec le site", added, changed };
      try {
        localStorage.setItem(NORMS_STORAGE_KEY, JSON.stringify({ meta, items: NORMS }));
      } catch {
        /* stockage plein : la mise à jour reste valable pour cette session */
      }
      setNormsMeta(meta);
      return { ok: true, meta, message: added.length || changed.length ? `${added.length} règle(s) ajoutée(s), ${changed.length} modifiée(s).` : "Tes normes sont déjà à jour." };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  return { ok: false, message: `Impossible de joindre la liste des normes (${lastErr}). Vérifie ta connexion puis réessaie.` };
}
