import { FileDown, CheckCheck, Square, Link2, ExternalLink, X } from "lucide-react";
import { POSTS } from "../data/catalogs";
import { useStore } from "../store";
import type { LineItem, PostId } from "../types";
import { groupByCategory, lineKey, lineTotal } from "../utils/calc";
import { fmtD, fmtE } from "../utils/format";
import { exportShoppingPdf } from "../utils/pdf";
import { Btn, Card, H, Stat, TableWrap, Td, Th } from "./ui";
import { useMemo, useState } from "react";

export function Shopping() {
  const { project, calc, setSettings } = useStore();
  const [post, setPost] = useState<PostId | "all">("all");
  const items = post === "all" ? calc.items : calc.byPost[post];
  const selection = project.settings.shoppingSelection ?? {};
  const groups = useMemo(() => groupByCategory(items), [items]);

  // Une ligne est retenue si elle est sélectionnée explicitement ; sinon elle est
  // cochée par défaut (et l'utilisateur peut la décocher).
  const isSelected = (i: LineItem) => selection[lineKey(i)] !== false;
  const selected = items.filter(isSelected);
  const totalAll = items.reduce((s, i) => s + lineTotal(i), 0);
  const totalSel = selected.reduce((s, i) => s + lineTotal(i), 0);

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
        sub="Cochez les éléments que vous achetez : l'export PDF ne contient que votre sélection, avec quantités et prix."
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
        <Stat label="Lignes affichées" value={String(items.length)} />
        <Stat label="Lignes retenues" value={String(selected.length)} accent="forest" />
        <Stat label="Total sélection" value={fmtE(totalSel)} accent="terra" />
        <Stat
          label="Total complet"
          value={fmtE(totalAll)}
          hint={fmtE(totalAll - totalSel) + " écartés"}
          accent="gold"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Btn onClick={() => exportShoppingPdf(project, calc, post === "all" ? undefined : post, selected.map(lineKey))}>
          <FileDown size={14} /> Exporter la sélection ({selected.length})
        </Btn>
        <Btn variant="ghost" onClick={() => selectAll(true)}>
          <CheckCheck size={14} /> Tout cocher
        </Btn>
        <Btn variant="ghost" onClick={() => selectAll(false)}>
          <Square size={14} /> Tout décocher
        </Btn>
        <span className="text-xs text-stone-500">
          Votre sélection est mémorisée et followe le projet sur tous vos appareils.
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
                <Th>Qté</Th>
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
                />
              ))}
            </tbody>
          </TableWrap>
        </Card>
      ))}
      {items.length === 0 && (
        <Card>
          <p className="text-sm text-stone-500">Aucune ligne — créez d'abord vos pièces dans Plans.</p>
        </Card>
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
}: {
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
      <Td>{fmtE(r.unitPrice)}</Td>
      <Td className="font-semibold">{fmtE(lineTotal(r))}</Td>
    </tr>
  );
}
