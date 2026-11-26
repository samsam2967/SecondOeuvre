import { FileDown, CheckCheck, Square, Link2, ExternalLink, X, ShoppingCart, Undo2 } from "lucide-react";
import { uid } from "../utils/id";
import { POSTS } from "../data/catalogs";
import { useStore } from "../store";
import type { LineItem, PostId } from "../types";
import { groupByCategory, lineKey, lineTotal } from "../utils/calc";
import { fmtD, fmtE } from "../utils/format";
import { exportShoppingPdf } from "../utils/pdf";
import { Btn, Card, H, Stat, TableWrap, Td, Th } from "./ui";
import { useMemo, useState } from "react";

export function Shopping() {
  const { project, calc, setSettings, addExpense, removeExpense } = useStore();
  const [post, setPost] = useState<PostId | "all">("all");
  const [view, setView] = useState<"todo" | "done" | "all">("todo");
  const bought = project.settings.shoppingBought ?? {};
  const nowQ = project.settings.shoppingNow ?? {};
  const allItems = post === "all" ? calc.items : calc.byPost[post];
  const boughtOf = (i: LineItem) => bought[lineKey(i)] ?? 0;
  const remainOf = (i: LineItem) => Math.max(0, Math.round((i.quantity - boughtOf(i)) * 100) / 100);
  const items = allItems.filter((i) => (view === "all" ? true : view === "todo" ? remainOf(i) > 0 : boughtOf(i) > 0));
  const selection = project.settings.shoppingSelection ?? {};
  const groups = useMemo(() => groupByCategory(items), [items]);

  // Une ligne est retenue si elle est sélectionnée explicitement ; sinon elle est
  // cochée par défaut (et l'utilisateur peut la décocher).
  const isSelected = (i: LineItem) => selection[lineKey(i)] !== false;
  const selected = items.filter(isSelected);
  const qtyNowOf = (i: LineItem) => Math.min(remainOf(i), nowQ[lineKey(i)] ?? remainOf(i));
  const totalAll = allItems.reduce((s, i) => s + lineTotal(i), 0);
  const totalBought = allItems.reduce((s, i) => s + boughtOf(i) * i.unitPrice, 0);
  const totalRemain = allItems.reduce((s, i) => s + remainOf(i) * i.unitPrice, 0);
  const totalSel = selected.reduce((s, i) => s + qtyNowOf(i) * i.unitPrice, 0);
  const setNow = (i: LineItem, q: number) =>
    setSettings({ ...project.settings, shoppingNow: { ...nowQ, [lineKey(i)]: Math.max(0, Math.min(remainOf(i), q)) } });
  const validatePurchase = () => {
    const lines = selected.map((i) => ({ i, qty: qtyNowOf(i) })).filter((x) => x.qty > 0);
    if (!lines.length) return;
    const id = uid();
    const date = new Date().toISOString().slice(0, 10);
    const nextBought = { ...bought };
    const nextNow = { ...nowQ };
    lines.forEach(({ i, qty }) => {
      nextBought[lineKey(i)] = Math.round((boughtOf(i) + qty) * 100) / 100;
      delete nextNow[lineKey(i)];
    });
    // une dépense « payée » par poste, pour que le budget se mette à jour
    const byPost = new Map<string, number>();
    lines.forEach(({ i, qty }) => byPost.set(i.post, (byPost.get(i.post) ?? 0) + qty * i.unitPrice));
    const expenseIds: string[] = [];
    byPost.forEach((amount, p) => {
      const eid = uid();
      expenseIds.push(eid);
      addExpense({ id: eid, date, post: p as PostId, label: `Courses du ${new Date(date).toLocaleDateString("fr-FR")} — ${POSTS.find((x) => x.id === p)?.short ?? p}`, amount: Math.round(amount * 100) / 100, status: "paye", vendor: "Liste de courses", notes: `achat:${id}` });
    });
    const amount = lines.reduce((s, x) => s + x.qty * x.i.unitPrice, 0);
    setSettings((st) => ({
      ...st,
      shoppingBought: nextBought,
      shoppingNow: nextNow,
      shoppingBatches: [{ id, date, lines: lines.map((x) => ({ key: lineKey(x.i), qty: x.qty })), amount, expenseIds }, ...(st.shoppingBatches ?? [])].slice(0, 40),
    }));
  };
  const cancelBatch = (bid: string) => {
    const b = (project.settings.shoppingBatches ?? []).find((x) => x.id === bid);
    if (!b) return;
    const nb = { ...bought };
    b.lines.forEach((l) => (nb[l.key] = Math.max(0, Math.round(((nb[l.key] ?? 0) - l.qty) * 100) / 100)));
    b.expenseIds.forEach((e) => removeExpense(e));
    setSettings((st) => ({ ...st, shoppingBought: nb, shoppingBatches: (st.shoppingBatches ?? []).filter((x) => x.id !== bid) }));
  };

  const setSel = (key: string, value: boolean) =>
    setSettings({ ...project.settings, shoppingSelection: { ...selection, [key]: value } });

  const links = project.settings.productLinks ?? {};
  // Lien d'une ligne : celui du matériau (onglet Matériaux) en priorité, sinon le lien propre à la ligne.
  const linkFor = (i: LineItem) =>
    (i.linkKey ? links[`mat:${i.post}:${i.linkKey}`] : undefined) ?? links[lineKey(i)] ?? "";
  const setLink = (i: LineItem, url: string) => {
    // L'édition depuis la liste écrit sur la clé matériau si elle existe : le lien
    // est alors partagé avec l'onglet Matériaux et toutes les lignes du même produit.
    const key = i.linkKey ? `mat:${i.post}:${i.linkKey}` : lineKey(i);
    const next = { ...links };
    if (url.trim()) next[key] = url.trim();
    else {
      delete next[key];
      delete next[lineKey(i)];
    }
    setSettings({ ...project.settings, productLinks: next });
  };

  const selectAll = (value: boolean) => {
    const next = { ...selection };
    items.forEach((i) => (next[lineKey(i)] = value));
    setSettings({ ...project.settings, shoppingSelection: next });
  };

  const selForPost = (p: PostId) => {
    const list = calc.byPost[p];
    const sel = list.filter(isSelected);
    return { count: sel.length, total: sel.reduce((s, i) => s + lineTotal(i), 0) };
  };

  return (
    <div>
      <H
        kicker="Approvisionnement"
        title="Listes de courses"
        sub="Choisis quoi acheter et en quelle quantité, valide l'achat : la liste « reste à acheter » et le budget se mettent à jour."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setPost("all")}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold ${post === "all" ? "bg-ink text-paper" : "border border-rule"}`}
        >
          Tout
        </button>
        {POSTS.map((p) => {
          const s = selForPost(p.id);
          return (
            <button
              key={p.id}
              onClick={() => setPost(p.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${post === p.id ? "bg-ink text-paper" : "border border-rule"}`}
            >
              {p.short}
              <span className="ml-1.5 text-[10px] opacity-70">{s.count}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Reste à acheter" value={fmtE(totalRemain)} accent="terra" hint={`${allItems.filter((i) => remainOf(i) > 0).length} lignes`} />
        <Stat label="Déjà acheté" value={fmtE(totalBought)} accent="forest" />
        <Stat label="À acheter maintenant" value={fmtE(totalSel)} hint={`${selected.length} lignes cochées`} accent="gold" />
        <Stat label="Total prévu" value={fmtE(totalAll)} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {([["todo", "À acheter"], ["done", "Déjà acheté"], ["all", "Tout"]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setView(v)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${view === v ? "bg-forest text-white" : "border border-rule"}`}>{l}</button>
        ))}
        <Btn onClick={validatePurchase}>
          <ShoppingCart size={14} /> Valider l'achat ({selected.filter((i) => qtyNowOf(i) > 0).length} lignes · {fmtE(totalSel)})
        </Btn>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Btn onClick={() => exportShoppingPdf(project, calc, post === "all" ? undefined : post, selected.filter((i) => qtyNowOf(i) > 0).map(lineKey))}>
          <FileDown size={14} /> Exporter la sélection ({selected.length})
        </Btn>
        <Btn variant="ghost" onClick={() => selectAll(true)}>
          <CheckCheck size={14} /> Tout cocher
        </Btn>
        <Btn variant="ghost" onClick={() => selectAll(false)}>
          <Square size={14} /> Tout décocher
        </Btn>
        <span className="text-xs text-stone-500">
          Valider l'achat ajoute une dépense « payée » dans le Budget, par poste. Tu peux l'annuler dans l'historique en bas de page.
        </span>
      </div>

      {groups.map(([cat, rows]) => (
        <Card key={cat} className="mb-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">{cat}</h2>
            <span className="text-xs text-stone-500">
              {rows.filter(isSelected).length}/{rows.length} retenues ·{" "}
              {fmtE(rows.filter(isSelected).reduce((s, i) => s + lineTotal(i), 0))}
            </span>
          </div>
          <TableWrap>
            <thead>
              <tr>
                <Th></Th>
                <Th>Poste</Th>
                <Th>Désignation</Th>
                <Th>Prévu</Th>
                <Th>Acheté</Th>
                <Th>Reste</Th>
                <Th>Acheter maintenant</Th>
                <Th>PU</Th>
                <Th>Total</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <CheckRow
                  key={r.id}
                  r={r}
                  checked={isSelected(r)}
                  onChange={(v) => setSel(lineKey(r), v)}
                  link={linkFor(r)}
                  onLink={(url) => setLink(r, url)}
                  bought={boughtOf(r)}
                  remain={remainOf(r)}
                  now={qtyNowOf(r)}
                  onNow={(q) => setNow(r, q)}
                />
              ))}
            </tbody>
          </TableWrap>
        </Card>
      ))}
      {items.length === 0 && (
        <Card>
          <p className="text-sm text-stone-500">{view === "todo" ? "Plus rien à acheter dans cette liste, ou aucune pièce créée dans Plans." : view === "done" ? "Rien n'est marqué comme acheté pour l'instant." : "Aucune ligne — crée d'abord tes pièces dans Plans."}</p>
        </Card>
      )}
      {(project.settings.shoppingBatches ?? []).length > 0 && (
        <details className="rounded-xl border border-rule bg-white/70 p-4">
          <summary className="cursor-pointer text-sm font-semibold">Historique des achats validés ({(project.settings.shoppingBatches ?? []).length})</summary>
          <ul className="mt-2 space-y-1 text-sm">
            {(project.settings.shoppingBatches ?? []).map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 border-t border-rule/60 pt-1">
                <span>{new Date(b.date).toLocaleDateString("fr-FR")} · {b.lines.length} lignes · {fmtE(b.amount)}</span>
                <button className="flex items-center gap-1 text-xs font-semibold text-terra" onClick={() => cancelBatch(b.id)}><Undo2 size={12} /> Annuler cet achat</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function CheckRow({
  r,
  checked,
  onChange,
  link,
  onLink,
  bought,
  remain,
  now,
  onNow,
}: {
  bought: number;
  remain: number;
  now: number;
  onNow: (q: number) => void;
  r: LineItem;
  checked: boolean;
  onChange: (v: boolean) => void;
  link: string;
  onLink: (url: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(link);

  const save = () => {
    let url = draft.trim();
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
    onLink(url);
    setEditing(false);
  };

  return (
    <tr className={checked ? "" : "bg-stone-50 text-stone-400"}>
      <Td>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-forest" />
      </Td>
      <Td className="text-xs uppercase tracking-wider">{POSTS.find((p) => p.id === r.post)?.short}</Td>
      <Td>
        <div className="flex items-center gap-1.5">
          {r.photo && (
            <img src={r.photo} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-rule object-cover" />
          )}
          <span className="font-medium text-ink">{r.name}</span>
          {link && !editing && (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              title={link}
              className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-forest hover:bg-emerald-100"
            >
              <ExternalLink size={10} /> Acheter
            </a>
          )}
          <button
            onClick={() => {
              setDraft(link);
              setEditing((v) => !v);
            }}
            title={link ? "Modifier le lien d'achat" : "Ajouter un lien d'achat"}
            className={`rounded p-0.5 ${link ? "text-forest" : "text-stone-300 hover:text-stone-500"}`}
          >
            <Link2 size={12} />
          </button>
        </div>
        {editing && (
          <form
            className="mt-1 flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="https://www.leroymerlin.fr/…"
              className="w-56 rounded border border-rule px-1.5 py-0.5 font-mono text-[10px] text-ink"
            />
            <button type="submit" className="rounded bg-forest px-1.5 py-0.5 text-[10px] font-semibold text-white">
              OK
            </button>
            {link && (
              <button
                type="button"
                onClick={() => {
                  onLink("");
                  setEditing(false);
                }}
                title="Supprimer le lien"
                className="rounded p-0.5 text-stone-400 hover:text-red-700"
              >
                <X size={12} />
              </button>
            )}
          </form>
        )}
        <div className="text-[11px]">
          {r.spec} {r.notes && `· ${r.notes}`}
        </div>
      </Td>
      <Td className="font-mono">
        {fmtD(r.quantity, 2)} {r.unit}
      </Td>
      <Td className={`font-mono ${bought > 0 ? "text-forest" : "text-stone-300"}`}>{fmtD(bought, 2)}</Td>
      <Td className="font-mono font-semibold">{fmtD(remain, 2)}</Td>
      <Td>
        {remain > 0 ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={remain}
              step={r.unit === "m²" || r.unit === "ml" || r.unit === "m" ? 0.5 : 1}
              value={now}
              onChange={(e) => onNow(Number(e.target.value))}
              className="w-20 rounded border border-rule px-1.5 py-0.5 font-mono text-xs"
            />
            <button onClick={() => onNow(remain)} title="Tout le reste" className="rounded border border-rule px-1 text-[10px] font-semibold">tout</button>
          </div>
        ) : (
          <span className="text-[11px] font-semibold text-forest">✓ acheté</span>
        )}
      </Td>
      <Td>{fmtE(r.unitPrice)}</Td>
      <Td className="font-semibold">{fmtE(now * r.unitPrice)}</Td>
    </tr>
  );
}
