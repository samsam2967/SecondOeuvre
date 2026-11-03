import { AlertTriangle, ArrowUpRight, ChevronDown, ChevronRight, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { POSTS } from "../data/catalogs";
import { useStore } from "../store";
import type { MatTarget, PostId, RoomExtra } from "../types";
import { roomMaterials } from "../utils/calc";
import { reconcile, type ReconRow } from "../utils/reconcile";
import { extraGroups, extraOptions, resolveExtra, type ExtraGroupId } from "../utils/extras";
import { fmtD, fmtE, fmtN } from "../utils/format";
import { uid } from "../utils/id";
import { Btn, Card, H, Input, Num, Select, Stat, TableWrap, Td, Th } from "./ui";

/** Prix unitaire lisible : plus de décimales pour les prix très faibles (vis, mètre de gaine…). */
function fmtPrice(p: number) {
  return `${fmtD(p, p < 0.1 ? 4 : p < 1 ? 3 : 2)} €`;
}

export function RecapPieces() {
  const { project, calc, updateRoom, openMaterial, setCommonExtras } = useStore();
  const [floorId, setFloorId] = useState<string>("all");
  const [roomId, setRoomId] = useState<string>("all");
  // Pièces et postes repliés par défaut : on déplie ce qu'on veut regarder.
  const [openRooms, setOpenRooms] = useState<Record<string, boolean>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const floors = project.floors;
  const visibleFloors = floors.filter((f) => floorId === "all" || f.id === floorId);

  // Chiffrage de chaque pièce (calculé pour TOUTES les pièces : sert aux totaux et à la réconciliation).
  const all = floors.flatMap((f) =>
    f.rooms.map((room) => {
      const lines = roomMaterials(project, room.id).map((l) => ({ ...l, total: l.qty * l.unitPrice }));
      return { floor: f, room, lines, total: lines.reduce((s, l) => s + l.total, 0) };
    }),
  );
  const shown = all.filter(
    (r) => (floorId === "all" || r.floor.id === floorId) && (roomId === "all" || r.room.id === roomId),
  );

  const noPrice = all.reduce((s, r) => s + r.lines.filter((l) => l.unitPrice === 0).length, 0);

  // Rapprochement ligne par ligne : chaque ligne du chiffrage global = part dans les pièces + reste (communs, arrondis).
  const rec = reconcile(project, calc);
  const [showAllLines, setShowAllLines] = useState(false);
  const communRows = rec.rows.filter((r) => r.kind === "commun");
  const communByPost = POSTS.map((p) => ({ post: p, rows: communRows.filter((r) => r.post === p.id) })).filter((g) => g.rows.length);
  const communTotal = communRows.reduce((s, r) => s + r.total, 0);
  const tableRows = (showAllLines ? rec.rows : rec.rows.filter((r) => r.kind !== "pieces")).slice().sort((a, b) => a.post.localeCompare(b.post) || Math.abs(b.rest) - Math.abs(a.rest));
  const explain = (r: ReconRow) =>
    r.kind === "commun"
      ? "Non rattaché à une pièce : compté une seule fois pour tout le chantier."
      : r.kind === "orphelin"
        ? "Présent dans une pièce mais pas dans le chiffrage global."
        : r.kind === "pieces"
          ? "Entièrement compté dans les pièces."
          : r.rest > 0
            ? "Reste : part commune (cloisons, passages, portes…) et arrondi à l'unité d'achat (boîte, sac, rouleau)."
            : "Les pièces additionnées dépassent un peu le total : chaque pièce arrondit séparément, le chantier arrondit une fois.";

  return (
    <div>
      <H
        kicker="Pilotage"
        title="Récapitulatif par pièce"
        sub="Pour chaque pièce : chaque matériau avec sa quantité, son prix unitaire et son total. Les prix viennent de l'onglet Matériaux, les quantités de Plans & pièces et Électricité."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Total du chantier" value={fmtE(rec.totalGlobal)} hint="chaque matériau compté une seule fois, hors marges" />
        <Stat label="Détaillé dans les pièces" value={fmtE(rec.totalRooms)} hint="somme des fiches de pièces ci-dessous" accent="forest" />
        <Stat label="Éléments communs" value={fmtE(communTotal)} hint="VMC, tableau, PAC, portes… voir plus bas" accent="navy" />
        <Stat
          label="Lignes sans prix"
          value={String(noPrice)}
          hint={noPrice ? "prix à 0 € dans Matériaux" : "tout est chiffré"}
          accent={noPrice ? "terra" : "forest"}
        />
      </div>

      <Card className="mb-4">
        <p className="text-sm leading-relaxed text-stone-700">
          <strong>Comment lire cette page.</strong> Le chiffrage du chantier compte chaque matériau <strong>une seule fois</strong>. Cette page le
          répartit : d'abord pièce par pièce (ce qui se pose dans chaque pièce, sanitaire et VMC compris), puis les <strong>éléments communs</strong> qui
          ne dépendent d'aucune pièce en particulier (caisson VMC, tableau électrique, pompe à chaleur, portes entre pièces…). Le tableau de
          rapprochement montre, ligne par ligne, ce qui est compté dans les pièces et ce qui reste. Le contrôle des doublons signale les matériaux
          qui pourraient être comptés deux fois.
        </p>
      </Card>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold text-stone-500">Étage</label>
          <Select
            value={floorId}
            onChange={(e) => {
              setFloorId(e.target.value);
              setRoomId("all");
            }}
            className="w-auto"
          >
            <option value="all">Tous les étages</option>
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
          <label className="text-xs font-semibold text-stone-500">Pièce</label>
          <Select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="w-auto">
            <option value="all">Toutes les pièces</option>
            {visibleFloors.flatMap((f) =>
              f.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              )),
            )}
          </Select>
          <span className="ml-auto flex gap-2">
            <button
              className="rounded-full border border-rule px-3 py-1.5 text-xs font-semibold hover:bg-paper-2"
              onClick={() => {
                const r: Record<string, boolean> = {};
                const g: Record<string, boolean> = {};
                for (const x of shown) {
                  r[x.room.id] = true;
                  for (const p of POSTS) g[`${x.room.id}|${p.id}`] = true;
                }
                setOpenRooms((o) => ({ ...o, ...r }));
                setOpenGroups((o) => ({ ...o, ...g }));
              }}
            >
              Tout déplier
            </button>
            <button
              className="rounded-full border border-rule px-3 py-1.5 text-xs font-semibold hover:bg-paper-2"
              onClick={() => {
                const r: Record<string, boolean> = {};
                for (const x of shown) r[x.room.id] = false;
                setOpenRooms((o) => ({ ...o, ...r }));
                setOpenGroups({});
              }}
            >
              Tout replier
            </button>
          </span>
        </div>
      </Card>

      {!all.length && (
        <Card>
          <p className="text-sm text-stone-600">Aucune pièce pour l'instant : dessinez-les dans « Plans &amp; pièces ».</p>
        </Card>
      )}

      <div className="space-y-4">
        {shown.map(({ floor, room, lines, total }) => {
          const groups = POSTS.map((p) => ({ post: p, rows: lines.filter((l) => l.post === p.id) })).filter((g) => g.rows.length);
          const isOpen = openRooms[room.id] ?? roomId !== "all";
          return (
            <Card key={room.id}>
              <button
                type="button"
                onClick={() => setOpenRooms((o) => ({ ...o, [room.id]: !isOpen }))}
                aria-expanded={isOpen}
                className={`flex w-full flex-wrap items-center justify-between gap-2 text-left ${isOpen ? "mb-3" : ""}`}
              >
                <span className="flex items-center gap-2">
                  {isOpen ? <ChevronDown size={18} className="text-stone-500" /> : <ChevronRight size={18} className="text-stone-500" />}
                  <span>
                    <span className="font-display block text-xl font-bold">{room.name}</span>
                    <span className="block text-xs text-stone-500">
                      {floor.name} · {fmtD(room.length * room.width, 1)} m² · {lines.length} ligne{lines.length > 1 ? "s" : ""}
                    </span>
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">Total pièce</span>
                  <span className="font-display block text-xl font-bold text-forest">{fmtE(total)}</span>
                </span>
              </button>
              {isOpen && (
                <>
              {!lines.length ? (
                <p className="text-sm text-stone-500">Aucun matériau prévu pour cette pièce.</p>
              ) : (
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>Matériau</Th>
                      <Th className="text-right">Quantité</Th>
                      <Th className="text-right">Prix unitaire</Th>
                      <Th className="text-right">Total</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => {
                      const sub = g.rows.reduce((s, l) => s + l.total, 0);
                      return (
                        <GroupRows
                          key={g.post.id}
                          label={g.post.label}
                          color={g.post.color}
                          subtotal={sub}
                          count={g.rows.length}
                          open={openGroups[`${room.id}|${g.post.id}`] ?? false}
                          onToggle={() => setOpenGroups((o) => ({ ...o, [`${room.id}|${g.post.id}`]: !(o[`${room.id}|${g.post.id}`] ?? false) }))}
                        >
                          {g.rows.map((l, i) => (
                            <tr key={i}>
                              <Td>
                                <MatLink mat={l.mat} onOpen={openMaterial}>
                                  {l.name}
                                </MatLink>
                                {(l.note || l.priceBasis) && (
                                  <div className="text-[10px] text-stone-400">
                                    {[l.note, l.priceBasis].filter(Boolean).join(" · ")}
                                  </div>
                                )}
                              </Td>
                              <Td className="whitespace-nowrap text-right font-mono">
                                <div className="ml-auto flex items-center justify-end gap-1.5">
                                  <div className="w-24">
                                    <Num
                                      value={l.qty}
                                      step={1}
                                      onChange={(n) => {
                                        const v = Math.max(0, n);
                                        if (l.extraId) {
                                          updateRoom(floor.id, room.id, {
                                            extras: (room.extras ?? []).map((x) => (x.id === l.extraId ? { ...x, qty: v } : x)),
                                          });
                                        } else if (l.key) {
                                          const next = { ...(room.qtyOverrides ?? {}) };
                                          if (l.autoQty !== undefined ? v === l.autoQty : v === l.qty) delete next[l.key];
                                          else next[l.key] = v;
                                          updateRoom(floor.id, room.id, { qtyOverrides: next });
                                        }
                                      }}
                                    />
                                  </div>
                                  <span className="text-[11px] text-stone-500">{l.unit}</span>
                                  {l.extraId && (
                                    <button
                                      title="Retirer ce matériau de la pièce"
                                      className="rounded p-1 text-red-700 hover:bg-red-50"
                                      onClick={() =>
                                        updateRoom(floor.id, room.id, { extras: (room.extras ?? []).filter((x) => x.id !== l.extraId) })
                                      }
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                  {l.overridden && l.key && (
                                    <button
                                      title={`Revenir à la quantité calculée (${fmtN(l.autoQty ?? 0, 1)} ${l.unit})`}
                                      className="rounded p-1 text-terra hover:bg-orange-50"
                                      onClick={() => {
                                        const next = { ...(room.qtyOverrides ?? {}) };
                                        delete next[l.key!];
                                        updateRoom(floor.id, room.id, { qtyOverrides: next });
                                      }}
                                    >
                                      <RotateCcw size={14} />
                                    </button>
                                  )}
                                </div>
                                {l.overridden && (
                                  <div className="mt-0.5 text-[10px] text-terra">modifié · auto : {fmtN(l.autoQty ?? 0, 1)}</div>
                                )}
                              </Td>
                              <Td className="whitespace-nowrap text-right font-mono">
                                {l.unitPrice > 0 ? fmtPrice(l.unitPrice) : <span className="text-amber-700">à saisir</span>}
                              </Td>
                              <Td className="whitespace-nowrap text-right font-mono font-semibold">{fmtE(l.total)}</Td>
                            </tr>
                          ))}
                        </GroupRows>
                      );
                    })}
                  </tbody>
                </TableWrap>
              )}
              <AddMaterial extras={room.extras ?? []} label="à cette pièce" onChange={(extras) => updateRoom(floor.id, room.id, { extras })} />
                </>
              )}
            </Card>
          );
        })}
      </div>

      {all.length > 0 && (
        <>
          <Card className="mt-4">
            <h2 className="font-display mb-1 text-lg font-bold">Éléments communs — non rattachés à une pièce</h2>
            <p className="mb-3 text-xs leading-relaxed text-stone-500">
              Ces matériaux sont comptés une seule fois pour tout le chantier : ils ne se posent pas dans une pièce en particulier (ou dépendent de
              l'ensemble). Ils ne figurent donc dans aucune fiche de pièce ci-dessus.
            </p>
            <div className="mb-3">
              <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">Mes ajouts pour le chantier</h3>
              {(project.commonExtras ?? []).length > 0 && (
                <ul className="mb-2 space-y-1">
                  {(project.commonExtras ?? []).map((x) => {
                    const r = resolveExtra(project.settings, x);
                    return (
                      <li key={x.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-rule bg-white/60 px-2 py-1.5 text-sm">
                        <span className="min-w-0 flex-1 truncate">{r ? r.name : "Matériau supprimé du catalogue"}</span>
                        <div className="w-24">
                          <Num value={x.qty} step={1} onChange={(n) => setCommonExtras((l) => l.map((y) => (y.id === x.id ? { ...y, qty: Math.max(0, n) } : y)))} />
                        </div>
                        <span className="w-14 text-[11px] text-stone-500">{r?.unit}</span>
                        <span className="w-24 text-right font-mono text-xs">{r ? fmtE(r.unitPrice * x.qty) : ""}</span>
                        <button
                          title="Retirer"
                          className="rounded p-1 text-red-700 hover:bg-red-50"
                          onClick={() => setCommonExtras((l) => l.filter((y) => y.id !== x.id))}
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <AddMaterial extras={project.commonExtras ?? []} label="au chantier (hors pièce)" onChange={(l) => setCommonExtras(l)} />
            </div>
            {!communByPost.length ? (
              <p className="text-sm text-stone-500">Aucun élément commun.</p>
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Matériau</Th>
                    <Th className="text-right">Quantité chantier</Th>
                    <Th className="text-right">Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {communByPost.map((g) => (
                    <GroupRows key={g.post.id} label={g.post.label} color={g.post.color} subtotal={g.rows.reduce((s, r) => s + r.total, 0)} span={2}>
                      {g.rows.map((r, i) => (
                        <tr key={i}>
                          <Td>
                            <MatLink mat={r.mat} onOpen={openMaterial}>
                              {r.name}
                            </MatLink>
                            {r.spec && <div className="text-[10px] text-stone-400">{r.spec}</div>}
                          </Td>
                          <Td className="whitespace-nowrap text-right font-mono">
                            {fmtN(r.qty, 1)} <span className="text-[11px] text-stone-500">{r.unit}</span>
                          </Td>
                          <Td className="whitespace-nowrap text-right font-mono font-semibold">{fmtE(r.total)}</Td>
                        </tr>
                      ))}
                    </GroupRows>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Card>

          <Card className="mt-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold">Contrôle des doublons</h2>
            </div>
            {!rec.duplicates.length ? (
              <p className="text-sm text-forest">Aucun doublon évident détecté.</p>
            ) : (
              <ul className="space-y-3">
                {rec.duplicates.map((d, i) => (
                  <li key={i} className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700" />
                    <div>
                      <div className="font-semibold text-amber-900">
                        {d.title} <span className="font-mono text-xs">(≈ {fmtE(d.amount)})</span>
                      </div>
                      <div className="mt-0.5 text-xs leading-relaxed text-stone-700">{d.detail}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-stone-400">
              La détection couvre les recoupements connus entre postes et les matériaux ajoutés à la main qui existent déjà dans le calcul automatique.
              Elle ne remplace pas un coup d'œil au tableau ci-dessous.
            </p>
          </Card>

          <Card className="mt-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold">Rapprochement ligne par ligne avec le chiffrage global</h2>
              <label className="flex items-center gap-2 text-xs text-stone-600">
                <input type="checkbox" checked={showAllLines} onChange={(e) => setShowAllLines(e.target.checked)} />
                Afficher aussi les lignes entièrement comptées dans les pièces
              </label>
            </div>
            <p className="mb-3 text-xs leading-relaxed text-stone-500">
              Pour chaque ligne du chiffrage : son total, la part détaillée dans les fiches de pièces, et le reste. Par pièce, les quantités sont
              comptées à l'unité (un kilo, un mètre, un morceau de pot) ; au total du chantier, elles sont arrondies à l'unité d'achat.
            </p>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Poste</Th>
                  <Th>Ligne</Th>
                  <Th className="text-right">Total chantier</Th>
                  <Th className="text-right">Dans les pièces</Th>
                  <Th className="text-right">Reste</Th>
                  <Th>Explication</Th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, i) => {
                  const p = POSTS.find((x) => x.id === r.post);
                  return (
                    <tr key={i}>
                      <Td className="whitespace-nowrap text-xs" >
                        <span className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{ background: p?.color }} />
                        {p?.label}
                      </Td>
                      <Td>
                        <MatLink mat={r.mat} onOpen={openMaterial}>
                          {r.name}
                        </MatLink>
                        {r.rooms.length > 0 && (
                          <div className="text-[10px] text-stone-400">{r.rooms.slice(0, 6).join(", ")}{r.rooms.length > 6 ? "…" : ""}</div>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-right font-mono">{fmtE(r.total)}</Td>
                      <Td className="whitespace-nowrap text-right font-mono">{fmtE(r.inRooms)}</Td>
                      <Td className={`whitespace-nowrap text-right font-mono font-semibold ${r.rest < -0.5 ? "text-amber-700" : ""}`}>{fmtE(r.rest)}</Td>
                      <Td className="text-[11px] text-stone-500">{explain(r)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
          </Card>

          <Card className="mt-4">
            <h2 className="font-display mb-2 text-lg font-bold">Totaux par poste</h2>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Poste</Th>
                  <Th className="text-right">Dans les pièces</Th>
                  <Th className="text-right">Communs</Th>
                  <Th className="text-right">Arrondis</Th>
                  <Th className="text-right">Total chantier</Th>
                </tr>
              </thead>
              <tbody>
                {POSTS.map((p) => {
                  const rs2 = rec.rows.filter((r) => r.post === p.id);
                  if (!rs2.length) return null;
                  const total = rs2.reduce((s, r) => s + r.total, 0);
                  const commun = rs2.filter((r) => r.kind === "commun").reduce((s, r) => s + r.total, 0);
                  const inRooms = rs2.filter((r) => r.kind !== "commun").reduce((s, r) => s + Math.min(r.inRooms, r.total), 0);
                  return (
                    <tr key={p.id}>
                      <Td>
                        <span className="mr-2 inline-block h-2 w-2 rounded-sm" style={{ background: p.color }} />
                        {p.label}
                      </Td>
                      <Td className="text-right font-mono">{fmtE(inRooms)}</Td>
                      <Td className="text-right font-mono">{fmtE(commun)}</Td>
                      <Td className="text-right font-mono">{fmtE(total - commun - inRooms)}</Td>
                      <Td className="text-right font-mono font-semibold">{fmtE(total)}</Td>
                    </tr>
                  );
                })}
                <tr>
                  <Td className="font-bold">Total</Td>
                  <Td className="text-right font-mono font-bold">{fmtE(rec.rows.filter((r) => r.kind !== "commun").reduce((s, r) => s + Math.min(r.inRooms, r.total), 0))}</Td>
                  <Td className="text-right font-mono font-bold">{fmtE(communTotal)}</Td>
                  <Td className="text-right font-mono font-bold">
                    {fmtE(rec.totalGlobal - communTotal - rec.rows.filter((r) => r.kind !== "commun").reduce((s, r) => s + Math.min(r.inRooms, r.total), 0))}
                  </Td>
                  <Td className="text-right font-mono font-bold">{fmtE(rec.totalGlobal)}</Td>
                </tr>
              </tbody>
            </TableWrap>
          </Card>
        </>
      )}
    </div>
  );
}

function GroupRows({
  label,
  color,
  subtotal,
  span = 3,
  count,
  open = true,
  onToggle,
  children,
}: {
  label: string;
  color: string;
  subtotal: number;
  span?: number;
  count?: number;
  /** Quand `onToggle` est fourni, le poste se plie / se déplie. */
  open?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr className={onToggle ? "cursor-pointer hover:brightness-95" : ""} onClick={onToggle}>
        <Td colSpan={span} className="bg-paper-2 text-[11px] font-bold uppercase tracking-[0.12em]">
          <span className="flex items-center gap-1.5">
            {onToggle && (open ? <ChevronDown size={14} className="text-stone-500" /> : <ChevronRight size={14} className="text-stone-500" />)}
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: color }} />
            <span style={{ color }}>{label}</span>
            {count !== undefined && <span className="font-normal normal-case tracking-normal text-stone-400">· {count} ligne{count > 1 ? "s" : ""}</span>}
          </span>
        </Td>
        <Td className="bg-paper-2 text-right font-mono text-xs font-bold">{fmtE(subtotal)}</Td>
      </tr>
      {open && children}
    </>
  );
}

/** Nom d'un matériau : cliquable, il ouvre la page Matériaux sur la ligne ou le produit correspondant. */
function MatLink({ mat, onOpen, children }: { mat?: MatTarget; onOpen: (t: MatTarget) => void; children: React.ReactNode }) {
  if (!mat) return <div className="text-stone-800">{children}</div>;
  return (
    <button
      type="button"
      title="Voir ce matériau dans la page Matériaux"
      onClick={() => onOpen(mat)}
      className="group flex items-start gap-1 text-left text-stone-800 hover:text-terra"
    >
      <span className="underline decoration-stone-300 decoration-dotted underline-offset-2 group-hover:decoration-terra">{children}</span>
      <ArrowUpRight size={12} className="mt-1 shrink-0 text-stone-300 group-hover:text-terra" />
    </button>
  );
}

/** Ajout d'un matériau du catalogue (page Matériaux) à une pièce. */
function AddMaterial({ extras, label, onChange }: { extras: RoomExtra[]; label: string; onChange: (extras: RoomExtra[]) => void }) {
  const { project } = useStore();
  const S = project.settings;
  const groups = extraGroups(POSTS.map((p) => ({ id: p.id, label: p.label })));
  const [group, setGroup] = useState<ExtraGroupId>("sanitaire");
  const [query, setQuery] = useState("");
  const [pick, setPick] = useState("");
  const [qty, setQty] = useState(1);

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const options = extraOptions(S, group)
    .filter((o) => words.every((w) => o.label.toLowerCase().includes(w)))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  const ref = options.some((o) => o.ref === pick) ? pick : (options[0]?.ref ?? "");

  const kind: RoomExtra["kind"] = options.find((o) => o.ref === ref)?.kind ?? "price";
  const post: PostId = group === "cat:tile" ? "carrelage" : group === "cat:paint" ? "peinture" : group === "cat:isolant" ? "isolation" : group;
  const preview = ref ? resolveExtra(S, { kind, post, ref }) : null;

  const add = () => {
    if (!ref || !(qty > 0)) return;
    const list = extras;
    const same = list.find((x) => x.kind === kind && x.post === post && x.ref === ref);
    onChange(same ? list.map((x) => (x === same ? { ...x, qty: x.qty + qty } : x)) : [...list, { id: uid(), kind, post, ref, qty }]);
  };

  return (
    <details className="mt-3 rounded-xl border border-rule bg-paper p-3">
      <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
        Ajouter un matériau {label}
      </summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-[10px] font-semibold text-stone-500">
          Catégorie
          <Select
            value={group}
            onChange={(e) => {
              setGroup(e.target.value as ExtraGroupId);
              setQuery("");
              setPick("");
            }}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-[10px] font-semibold text-stone-500">
          Rechercher
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ex. évier, mitigeur, câble…" />
        </label>
        <label className="text-[10px] font-semibold text-stone-500 sm:col-span-2">
          Matériau ({options.length})
          <Select value={ref} onChange={(e) => setPick(e.target.value)}>
            {options.map((o) => (
              <option key={o.ref} value={o.ref}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <label className="w-28 text-[10px] font-semibold text-stone-500">
          Quantité{preview ? ` (${preview.unit})` : ""}
          <Num value={qty} onChange={(n) => setQty(Math.max(0, n))} step={1} />
        </label>
        <Btn onClick={add} disabled={!ref || !(qty > 0)}>
          <Plus size={14} /> Ajouter
        </Btn>
        {preview && (
          <span className="text-xs text-stone-600">
            {fmtPrice(preview.unitPrice)} — {preview.spec}
            {qty > 0 && <> · total {fmtE(preview.unitPrice * qty)}</>}
          </span>
        )}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-stone-400">
        La quantité est prise telle que saisie (aucune perte ajoutée). Le prix suit l'onglet Matériaux, et le matériau est
        compté dans le chiffrage global, le budget et les listes de courses.
      </p>
    </details>
  );
}
