import { useMemo, useState } from "react";
import { useStore } from "../store";
import type { PostId } from "../types";
import { roomMaterials } from "../utils/calc";
import { fmtD } from "../utils/format";

/** Quantitatif détaillé d'un poste, pièce par pièce, dans un menu déroulant. */
export function PostRoomQuantities({ post }: { post: PostId }) {
  const { project } = useStore();
  const [open, setOpen] = useState<string>("");
  const rows = useMemo(
    () =>
      project.floors.flatMap((f) =>
        f.rooms.map((r) => {
          const lines = roomMaterials(project, r.id).filter((l) => l.post === post);
          const total = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
          return { f, r, lines, total };
        }),
      ),
    [project, post],
  );
  const withLines = rows.filter((x) => x.lines.length);
  const grand = withLines.reduce((s, x) => s + x.total, 0);
  return (
    <div className="mt-4 rounded-xl border border-rule bg-white/70 p-4">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold">Quantitatif détaillé par pièce</h2>
        <span className="font-mono text-xs text-stone-500">{fmtD(grand, 0)} € répartis sur {withLines.length} pièce{withLines.length > 1 ? "s" : ""}</span>
      </div>
      <p className="mb-3 text-xs text-stone-500">
        Déroule une pièce pour voir ce qui est compté pour elle dans ce poste. Les éléments communs du chantier (caisson VMC, tableau, pompe à chaleur…) ne sont pas ventilés par pièce : ils figurent dans le quantitatif global ci-dessus.
      </p>
      {withLines.length === 0 && <p className="text-xs text-stone-400">Aucune pièce n'a de matériau dans ce poste pour l'instant.</p>}
      <div className="space-y-1.5">
        {withLines.map(({ f, r, lines, total }) => {
          const isOpen = open === r.id;
          return (
            <div key={r.id} className={`rounded-lg border ${isOpen ? "border-terra/40 bg-white" : "border-rule bg-white/60"}`}>
              <button className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-semibold hover:bg-black/5" onClick={() => setOpen(isOpen ? "" : r.id)}>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: r.color }} />
                  <span className="truncate">{r.name}</span>
                  {project.floors.length > 1 && <span className="shrink-0 text-xs font-normal text-stone-400">{f.name}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-3 font-mono text-xs">
                  <span className="text-stone-500">{lines.length} ligne{lines.length > 1 ? "s" : ""}</span>
                  <span>{fmtD(total, 0)} €</span>
                  <span className="text-stone-400">{isOpen ? "▲" : "▼"}</span>
                </span>
              </button>
              {isOpen && (
                <div className="overflow-x-auto border-t border-rule px-3 py-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wide text-stone-400">
                        <th className="py-1 pr-2">Matériau</th>
                        <th className="py-1 pr-2 text-right">Quantité</th>
                        <th className="py-1 pr-2 text-right">Prix unitaire</th>
                        <th className="py-1 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l, i) => (
                        <tr key={i} className="border-t border-rule/60 align-top">
                          <td className="py-1 pr-2">
                            {l.name}
                            {l.note && <div className="text-[10px] text-stone-400">{l.note}</div>}
                          </td>
                          <td className="whitespace-nowrap py-1 pr-2 text-right font-mono">{l.qty.toLocaleString("fr-FR")} {l.unit}</td>
                          <td className="whitespace-nowrap py-1 pr-2 text-right font-mono">{fmtD(l.unitPrice, 2)} €</td>
                          <td className="whitespace-nowrap py-1 text-right font-mono font-semibold">{fmtD(l.qty * l.unitPrice, 2)} €</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
