import { useMemo } from "react";
import { useStore } from "../store";
import { fmtD } from "../utils/format";
import { placoAudit } from "../utils/placoAudit";

const m2 = (n: number) => `${fmtD(n, 1)} m²`;

/** Contrôle du placo : pièces, cloisons entre pièces, cloisons saisies à la main, avec ce qui n'est PAS compté. */
export function PlacoAuditCard() {
  const { project, calc } = useStore();
  const a = useMemo(() => placoAudit(project), [project]);
  const plaques = calc.items.filter((i) => i.post === "placo" && i.category === "Plaques").reduce((s, i) => s + i.quantity, 0);
  const warnings = [
    ...a.rooms.filter((r) => r.wallsOff).map((r) => `${r.name} : murs sans placo (non comptés).`),
    ...a.rooms.filter((r) => r.ceilingOff && !r.wallsOff).map((r) => `${r.name} : plafond sans placo (non compté).`),
    ...a.walls.filter((w) => !w.passage && (!w.facesA || !w.facesB)).map((w) => `Cloison ${w.a} ⟷ ${w.b} : face ${!w.facesA ? w.a : w.b} non comptée (placo décoché ou paroi sans placo).`),
    ...a.parts.filter((p) => p.coveredByRooms).map((p) => `Cloison « ${p.name} » saisie à la main : ses plaques sont déjà comptées par les pièces (pas de double compte).`),
  ];
  return (
    <details className="group rounded-2xl border border-rule bg-white/70">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-5 py-3">
        <span className="font-display text-lg font-bold">Contrôle du placo</span>
        <span className="flex items-center gap-3 font-mono text-xs text-stone-500">
          {m2(a.total)} à couvrir · {plaques} plaques
          <span className="transition-transform group-open:rotate-180">▼</span>
        </span>
      </summary>
      <div className="space-y-4 border-t border-rule px-5 py-4 text-xs">
        <p className="text-stone-500">
          Les plaques des deux faces d'une cloison entre deux pièces sont comptées dans chaque pièce (une face par pièce). L'ossature et l'isolant de la cloison sont comptés une seule fois. Les murs extérieurs sont comptés couche par couche avec les angles : l'isolant à mi-épaisseur, le pare-vapeur côté chaud, la plaque extérieure des murs sans brique à son niveau. Le total ci-dessous est avant pertes : les plaques à acheter en tiennent compte.
        </p>

        <div>
          <div className="mb-1 font-semibold uppercase tracking-wide text-stone-500">Par pièce</div>
          <table className="w-full">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-stone-400">
                <th className="py-1">Pièce</th>
                <th className="text-right">Murs</th>
                <th className="text-right">Plafond</th>
                <th className="text-right">Face ext. sans brique</th>
                <th className="text-right">Isolant murs ext.</th>
              </tr>
            </thead>
            <tbody>
              {a.rooms.map((r) => (
                <tr key={r.id} className="border-t border-rule/60">
                  <td className="py-1">{r.name}</td>
                  <td className={`text-right font-mono ${r.wallsOff ? "text-stone-300" : ""}`}>{r.wallsOff ? "non" : m2(r.walls)}</td>
                  <td className={`text-right font-mono ${r.ceilingOff ? "text-stone-300" : ""}`}>{r.ceilingOff ? "non" : m2(r.ceiling)}</td>
                  <td className="text-right font-mono">{r.outer > 0 ? m2(r.outer) : "—"}</td>
                  <td className="text-right font-mono">{r.iso > 0 ? m2(r.iso) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <div className="mb-1 font-semibold uppercase tracking-wide text-stone-500">Cloisons entre les pièces</div>
          {a.walls.length === 0 && <p className="text-stone-400">Aucune pièce ne se touche.</p>}
          {a.walls.map((w) => (
            <div key={w.key} className="flex flex-wrap items-center gap-2 border-t border-rule/60 py-1">
              <span className="font-semibold">{w.a} ⟷ {w.b}</span>
              <span className="text-stone-500">{fmtD(w.lengthM, 2)} m × {fmtD(w.heightM, 2)} m</span>
              {w.passage ? (
                <span className="ml-auto rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900">passage : rien compté</span>
              ) : (
                <span className="ml-auto flex flex-wrap gap-1">
                  <span className={`rounded px-1.5 py-0.5 font-semibold ${w.facesA ? "bg-emerald-100 text-emerald-900" : "bg-stone-100 text-stone-500"}`}>face {w.a} {w.facesA ? "✓" : "✗"}</span>
                  <span className={`rounded px-1.5 py-0.5 font-semibold ${w.facesB ? "bg-emerald-100 text-emerald-900" : "bg-stone-100 text-stone-500"}`}>face {w.b} {w.facesB ? "✓" : "✗"}</span>
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-900">ossature ✓</span>
                  <span className={`rounded px-1.5 py-0.5 font-semibold ${w.insulated ? "bg-emerald-100 text-emerald-900" : "bg-stone-100 text-stone-500"}`}>isolant {w.insulated ? "✓" : "✗"}</span>
                </span>
              )}
            </div>
          ))}
        </div>

        {a.parts.length > 0 && (
          <div>
            <div className="mb-1 font-semibold uppercase tracking-wide text-stone-500">Cloisons saisies à la main</div>
            {a.parts.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2 border-t border-rule/60 py-1">
                <span className="font-semibold">{p.name}</span>
                <span className="text-stone-500">{m2(p.m2)} (2 faces)</span>
                <span className={`ml-auto rounded px-1.5 py-0.5 font-semibold ${p.coveredByRooms ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>
                  {p.coveredByRooms ? "déjà comptée par les pièces" : "plaques comptées ✓"}
                </span>
              </div>
            ))}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="rounded-lg bg-amber-50 p-3 text-amber-900">
            <div className="mb-1 font-semibold">À savoir (ce qui n'est pas compté)</div>
            <ul className="list-disc space-y-0.5 pl-4">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}
