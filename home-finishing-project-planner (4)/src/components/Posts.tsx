import { FileDown, Info } from "lucide-react";
import {
  DTU_REFS,
  ISOLANTS,
  PLAQUE_INFO,
  POSE_LABELS,
  POSTS,
  QUALITY_TARGETS,
  rValue,
} from "../data/catalogs";
import { TUTORIALS } from "../data/tutorials";
import { useStore } from "../store";
import type {
  ElecSettings,
  IsolationSettings,
  IsolQuality,
  PaintProduct,
  PeintureSettings,
  PoseIsolation,
  PostId,
  TileProduct,
  VmcSettings,
  VmcType,
} from "../types";
import { groupByCategory, lineTotal } from "../utils/calc";
import { fmtD, fmtE } from "../utils/format";
import { exportShoppingPdf } from "../utils/pdf";
import { Btn, Card, Field, H, Num, Select, Stat, TableWrap, Td, Th, Toggle } from "./ui";

export function PostPage({ post }: { post: PostId }) {
  const { calc, project, setPage } = useStore();
  const meta = POSTS.find((p) => p.id === post)!;
  const items = calc.byPost[post];
  const total = calc.costByPost[post];
  const margin = calc.marginByPost[post] ?? 0;
  const tutos = TUTORIALS.filter((t) => t.post === post);

  return (
    <div>
      <H kicker={meta.short} title={meta.label} sub={meta.blurb + " · " + DTU_REFS[post].join(" · ")} />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat
          label="Estimé du poste"
          value={fmtE(total + margin)}
          hint={margin > 0.5 ? `dont ${fmtE(margin)} de marge · ${items.length} lignes` : `${items.length} lignes`}
        />
        <Stat label="Plancher" value={`${fmtD(calc.surfaces.floor, 1)} m²`} accent="forest" />
        <Stat label="Pièces" value={String(calc.surfaces.rooms)} hint="base de tous les calculs" accent="navy" />
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rule bg-white/70 px-4 py-3">
        <div>
          <div className="text-sm font-semibold">Catalogue centralisé dans Matériaux</div>
          <p className="text-xs text-stone-500">Formats, tailles, unités, prix et liens d'achat se règlent à un seul endroit.</p>
        </div>
        <Btn variant="ghost" onClick={() => setPage("materiaux")}>Ouvrir Matériaux</Btn>
      </div>

      {post === "placo" && <PlacoPanel />}
      {post === "isolation" && <IsolationPanel />}
      {post === "electricite" && <ElecPanel />}
      {post === "sanitaire" && <SanitairePanel />}
      {post === "vmc" && <VmcPanel />}
      {post === "chauffage" && <ChauffagePanel />}
      {post === "peinture" && <PeinturePanel />}
      {post === "carrelage" && <CarrelagePanel />}
      {post === "quincaillerie" && <QuincPanel />}

      <div className="mt-6 flex flex-wrap gap-2">
        <Btn onClick={() => exportShoppingPdf(project, calc, post)}>
          <FileDown size={14} /> PDF de ce poste
        </Btn>
        <Btn variant="ghost" onClick={() => setPage("tutoriels")}>
          Tutoriels {meta.short}
        </Btn>
      </div>

      <Card className="mt-4">
        <h2 className="font-display mb-3 text-lg font-bold">Quantitatif détaillé</h2>
        <ItemsTable items={items} />
      </Card>

      {tutos.length > 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {tutos.map((t) => (
            <Card key={t.id} className="flex gap-3">
              <img src={t.image} alt="" className="h-20 w-28 rounded-xl object-cover" />
              <div>
                <div className="text-sm font-semibold">{t.title}</div>
                <div className="text-xs text-stone-500">
                  {t.duration} · {t.level}
                </div>
                <button className="mt-1 text-xs font-semibold text-terra" onClick={() => setPage("tutoriels")}>
                  Ouvrir le tuto →
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemsTable({ items }: { items: ReturnType<typeof groupByCategory>[number][1] | import("../types").LineItem[] }) {
  const groups = groupByCategory(items);
  if (!items.length) {
    return <p className="text-sm text-stone-500">Ajoutez des pièces dans l'onglet Plans pour générer le quantitatif.</p>;
  }
  return (
    <div className="space-y-5">
      {groups.map(([cat, rows]) => (
        <div key={cat}>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">{cat}</div>
          <TableWrap>
            <thead>
              <tr>
                <Th>Désignation</Th>
                <Th>Spécification</Th>
                <Th>Qté</Th>
                <Th>PU</Th>
                <Th>Total</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <div className="flex items-center gap-2">
                      {r.photo && (
                        <img src={r.photo} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-rule object-cover" />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium">{r.name}</div>
                        {r.notes && <div className="text-[11px] text-stone-400">{r.notes}</div>}
                      </div>
                    </div>
                  </Td>
                  <Td className="text-xs text-stone-500">{r.spec}</Td>
                  <Td className="font-mono">
                    {fmtD(r.quantity, 2)} {r.unit}
                  </Td>
                  <Td>{fmtE(r.unitPrice)}</Td>
                  <Td className="font-semibold">{fmtE(lineTotal(r))}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </div>
      ))}
    </div>
  );
}

function PlacoPanel() {
  const { calc } = useStore();

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-display mb-2 text-lg font-bold">Calepinage des plaques</h2>
        <p className="text-sm leading-relaxed text-stone-600">
          Formats par type de plaque, rails, montants, prix, pertes et consommables sont configurés uniquement dans
          l'onglet <strong>Matériaux → Placo</strong>. Le type de plaque se choisit par paroi dans Plans.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-500">
          <span className="rounded-lg bg-paper-2 px-2 py-1">Format BA13 : taille par type dans Matériaux</span>
          <span className="rounded-lg bg-paper-2 px-2 py-1">Hydro pour locaux humides concernés</span>
          <span className="rounded-lg bg-paper-2 px-2 py-1">Passages exclus des surfaces</span>
        </div>
        <p className="mt-2 text-xs text-stone-500">Rappel DTU 25.41 : entraxe courant 60 cm, réduit à 40 cm sous faïence ; plaques hydrofugées en locaux humides concernés.</p>
      </Card>
      <Card>
        <h2 className="font-display mb-3 text-lg font-bold">Par pièce — plaques</h2>
        <TableWrap>
          <thead>
            <tr>
              <Th>Pièce</Th>
              <Th>Étage</Th>
              <Th>Type</Th>
              <Th>M² placo</Th>
              <Th>Plaques</Th>
            </tr>
          </thead>
          <tbody>
            {calc.perRoom.map((r) => (
              <tr key={r.room.id}>
                <Td>{r.room.name}</Td>
                <Td>{r.floorName}</Td>
                <Td>{PLAQUE_INFO[r.room.placoType].label}</Td>
                <Td>{fmtD(r.placoM2, 1)} m²</Td>
                <Td className="font-semibold">{fmtD(r.plaques, 1)}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>
    </div>
  );
}

function IsolationPanel() {
  const { project, patchSettings, calc } = useStore();
  const s = project.settings.isolation;
  const set = (p: Partial<IsolationSettings>) => patchSettings("isolation", { ...s, ...p });
  const target = QUALITY_TARGETS[s.quality];

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-display mb-3 text-lg font-bold">Niveau d'isolation visé</h2>
        <div className="grid gap-2 sm:grid-cols-4">
          {(Object.keys(QUALITY_TARGETS) as IsolQuality[]).map((k) => (
            <button
              key={k}
              onClick={() => set({ quality: k })}
              className={`rounded-xl border p-3 text-left ${s.quality === k ? "border-forest bg-emerald-50" : "border-rule"}`}
            >
              <div className="text-sm font-bold">{QUALITY_TARGETS[k].label}</div>
              <div className="text-[11px] text-stone-500">R murs ≥ {QUALITY_TARGETS[k].rMur}</div>
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-stone-600">{target.desc}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <RPill label="Murs" r={calc.isolation.rMur} target={target.rMur} />
          <RPill label="Sol" r={calc.isolation.rSol} target={target.rSol} />
          <RPill label="Cloisons" r={calc.isolation.rCloison} target={0.8} />
        </div>
      </Card>

      <Card>
        <h2 className="font-display mb-3 text-lg font-bold">Système de pose murs</h2>
        <Select value={s.pose} onChange={(e) => set({ pose: e.target.value as PoseIsolation })}>
          {Object.entries(POSE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-stone-600">
          {POSE_LABELS[s.pose].steps.map((st) => (
            <li key={st}>{st}</li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-stone-500">
          Entraxes d'appuis et montants, profondeur de la gaine technique de logement (GTL), longueur des profils et
          prix se règlent une seule fois dans <strong>Matériaux → Isolation</strong>.
        </p>
        <img src="/images/isolation-coupe.png" alt="Coupe isolation" className="mt-4 max-h-56 w-full rounded-xl object-cover" />
      </Card>

      <Card>
        <h2 className="font-display mb-3 text-lg font-bold">Isolants choisis</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <IsolSelect label="Murs" value={s.isolantMurId} onChange={(id) => set({ isolantMurId: id })} usage="mur" />
          <IsolSelect label="Cloisons" value={s.isolantCloisonId} onChange={(id) => set({ isolantCloisonId: id })} usage="cloison" />
          <IsolSelect label="Sol / PC" value={s.isolantSolId} onChange={(id) => set({ isolantSolId: id })} usage="sol" />
        </div>
      </Card>

      <Card>
        <h2 className="font-display mb-3 text-lg font-bold">Comparer les isolants murs (R vs prix)</h2>
        <TableWrap>
          <thead>
            <tr>
              <Th>Produit</Th>
              <Th>Ép.</Th>
              <Th>R</Th>
              <Th>€/m²</Th>
              <Th>Bio</Th>
              <Th>Cible</Th>
            </tr>
          </thead>
          <tbody>
            {calc.isolation.comparisons
              .slice()
              .sort((a, b) => b.r - a.r)
              .map((c) => (
                <tr
                  key={c.id + c.thickness}
                  className={`cursor-pointer hover:bg-paper-2 ${c.id === s.isolantMurId ? "bg-emerald-50" : ""}`}
                  onClick={() => set({ isolantMurId: c.id })}
                >
                  <Td>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-[11px] text-stone-400">{c.notes}</div>
                  </Td>
                  <Td>{c.thickness} mm</Td>
                  <Td className="font-mono">{fmtD(c.r, 2)}</Td>
                  <Td>{fmtE(c.priceM2)}</Td>
                  <Td>{c.bio ? "oui" : "—"}</Td>
                  <Td>
                    <span className={c.ok ? "text-emerald-700" : "text-amber-700"}>{c.ok ? "atteint" : "sous cible"}</span>
                  </Td>
                </tr>
              ))}
          </tbody>
        </TableWrap>
      </Card>
    </div>
  );
}

function IsolSelect({
  label,
  value,
  onChange,
  usage,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  usage: "mur" | "cloison" | "sol" | "plafond";
}) {
  const { project } = useStore();
  const catalog = project.settings.isolants?.length ? project.settings.isolants : ISOLANTS;
  const list = catalog.filter((i) => i.usages.includes(usage));
  const cur = catalog.find((i) => i.id === value);
  return (
    <Field label={label} hint={cur ? `R = ${fmtD(rValue(cur.lambda, cur.thickness), 2)} · λ ${cur.lambda}` : ""}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {list.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name} {i.thickness} mm (R {rValue(i.lambda, i.thickness).toFixed(2)}) — {fmtE(i.priceM2)}/m²
          </option>
        ))}
      </Select>
    </Field>
  );
}

function RPill({ label, r, target }: { label: string; r: number; target: number }) {
  const ok = r >= target;
  return (
    <div className={`rounded-xl border p-3 ${ok ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
      <div className="text-[11px] uppercase tracking-wider text-stone-500">{label}</div>
      <div className="font-display text-xl font-bold">R {fmtD(r, 2)}</div>
      <div className="text-xs">cible {fmtD(target, 1)}</div>
    </div>
  );
}

function ElecPanel() {
  const { project, patchSettings, calc, updateRoom } = useStore();
  const s = project.settings.elec;
  const set = (p: Partial<ElecSettings>) => patchSettings("elec", { ...s, ...p });

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">NFC 15-100 — conseils par pièce</h2>
          <div className="flex flex-col items-end gap-1">
          <Toggle
            value={s.connected}
            onChange={(v) => set({ connected: v })}
            label="Préférer le connecté"
          />
          <button
            className="text-xs font-semibold text-terra"
            onClick={() => {
              calc.elec.forEach((e) =>
                updateRoom(e.room.floorId, e.room.id, {
                  elec: {
                    ...e.room.elec,
                    prisesConnected: s.connected,
                    interConnected: s.connected,
                    prisesConnectees: s.connected ? e.prises : 0,
                    intersConnectes: s.connected ? e.interrupteurs : 0,
                  },
                }),
              );
            }}
          >
            Appliquer prises + inters à toutes les pièces
          </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-stone-500">
          Les quantités suivent la norme (minimums + 1 prise / 4 m² au séjour). Vous pouvez forcer pièce par pièce.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Câble par prise">
            <Num value={s.cablePriseM} onChange={(n) => set({ cablePriseM: n })} suffix="m" />
          </Field>
          <Field label="Câble par point lumineux">
            <Num value={s.cableEclairageM} onChange={(n) => set({ cableEclairageM: n })} suffix="m" />
          </Field>
          <Field label="Marge gaines">
            <Num value={s.gaineMarge} onChange={(n) => set({ gaineMarge: n })} suffix="%" step={1} />
          </Field>
        </div>
      </Card>
      {calc.elec.map((e) => (
        <Card key={e.room.id}>
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="font-display text-lg font-bold">{e.room.name}</div>
              <div className="text-xs text-stone-500">
                {e.floorName} · {fmtD(e.area, 1)} m² · norme {e.prisesNorm} prises
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
            <Toggle
              value={e.room.elec.override}
              onChange={(v) =>
                updateRoom(e.room.floorId, e.room.id, {
                  elec: {
                    ...e.room.elec,
                    override: v,
                    prises: e.prises,
                    interrupteurs: e.interrupteurs,
                    vaEtVient: e.vaEtVient,
                    dcl: e.dcl,
                    rj45: e.rj45,
                    tv: e.tv,
                  },
                })
              }
              label="Forcer les quantités"
            />
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-paper-2 p-2">
              <label className="text-[10px] font-semibold text-stone-500">Prises connectées</label>
              <Num
                value={e.room.elec.prisesConnectees ?? 0}
                onChange={(n) =>
                  updateRoom(e.room.floorId, e.room.id, {
                    elec: { ...e.room.elec, prisesConnectees: Math.max(0, Math.round(n)), prisesConnected: n > 0 },
                  })
                }
                step={1}
              />
              <label className="text-[10px] font-semibold text-stone-500">Inter. connectés</label>
              <Num
                value={e.room.elec.intersConnectes ?? 0}
                onChange={(n) =>
                  updateRoom(e.room.floorId, e.room.id, {
                    elec: { ...e.room.elec, intersConnectes: Math.max(0, Math.round(n)), interConnected: n > 0 },
                  })
                }
                step={1}
              />
            </div>
            </div>
          </div>
          {e.room.elec.override ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ["prises", "Prises"],
                  ["interrupteurs", "Inter"],
                  ["vaEtVient", "Va-et-vient"],
                  ["dcl", "DCL"],
                  ["spots", "Spots"],
                  ["rj45", "RJ45"],
                  ["tv", "TV"],
                ] as const
              ).map(([k, lab]) => (
                <Field key={k} label={lab}>
                  <Num
                    value={e.room.elec[k]}
                    onChange={(n) => updateRoom(e.room.floorId, e.room.id, { elec: { ...e.room.elec, [k]: Math.max(0, Math.round(n)) } })}
                    step={1}
                  />
                </Field>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 text-sm">
              <Chip>{e.prises} prises</Chip>
              {e.interrupteurs > 0 && <Chip>{e.interrupteurs} inter</Chip>}
              {e.vaEtVient > 0 && <Chip>{e.vaEtVient} va-et-vient</Chip>}
              <Chip>{e.dcl} DCL</Chip>
              {e.rj45 > 0 && <Chip>{e.rj45} RJ45</Chip>}
              {e.tv > 0 && <Chip>{e.tv} TV</Chip>}
            </div>
          )}
          {e.specialised.length > 0 && (
            <div className="mt-2 text-xs text-stone-600">
              <strong>Spécialisés :</strong> {e.specialised.join(" · ")}
            </div>
          )}
          <ul className="mt-2 list-disc pl-5 text-xs text-stone-600">
            {e.placement.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          {e.notes.map((n) => (
            <div key={n} className="mt-1 flex gap-1 text-xs text-amber-800">
              <Info size={12} className="mt-0.5 shrink-0" /> {n}
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-paper-2 px-2.5 py-1 text-xs font-semibold">{children}</span>;
}

function SanitairePanel() {
  const { calc, setPage } = useStore();
  const nSdb = calc.perRoom.filter((r) => r.room.type === "sdb" || r.room.type === "sde").length;
  const nWc = calc.perRoom.filter((r) => r.room.type === "wc").length;
  const nCuis = calc.perRoom.filter((r) => r.room.type === "cuisine").length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="SDB / SDE" value={String(nSdb)} />
        <Stat label="WC séparés" value={String(nWc)} accent="navy" />
        <Stat label="Cuisines" value={String(nCuis)} accent="forest" />
      </div>
      <Card>
        <h2 className="font-display mb-2 text-lg font-bold">Réseaux & appareils</h2>
        <p className="text-sm text-stone-600">
          Diamètres PER/PVC, longueurs, taux de pertes, prix des tubes et appareils se règlent une seule fois dans
          <strong> Matériaux → Sanitaire</strong>.
        </p>
        <Btn variant="ghost" className="mt-3" onClick={() => setPage("materiaux")}>
          Ouvrir Matériaux — Sanitaire
        </Btn>
      </Card>
    </div>
  );
}

function VmcPanel() {
  const { project, patchSettings } = useStore();
  const s = project.settings.vmc;
  const set = (p: Partial<VmcSettings>) => patchSettings("vmc", { ...s, ...p });
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-display mb-3 text-lg font-bold">Type de VMC</h2>
        <div className="grid gap-2 md:grid-cols-3">
          {(
            [
              ["simple_hygro_b", "Simple flux hygro B", "Entrées d'air + extraction humides. Économique, compatible rénovation."],
              ["simple_autoreg", "Simple flux autoréglable", "Débits constants. Moins fin que l'hygro B."],
              ["double_flux", "Double flux", "Récupération de chaleur, idéal RE2020 et maison étanche."],
            ] as [VmcType, string, string][]
          ).map(([id, t, d]) => (
            <button
              key={id}
              onClick={() => set({ type: id })}
              className={`rounded-xl border p-3 text-left ${s.type === id ? "border-teal-700 bg-teal-50" : "border-rule"}`}
            >
              <div className="font-semibold">{t}</div>
              <div className="text-xs text-stone-500">{d}</div>
            </button>
          ))}
        </div>
        <Field label="Gaine par bouche" hint="Aller-retour + pertes">
          <div className="mt-2 w-40">
            <Num value={s.gaineMPerBouche} onChange={(n) => set({ gaineMPerBouche: n })} suffix="m" />
          </div>
        </Field>
        <img src="/images/vmc-schema.png" alt="Schéma VMC" className="mt-4 max-h-56 w-full rounded-xl object-cover" />
      </Card>
    </div>
  );
}

function ChauffagePanel() {
  const { project, calc, setPage } = useStore();
  const s = project.settings.chauffage;
  const c = calc.chauffage;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Surface PC" value={`${fmtD(c.surface, 1)} m²`} />
        <Stat label="Tube" value={`${fmtD(c.tubeM, 0)} m`} hint={`pas ${s.pasMm} mm`} accent="navy" />
        <Stat label="Boucles" value={String(c.loops)} hint={`max ${s.maxLoopM} m`} accent="forest" />
        <Stat label="Puissance estimée" value={`${fmtD(c.puissanceW / 1000, 1)} kW`} hint="55 W/m²" accent="gold" />
      </div>
      <Card>
        <h2 className="font-display mb-3 text-lg font-bold">Plancher chauffant</h2>
        <p className="text-sm text-stone-600">
          Pas de pose, diamètre du tube, longueur maximale par boucle et marge sont centralisés dans
          <strong> Matériaux → Chauffage</strong>. Les quantités ci-dessus utilisent ces réglages.
        </p>
        <p className="mt-2 text-xs text-stone-500">
          DTU 65.14 : pas plus serré près des baies, boucle ≤ 80–100 m en Ø16, épreuve 6 bar avant chape, T° surface ≤ 28 °C.
        </p>
        <img src="/images/plancher-chauffant.png" alt="Coupe PC" className="mt-4 max-h-52 w-full rounded-xl object-cover" />
      </Card>
      <Card>
        <h2 className="font-display mb-2 text-lg font-bold">Générateur & eau chaude sanitaire</h2>
        <p className="text-sm text-stone-600">
          Modèle, puissance, volume du ballon et prix s'éditent dans <strong>Matériaux → Chauffage</strong> (source
          unique des caractéristiques et du tarif PAC).
        </p>
        <Btn variant="ghost" className="mt-3" onClick={() => setPage("materiaux")}>
          Ouvrir Matériaux — Chauffage
        </Btn>
      </Card>
    </div>
  );
}

function PeinturePanel() {
  const { project, patchSettings, calc, updateRoom } = useStore();
  const s = project.settings.peinture;
  const set = (p: Partial<PeintureSettings>) => patchSettings("peinture", { ...s, ...p });
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-display mb-3 text-lg font-bold">Rendements & couches</h2>
        <div className="mb-3">
          <Toggle value={s.sousCouche} onChange={(v) => set({ sousCouche: v })} label="Sous-couche / impression placo" />
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Couches murs">
            <Num value={s.coatsWall} onChange={(n) => set({ coatsWall: n })} step={1} />
          </Field>
          <Field label="Couches plafond">
            <Num value={s.coatsCeiling} onChange={(n) => set({ coatsCeiling: n })} step={1} />
          </Field>
          <Field label="Couches sol">
            <Num value={s.coatsFloor} onChange={(n) => set({ coatsFloor: n })} step={1} />
          </Field>
        </div>
        <p className="mt-2 text-xs text-stone-500">
          Cette page règle uniquement le nombre de couches et les exceptions pièce par pièce. Contenance des pots,
          rendements, pertes et tarifs globaux sont dans <strong>Matériaux → Peinture</strong>.
        </p>
      </Card>
      <Card>
        <h2 className="font-display mb-3 text-lg font-bold">Par pièce — choix du produit</h2>
        <p className="mb-3 text-xs text-stone-500">
          Choisissez la peinture de chaque pièce dans le catalogue Matériaux (photo, litrage et m² couverts inclus).
          Les pots sont calculés par produit : deux références différentes ne se mélangent jamais.
        </p>
        <TableWrap>
          <thead>
            <tr>
              <Th>Pièce</Th>
              <Th>Murs</Th>
              <Th>Peinture murs</Th>
              <Th>Plafond</Th>
              <Th>Peinture plafond</Th>
              <Th>Total</Th>
            </tr>
          </thead>
          <tbody>
            {calc.perRoom.map((r) => (
              <tr key={r.room.id}>
                <Td>{r.room.name}</Td>
                <Td>{r.room.paintWalls ? `${fmtD(r.surfaces.wallsNet, 1)} m²` : "—"}</Td>
                <Td>
                  {r.room.paintWalls ? (
                    <PaintPicker
                      paints={s.paints ?? []}
                      value={r.room.paintWallId}
                      legacy={((r.room.prixPeintureMurPot ?? 0) > 0)}
                      onChange={(id) => updateRoom(r.room.floorId, r.room.id, { paintWallId: id })}
                    />
                  ) : (
                    "—"
                  )}
                </Td>
                <Td>{r.room.paintCeiling ? `${fmtD(r.surfaces.ceiling, 1)} m²` : "—"}</Td>
                <Td>
                  {r.room.paintCeiling ? (
                    <PaintPicker
                      paints={s.paints ?? []}
                      value={r.room.paintCeilId}
                      legacy={((r.room.prixPeinturePlafondPot ?? 0) > 0)}
                      onChange={(id) => updateRoom(r.room.floorId, r.room.id, { paintCeilId: id })}
                    />
                  ) : (
                    "—"
                  )}
                </Td>
                <Td className="font-semibold">{fmtD(r.paintM2, 1)} m²</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>
    </div>
  );
}

function CarrelagePanel() {
  const { project, calc, updateRoom } = useStore();
  const s = project.settings.carrelage;
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-display mb-2 text-lg font-bold">Produits & pose</h2>
        <p className="text-sm leading-relaxed text-stone-600">
          Formats par défaut, prix, colle, joints, natte, SPEC et pertes sont configurés uniquement dans
          <strong> Matériaux → Carrelage</strong>. Les champs du tableau ci-dessous sont des exceptions propres à une pièce,
          à utiliser seulement si elle reçoit un autre produit.
        </p>
        <img src="/images/carrelage-coupe.png" alt="Coupe carrelage" className="mt-4 max-h-48 w-full rounded-xl object-cover" />
      </Card>
      <Card>
        <h2 className="font-display mb-3 text-lg font-bold">Par pièce — choix du produit</h2>
        <p className="mb-3 text-xs text-stone-500">
          Choisissez le carrelage de sol et la faïence murale de chaque pièce dans le catalogue Matériaux (photo,
          format et prix inclus). Chaque référence donne une ligne séparée dans la liste de courses, avec le bon nombre
          de dalles.
        </p>
        <TableWrap>
          <thead>
            <tr>
              <Th>Pièce</Th>
              <Th>Sol</Th>
              <Th>Carrelage sol</Th>
              <Th>Faïence</Th>
              <Th>Faïence murale</Th>
              <Th>Total</Th>
            </tr>
          </thead>
          <tbody>
            {calc.perRoom.map((r) => (
              <tr key={r.room.id}>
                <Td>{r.room.name}</Td>
                <Td>{r.room.tileFloor ? `${fmtD(r.surfaces.floor, 1)} m²` : "—"}</Td>
                <Td>
                  {r.room.tileFloor ? (
                    <TilePicker
                      tiles={s.tiles ?? []}
                      value={r.room.tileSolId}
                      legacy={((r.room.prixCarrelageM2 ?? 0) > 0 || (r.room.carreauL ?? 0) > 0)}
                      onChange={(id: string) => updateRoom(r.room.floorId, r.room.id, { tileSolId: id })}
                    />
                  ) : (
                    "—"
                  )}
                </Td>
                <Td>
                  {r.room.tileWalls
                    ? `${fmtD(Math.max(0, r.surfaces.perimeter * r.room.tileWallHeight - r.surfaces.openingsSingle), 1)} m²`
                    : "—"}
                </Td>
                <Td>
                  {r.room.tileWalls ? (
                    <TilePicker
                      tiles={s.tiles ?? []}
                      value={r.room.tileMurId}
                      legacy={((r.room.prixFaienceM2 ?? 0) > 0 || (r.room.faienceL ?? 0) > 0)}
                      onChange={(id: string) => updateRoom(r.room.floorId, r.room.id, { tileMurId: id })}
                    />
                  ) : (
                    "—"
                  )}
                </Td>
                <Td className="font-semibold">{fmtD(r.tileM2, 1)} m²</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>
    </div>
  );
}

function TilePicker({
  tiles,
  value,
  legacy,
  onChange,
}: {
  tiles: TileProduct[];
  value?: string;
  legacy: boolean;
  onChange: (id: string) => void;
}) {
  const current = tiles.find((t) => t.id === value) ?? tiles[0];
  return (
    <div className="min-w-[190px]">
      <div className="flex items-center gap-2">
        {current?.photo ? (
          <img src={current.photo} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-rule object-cover" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-rule bg-paper text-[9px] text-stone-400">
            Visuel
          </div>
        )}
        <Select value={current?.id ?? ""} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1">
          {legacy && !value && <option value="">Ancien réglage (choisir…)</option>}
          {tiles.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} — {Math.round(t.tileL * 100)}×{Math.round(t.tileW * 100)} cm · {fmtE(t.priceM2)}/m²
            </option>
          ))}
        </Select>
      </div>
      {current && (
        <div className="mt-1 text-[10px] text-stone-400">
          {Math.round(current.tileL * 100)}×{Math.round(current.tileW * 100)} cm · {fmtE(current.priceM2)}/m²
          {current.link && (
            <>
              {" · "}
              <a href={current.link} target="_blank" rel="noreferrer" className="text-forest underline">
                Acheter
              </a>
            </>
          )}
        </div>
      )}
      {legacy && !value && (
        <div className="mt-1 text-[10px] text-amber-700">Ancien prix/format conservé — choisissez un produit pour le remplacer.</div>
      )}
    </div>
  );
}

function PaintPicker({
  paints,
  value,
  legacy,
  onChange,
}: {
  paints: PaintProduct[];
  value?: string;
  legacy: boolean;
  onChange: (id: string) => void;
}) {
  const current = paints.find((p) => p.id === value) ?? paints[0];
  return (
    <div className="min-w-[190px]">
      <div className="flex items-center gap-2">
        {current?.photo ? (
          <img src={current.photo} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-rule object-cover" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-rule bg-paper text-[9px] text-stone-400">
            Visuel
          </div>
        )}
        <Select value={current?.id ?? ""} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1">
          {legacy && !value && <option value="">Ancien réglage (choisir…)</option>}
          {paints.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.potL} L (≈ {Math.round(p.potL * p.yieldM2L)} m²) · {fmtE(p.pricePot)}
            </option>
          ))}
        </Select>
      </div>
      {current && (
        <div className="mt-1 text-[10px] text-stone-400">
          Pot {current.potL} L · {current.yieldM2L} m²/L (≈ {Math.round(current.potL * current.yieldM2L)} m²/pot) ·{" "}
          {fmtE(current.pricePot)}
          {current.link && (
            <>
              {" · "}
              <a href={current.link} target="_blank" rel="noreferrer" className="text-forest underline">
                Acheter
              </a>
            </>
          )}
        </div>
      )}
      {legacy && !value && (
        <div className="mt-1 text-[10px] text-amber-700">Ancien prix conservé — choisissez un produit pour le remplacer.</div>
      )}
    </div>
  );
}

function QuincPanel() {
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-display mb-3 text-lg font-bold">Portes & plinthes</h2>
        <p className="text-sm leading-relaxed text-stone-600">
          Largeur des portes, format des plinthes, marge, prix et liens d'achat sont centralisés dans
          <strong> Matériaux → Quincaillerie</strong>. Les quantités restent calculées ici d'après les cloisons et le
          périmètre des pièces.
        </p>
      </Card>
    </div>
  );
}
