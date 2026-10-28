import { FileDown, Plus, Trash2 } from "lucide-react";
import { POSTS } from "../data/catalogs";
import { useStore } from "../store";
import type { ExpenseStatus, PostId } from "../types";
import { fmtE } from "../utils/format";
import { exportBudgetPdf } from "../utils/pdf";
import { Btn, Card, H, Input, Num, Select, Stat, TableWrap, Td, Th } from "./ui";

const POST_OPTS = [...POSTS.map((p) => p.id), "divers"] as const;

export function Budget() {
  const { project, calc, addExpense, updateExpense, removeExpense } = useStore();
  const paid = project.expenses.filter((e) => e.status === "paye").reduce((s, e) => s + e.amount, 0);
  const ordered = project.expenses.filter((e) => e.status === "commande").reduce((s, e) => s + e.amount, 0);
  const planned = project.expenses.filter((e) => e.status === "prevu").reduce((s, e) => s + e.amount, 0);
  const max = Math.max(calc.costWithMarginTotal, paid + ordered + planned, 1);

  return (
    <div>
      <H
        kicker="Trésorerie"
        title="Budget & dépenses"
        sub="Comparez l'estimé matériaux, ce qui est commandé, ce qui est payé. Exportez un PDF de suivi."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Estimé matériaux" value={fmtE(calc.costTotal)} hint={`+ ${fmtE(calc.costWithMarginTotal - calc.costTotal)} de marges`} />
        <Stat label="Budget avec marges" value={fmtE(calc.costWithMarginTotal)} accent="forest" />
        <Stat label="Payé" value={fmtE(paid)} accent="gold" />
        <Stat label="Écart (budget − payé)" value={fmtE(calc.costWithMarginTotal - paid)} accent="navy" />
      </div>

      <Card className="mb-4">
        <h2 className="font-display mb-3 text-lg font-bold">Répartition des postes</h2>
        <p className="mb-3 text-xs text-stone-500">
          Pertes incluses dans les quantités · marges ajoutées au budget (réglables dans Matériaux, tableau Pertes & marges).
        </p>
        <div className="space-y-2">
          {POSTS.map((p) => {
            const v = calc.costWithMarginByPost[p.id];
            const base = calc.costByPost[p.id];
            const margin = calc.marginByPost[p.id];
            const w = (v / max) * 100;
            return (
              <div key={p.id} className="grid grid-cols-[140px_1fr_90px] items-center gap-2 text-sm">
                <div className="truncate font-medium">{p.short}</div>
                <div className="h-3 overflow-hidden rounded-full bg-paper-2">
                  <div className="h-full rounded-full" style={{ width: `${w}%`, background: p.color }} />
                </div>
                <div className="text-right font-mono text-xs">
                  {fmtE(v)}
                  {margin > 0.5 && <div className="text-[10px] text-stone-400">dont {fmtE(margin)} marge</div>}
                  {margin <= 0.5 && <div className="text-[10px] text-stone-400">{fmtE(base)}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold">Journal des dépenses</h2>
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={() => exportBudgetPdf(project, calc, project.expenses)}>
              <FileDown size={14} /> PDF suivi
            </Btn>
            <Btn onClick={() => addExpense()}>
              <Plus size={14} /> Ligne
            </Btn>
          </div>
        </div>
        <TableWrap>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Poste</Th>
              <Th>Libellé</Th>
              <Th>Fournisseur</Th>
              <Th>Statut</Th>
              <Th>Montant</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {project.expenses.map((e) => (
              <tr key={e.id}>
                <Td>
                  <Input type="date" value={e.date} onChange={(ev) => updateExpense(e.id, { date: ev.target.value })} />
                </Td>
                <Td>
                  <Select
                    value={e.post}
                    onChange={(ev) => updateExpense(e.id, { post: ev.target.value as PostId | "divers" })}
                  >
                    {POST_OPTS.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </Select>
                </Td>
                <Td>
                  <Input value={e.label} onChange={(ev) => updateExpense(e.id, { label: ev.target.value })} />
                </Td>
                <Td>
                  <Input value={e.vendor} onChange={(ev) => updateExpense(e.id, { vendor: ev.target.value })} />
                </Td>
                <Td>
                  <Select
                    value={e.status}
                    onChange={(ev) => updateExpense(e.id, { status: ev.target.value as ExpenseStatus })}
                  >
                    <option value="prevu">Prévu</option>
                    <option value="commande">Commandé</option>
                    <option value="paye">Payé</option>
                  </Select>
                </Td>
                <Td>
                  <Num value={e.amount} onChange={(n) => updateExpense(e.id, { amount: n })} step={1} suffix="€" />
                </Td>
                <Td>
                  <button onClick={() => removeExpense(e.id)}>
                    <Trash2 size={14} className="text-stone-400 hover:text-red-700" />
                  </button>
                </Td>
              </tr>
            ))}
            {project.expenses.length === 0 && (
              <tr>
                <Td colSpan={7} className="text-stone-400">
                  Aucune dépense. Ajoutez vos factures magasin, artisan, location d'outils…
                </Td>
              </tr>
            )}
          </tbody>
        </TableWrap>
        <div className="mt-3 text-sm text-stone-500">
          Prévu {fmtE(planned)} · Commandé {fmtE(ordered)} · Payé {fmtE(paid)} · Engagement total {fmtE(paid + ordered + planned)}
        </div>
      </Card>
    </div>
  );
}
