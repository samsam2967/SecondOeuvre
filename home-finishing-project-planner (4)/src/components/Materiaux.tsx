import { ExternalLink, ImagePlus, Link2, Plus, Trash2 } from "lucide-react";
import { PLAQUE_INFO, POSTS } from "../data/catalogs";
import { getPriceLabels } from "../data/priceLabels";
import { useStore } from "../store";
import type { IsolantProduct, PaintProduct, PostId, TileProduct } from "../types";
import { rValue } from "../data/catalogs";
import { fmtD, fmtE } from "../utils/format";
import { uid } from "../utils/id";
import { fileToPhoto } from "../utils/image";
import { Btn, Card, Field, H, Input, Num, TableWrap, Td, Th, Toggle } from "./ui";
import { useState } from "react";

const POST_KEY: Record<PostId, "placo" | "isolation" | "elec" | "sanitaire" | "vmc" | "chauffage" | "peinture" | "carrelage" | "quincaillerie"> = {
  placo: "placo",
  isolation: "isolation",
  electricite: "elec",
  sanitaire: "sanitaire",
  vmc: "vmc",
  chauffage: "chauffage",
  peinture: "peinture",
  carrelage: "carrelage",
  quincaillerie: "quincaillerie",
};

/** Prix gérés dans les catalogues produits (pas dans la grille des prix globaux). */
const CATALOG_PRICES: Partial<Record<PostId, string[]>> = {
  carrelage: ["carreau_m2"],
  peinture: ["peinture_mur_10l", "peinture_plafond_10l", "peinture_sol_10l"],
};

export function Materiaux() {
  const { project, setSettings, patchSettings } = useStore();
  const [post, setPost] = useState<PostId | "isolants">("placo");
  const S = project.settings;

  return (
    <div>
      <H
        kicker="Catalogue"
        title="Matériaux — produits, tailles & prix"
        sub="Chaque produit (carrelage, peinture, isolant…) se définit une seule fois ici, avec sa photo, ses dimensions et son prix. Dans les onglets Sol et Peinture, vous choisissez simplement le produit par pièce : plus aucun doublon."
      />

      <Card className="mb-4">
        <h2 className="font-display mb-1 text-lg font-bold">Pertes & marges par poste</h2>
        <p className="mb-3 text-xs text-stone-500">
          <strong>Pertes</strong> : chutes et casse ajoutées aux quantités. <strong>Marge</strong> : sécurité
          financière ajoutée au coût du poste (imprévus, hausses de prix).
        </p>
        <TableWrap>
          <thead>
            <tr>
              <Th>Poste</Th>
              <Th>Pertes %</Th>
              <Th>Marge %</Th>
            </tr>
          </thead>
          <tbody>
            {POSTS.map((p) => {
              const key = POST_KEY[p.id];
              const block = S[key] as { wastePct: number; marginPct: number };
              return (
                <tr key={p.id}>
                  <Td>{p.label}</Td>
                  <Td>
                    <div className="w-24">
                      <Num
                        value={block.wastePct ?? 0}
                        onChange={(n) => patchSettings(key, { ...block, wastePct: Math.max(0, n) } as never)}
                        suffix="%"
                        step={1}
                      />
                    </div>
                  </Td>
                  <Td>
                    <div className="w-24">
                      <Num
                        value={block.marginPct ?? 0}
                        onChange={(n) => patchSettings(key, { ...block, marginPct: Math.max(0, n) } as never)}
                        suffix="%"
                        step={1}
                      />
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      </Card>

      <div className="mb-4 flex flex-wrap gap-2">
        {POSTS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPost(p.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${post === p.id ? "bg-ink text-paper" : "border border-rule"}`}
          >
            {p.short}
          </button>
        ))}
        <button
          onClick={() => setPost("isolants")}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold ${post === "isolants" ? "bg-ink text-paper" : "border border-rule"}`}
        >
          Isolants (R)
        </button>
      </div>

      {post === "isolants" ? (
        <IsolantsTable
          items={S.isolants}
          onChange={(isolants) => setSettings({ ...S, isolants })}
        />
      ) : (
        <>
          {post === "placo" && (
            <Card className="mb-4">
              <h2 className="font-display mb-3 text-lg font-bold">Formats, calepinage & consommables placo</h2>
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Longueur plaque"><Num value={S.placo.plaqueL} onChange={(n) => patchSettings("placo", { ...S.placo, plaqueL: n })} suffix="m" /></Field>
                <Field label="Largeur plaque"><Num value={S.placo.plaqueW} onChange={(n) => patchSettings("placo", { ...S.placo, plaqueW: n })} suffix="m" /></Field>
                <Field label="Longueur rail"><Num value={S.placo.railLength} onChange={(n) => patchSettings("placo", { ...S.placo, railLength: n })} suffix="m" /></Field>
                <Field label="Longueur montant"><Num value={S.placo.montantLength} onChange={(n) => patchSettings("placo", { ...S.placo, montantLength: n })} suffix="m" /></Field>
                <Field label="Longueur fourrure"><Num value={S.placo.fourrureLength} onChange={(n) => patchSettings("placo", { ...S.placo, fourrureLength: n })} suffix="m" /></Field>
                <Field label="Vis longueur"><Num value={S.placo.visMm} onChange={(n) => patchSettings("placo", { ...S.placo, visMm: n })} suffix="mm" step={1} /></Field>
                <Field label="Bande largeur"><Num value={S.placo.bandeWidthMm} onChange={(n) => patchSettings("placo", { ...S.placo, bandeWidthMm: n })} suffix="mm" step={1} /></Field>
                <Field label="Entraxe montants"><Num value={S.placo.montantSpacing} onChange={(n) => patchSettings("placo", { ...S.placo, montantSpacing: n })} suffix="m" /></Field>
                <Field label="Vis placo / m²"><Num value={S.placo.visPerM2} onChange={(n) => patchSettings("placo", { ...S.placo, visPerM2: n })} suffix="vis" step={1} /></Field>
                <Field label="Bande à joint / m²"><Num value={S.placo.bandePerM2} onChange={(n) => patchSettings("placo", { ...S.placo, bandePerM2: n })} suffix="m" step={0.1} /></Field>
                <Field label="Enduit joint / m²"><Num value={S.placo.enduitJointKgM2} onChange={(n) => patchSettings("placo", { ...S.placo, enduitJointKgM2: n })} suffix="kg" step={0.05} /></Field>
                <Field label="Enduit finition / m²"><Num value={S.placo.enduitFinitionKgM2} onChange={(n) => patchSettings("placo", { ...S.placo, enduitFinitionKgM2: n })} suffix="kg" step={0.1} /></Field>
              </div>
              <div className="mt-4">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  Taille par type de plaque
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(Object.keys(PLAQUE_INFO) as (keyof typeof PLAQUE_INFO)[]).map((t) => {
                    const sz = S.placo.plaqueSizes?.[t] ?? { l: S.placo.plaqueL, w: S.placo.plaqueW };
                    const setSize = (patch: Partial<{ l: number; w: number }>) =>
                      patchSettings("placo", {
                        ...S.placo,
                        plaqueSizes: { ...S.placo.plaqueSizes, [t]: { ...sz, ...patch } },
                      });
                    return (
                      <div key={t} className="rounded-lg border border-rule bg-white/70 p-2">
                        <div className="mb-1 text-[11px] font-semibold text-ink">{PLAQUE_INFO[t].label}</div>
                        <div className="flex items-center gap-1.5">
                          <Num value={sz.l} onChange={(n) => setSize({ l: n })} suffix="m" step={0.1} />
                          <span className="text-xs text-stone-400">×</span>
                          <Num value={sz.w} onChange={(n) => setSize({ w: n })} suffix="m" step={0.1} />
                        </div>
                        <div className="mt-1 text-[10px] text-stone-400">{fmtD(sz.l * sz.w, 2)} m² / plaque</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          )}
          {post === "electricite" && (
            <Card className="mb-4">
              <h2 className="font-display mb-3 text-lg font-bold">Sections & diamètres élec</h2>
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Section éclairage"><Num value={S.elec.cable15} onChange={(n) => patchSettings("elec", { ...S.elec, cable15: n })} suffix="mm²" /></Field>
                <Field label="Section prises"><Num value={S.elec.cable25} onChange={(n) => patchSettings("elec", { ...S.elec, cable25: n })} suffix="mm²" /></Field>
                <Field label="Section plaque"><Num value={S.elec.cable6} onChange={(n) => patchSettings("elec", { ...S.elec, cable6: n })} suffix="mm²" /></Field>
                <Field label="Gaine éclairage"><Num value={S.elec.gaineEclairageMm} onChange={(n) => patchSettings("elec", { ...S.elec, gaineEclairageMm: n })} suffix="mm" step={1} /></Field>
                <Field label="Gaine prises"><Num value={S.elec.gainePriseMm} onChange={(n) => patchSettings("elec", { ...S.elec, gainePriseMm: n })} suffix="mm" step={1} /></Field>
                <Field label="Gaine spécialisés"><Num value={S.elec.gaineSpeMm} onChange={(n) => patchSettings("elec", { ...S.elec, gaineSpeMm: n })} suffix="mm" step={1} /></Field>
                <Field label="Boîte Ø"><Num value={S.elec.boiteDiamMm} onChange={(n) => patchSettings("elec", { ...S.elec, boiteDiamMm: n })} suffix="mm" step={1} /></Field>
              </div>
            </Card>
          )}
          {post === "sanitaire" && (
            <Card className="mb-4">
              <h2 className="font-display mb-3 text-lg font-bold">Diamètres plomberie</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Ø PER"><Num value={S.sanitaire.perDiameter} onChange={(n) => patchSettings("sanitaire", { ...S.sanitaire, perDiameter: n })} suffix="mm" step={1} /></Field>
                <Field label="Tube par point d'eau"><Num value={S.sanitaire.tubePerPointM} onChange={(n) => patchSettings("sanitaire", { ...S.sanitaire, tubePerPointM: n })} suffix="m" /></Field>
              </div>
            </Card>
          )}
          {post === "chauffage" && (
            <Card className="mb-4">
              <h2 className="font-display mb-3 text-lg font-bold">Plancher chauffant, PAC & ballon</h2>
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Pas"><Num value={S.chauffage.pasMm} onChange={(n) => patchSettings("chauffage", { ...S.chauffage, pasMm: n })} suffix="mm" step={5} /></Field>
                <Field label="Ø tube"><Num value={S.chauffage.tubeDiameter} onChange={(n) => patchSettings("chauffage", { ...S.chauffage, tubeDiameter: n })} suffix="mm" step={1} /></Field>
                <Field label="Max / boucle"><Num value={S.chauffage.maxLoopM} onChange={(n) => patchSettings("chauffage", { ...S.chauffage, maxLoopM: n })} suffix="m" /></Field>
                <Field label="Puissance PAC"><Num value={S.chauffage.pacPuissanceKw} onChange={(n) => patchSettings("chauffage", { ...S.chauffage, pacPuissanceKw: n })} suffix="kW" /></Field>
                <Field label="Volume ballon ECS"><Num value={S.chauffage.ballonL} onChange={(n) => patchSettings("chauffage", { ...S.chauffage, ballonL: n })} suffix="L" step={10} /></Field>
              </div>
            </Card>
          )}
          {post === "peinture" && (
            <Card className="mb-4">
              <h2 className="font-display mb-1 text-lg font-bold">Peintures du catalogue</h2>
              <p className="mb-3 text-xs text-stone-500">
                Chaque peinture = 1 pot (litrage) + 1 rendement (m²/L) + 1 prix + 1 photo. Le nombre de m² couverts par
                pot se calcule tout seul. Dans l'onglet Peinture, chaque pièce choisit sa peinture murs et plafond.
              </p>
              <PaintsManager
                items={S.peinture.paints ?? []}
                onChange={(paints) => patchSettings("peinture", { ...S.peinture, paints })}
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Field label="Pot sous-couche (L)"><Num value={S.peinture.primerPotL} onChange={(n) => patchSettings("peinture", { ...S.peinture, primerPotL: n })} suffix="L" /></Field>
                <Field label="Rendement sous-couche (m²/L)"><Num value={S.peinture.yieldPrimer} onChange={(n) => patchSettings("peinture", { ...S.peinture, yieldPrimer: n })} suffix="m²/L" /></Field>
              </div>
            </Card>
          )}
          {post === "carrelage" && (
            <Card className="mb-4">
              <h2 className="font-display mb-1 text-lg font-bold">Carrelages & faïences du catalogue</h2>
              <p className="mb-3 text-xs text-stone-500">
                Chaque produit = 1 format + 1 prix au m² + 1 photo. Dans l'onglet Sol, chaque pièce choisit son
                carrelage de sol et sa faïence murale : le nombre de dalles et le coût suivent automatiquement.
              </p>
              <TilesManager
                items={S.carrelage.tiles ?? []}
                onChange={(tiles) => patchSettings("carrelage", { ...S.carrelage, tiles })}
              />
              <div className="mt-4">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">Pose (commun à tous les carrelages)</h3>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field label="Joint"><Num value={S.carrelage.jointMm} onChange={(n) => patchSettings("carrelage", { ...S.carrelage, jointMm: n })} suffix="mm" /></Field>
                  <Field label="Natte L"><Num value={S.carrelage.natteL} onChange={(n) => patchSettings("carrelage", { ...S.carrelage, natteL: n })} suffix="m" /></Field>
                  <Field label="Natte l"><Num value={S.carrelage.natteW} onChange={(n) => patchSettings("carrelage", { ...S.carrelage, natteW: n })} suffix="m" /></Field>
                  <Field label="Colle kg/m²"><Num value={S.carrelage.colleKgM2} onChange={(n) => patchSettings("carrelage", { ...S.carrelage, colleKgM2: n })} /></Field>
                  <Field label="Joint kg/m²"><Num value={S.carrelage.jointKgM2} onChange={(n) => patchSettings("carrelage", { ...S.carrelage, jointKgM2: n })} /></Field>
                  <Field label="Primaire L/m²"><Num value={S.carrelage.primaireLperM2} onChange={(n) => patchSettings("carrelage", { ...S.carrelage, primaireLperM2: n })} step={0.01} /></Field>
                </div>
                <div className="mt-3 flex flex-wrap gap-4">
                  <Toggle value={S.carrelage.natte} onChange={(v) => patchSettings("carrelage", { ...S.carrelage, natte: v })} label="Natte de désolidarisation prévue" />
                  <Toggle value={S.carrelage.spec} onChange={(v) => patchSettings("carrelage", { ...S.carrelage, spec: v })} label="Kit SPEC pièces humides prévu" />
                </div>
              </div>
            </Card>
          )}
          {post === "quincaillerie" && (
            <Card className="mb-4">
              <h2 className="font-display mb-3 text-lg font-bold">Portes & plinthes</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Largeur porte"><Num value={S.quincaillerie.porteWidth} onChange={(n) => patchSettings("quincaillerie", { ...S.quincaillerie, porteWidth: n })} suffix="m" /></Field>
                <Field label="Hauteur plinthe"><Num value={S.quincaillerie.plintheH} onChange={(n) => patchSettings("quincaillerie", { ...S.quincaillerie, plintheH: n })} suffix="mm" step={1} /></Field>
                <Field label="Barre plinthe"><Num value={S.quincaillerie.plintheL} onChange={(n) => patchSettings("quincaillerie", { ...S.quincaillerie, plintheL: n })} suffix="m" /></Field>
              </div>
            </Card>
          )}
          {post === "isolation" && (
            <Card className="mb-4">
              <h2 className="font-display mb-3 text-lg font-bold">Système appuis / GTL</h2>
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Entraxe appuis H"><Num value={S.isolation.appuisHSpacing} onChange={(n) => patchSettings("isolation", { ...S.isolation, appuisHSpacing: n })} suffix="m" /></Field>
                <Field label="Entraxe appuis V"><Num value={S.isolation.appuisVSpacing} onChange={(n) => patchSettings("isolation", { ...S.isolation, appuisVSpacing: n })} suffix="m" /></Field>
                <Field label="Entraxe montants"><Num value={S.isolation.montantSpacing} onChange={(n) => patchSettings("isolation", { ...S.isolation, montantSpacing: n })} suffix="m" step={0.05} /></Field>
                <Field label="GTL"><Num value={S.isolation.gtlMm} onChange={(n) => patchSettings("isolation", { ...S.isolation, gtlMm: n })} suffix="mm" step={1} /></Field>
                <Field label="Longueur montant"><Num value={S.isolation.railLength} onChange={(n) => patchSettings("isolation", { ...S.isolation, railLength: n })} suffix="m" /></Field>
              </div>
            </Card>
          )}
          <Card>
            <h2 className="font-display mb-3 text-lg font-bold">Prix unitaires — {POSTS.find((p) => p.id === post)?.label}</h2>
            <p className="mb-3 text-xs text-stone-500">
              Les prix des produits du catalogue (carrelages, peintures) se règlent dans leurs fiches ci-dessus, pas
              ici. Chaque libellé indique l'unité exacte du prix.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(getPriceLabels(S)[post])
                .filter(([k]) => !(CATALOG_PRICES[post] ?? []).includes(k))
                .map(([k, lab]) => {
                  const key = POST_KEY[post];
                  const block = S[key] as { prices: Record<string, number> };
                  const linkKey = `mat:${post}:${k}`;
                  const link = S.productLinks?.[linkKey] ?? "";
                  return (
                    <div key={k} className="rounded-lg border border-rule bg-white/60 p-2.5">
                      <Field label={lab}>
                        <div className="flex items-center gap-1.5">
                          <Num
                            value={block.prices[k] ?? 0}
                            onChange={(n) =>
                              patchSettings(key, { ...block, prices: { ...block.prices, [k]: n } } as never)
                            }
                            step={0.1}
                            suffix="€"
                          />
                          {link && (
                            <a
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              title={link}
                              className="shrink-0 rounded-lg bg-emerald-50 p-2 text-forest hover:bg-emerald-100"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                        </div>
                      </Field>
                      <div className="mt-1.5 flex items-center gap-1">
                        <Link2 size={11} className={link ? "shrink-0 text-forest" : "shrink-0 text-stone-300"} />
                        <input
                          value={link}
                          onChange={(e) => {
                            const url = e.target.value.trim();
                            const next = { ...S.productLinks };
                            if (url) next[linkKey] = url;
                            else delete next[linkKey];
                            setSettings({ ...S, productLinks: next });
                          }}
                          onBlur={(e) => {
                            const url = e.target.value.trim();
                            if (url && !/^https?:\/\//i.test(url)) {
                              setSettings({ ...S, productLinks: { ...S.productLinks, [linkKey]: `https://${url}` } });
                            }
                          }}
                          placeholder="Lien d'achat (https://…)"
                          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 font-mono text-[10px] text-stone-500 placeholder:text-stone-300 hover:border-rule focus:border-rule focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function PhotoField({ photo, onChange }: { photo?: string; onChange: (photo?: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-2">
      {photo ? (
        <img src={photo} alt="Produit" className="h-14 w-14 shrink-0 rounded-lg border border-rule object-cover" />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-rule bg-paper text-[10px] text-stone-400">
          Photo
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-rule px-2 py-1 text-[11px] font-semibold hover:bg-paper-2">
          <ImagePlus size={12} /> {busy ? "…" : photo ? "Changer" : "Ajouter"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              try {
                onChange(await fileToPhoto(f));
              } catch {
                /* image illisible */
              } finally {
                setBusy(false);
                e.target.value = "";
              }
            }}
          />
        </label>
        {photo && (
          <button onClick={() => onChange(undefined)} className="text-[11px] text-stone-400 hover:text-red-700">
            Retirer
          </button>
        )}
      </div>
    </div>
  );
}

function TilesManager({ items, onChange }: { items: TileProduct[]; onChange: (t: TileProduct[]) => void }) {
  return (
    <div className="space-y-2">
      {items.map((t) => (
        <div key={t.id} className="grid gap-3 rounded-xl border border-rule bg-white/70 p-3 md:grid-cols-[88px_1fr]">
          <PhotoField photo={t.photo} onChange={(photo) => onChange(items.map((x) => (x.id === t.id ? { ...x, photo } : x)))} />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Référence">
              <Input value={t.name} onChange={(e) => onChange(items.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)))} />
            </Field>
            <Field label="Longueur (cm)">
              <Num value={Math.round(t.tileL * 100)} onChange={(n) => onChange(items.map((x) => (x.id === t.id ? { ...x, tileL: Math.max(0.05, n) / 100 } : x)))} step={5} />
            </Field>
            <Field label="Largeur (cm)">
              <Num value={Math.round(t.tileW * 100)} onChange={(n) => onChange(items.map((x) => (x.id === t.id ? { ...x, tileW: Math.max(0.05, n) / 100 } : x)))} step={5} />
            </Field>
            <Field label="Prix au m² (€)">
              <Num value={t.priceM2} onChange={(n) => onChange(items.map((x) => (x.id === t.id ? { ...x, priceM2: Math.max(0, n) } : x)))} suffix="€" step={0.5} />
            </Field>
            <Field label="Lien d'achat">
              <Input value={t.link ?? ""} onChange={(e) => onChange(items.map((x) => (x.id === t.id ? { ...x, link: e.target.value } : x)))} placeholder="https://…" />
            </Field>
            <Field label="Note">
              <Input value={t.notes ?? ""} onChange={(e) => onChange(items.map((x) => (x.id === t.id ? { ...x, notes: e.target.value } : x)))} placeholder="Sol séjour…" />
            </Field>
            <div className="flex items-end justify-between sm:col-span-2 lg:col-span-4">
              <span className="text-[11px] text-stone-400">
                {fmtD(t.tileL * t.tileW, 3)} m² / dalle · {fmtE(t.priceM2 * t.tileL * t.tileW)} / dalle
              </span>
              <button onClick={() => onChange(items.filter((x) => x.id !== t.id))} className="inline-flex items-center gap-1 text-xs text-red-700">
                <Trash2 size={13} /> Supprimer
              </button>
            </div>
          </div>
        </div>
      ))}
      <Btn
        variant="forest"
        onClick={() => onChange([...items, { id: uid(), name: "Nouveau carrelage", tileL: 0.6, tileW: 0.6, priceM2: 24 }])}
      >
        <Plus size={14} /> Ajouter un carrelage
      </Btn>
    </div>
  );
}

function PaintsManager({ items, onChange }: { items: PaintProduct[]; onChange: (p: PaintProduct[]) => void }) {
  return (
    <div className="space-y-2">
      {items.map((p) => (
        <div key={p.id} className="grid gap-3 rounded-xl border border-rule bg-white/70 p-3 md:grid-cols-[88px_1fr]">
          <PhotoField photo={p.photo} onChange={(photo) => onChange(items.map((x) => (x.id === p.id ? { ...x, photo } : x)))} />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Référence">
              <Input value={p.name} onChange={(e) => onChange(items.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))} />
            </Field>
            <Field label="Pot (L)">
              <Num value={p.potL} onChange={(n) => onChange(items.map((x) => (x.id === p.id ? { ...x, potL: Math.max(0.5, n) } : x)))} suffix="L" step={0.5} />
            </Field>
            <Field label="Rendement (m²/L)">
              <Num value={p.yieldM2L} onChange={(n) => onChange(items.map((x) => (x.id === p.id ? { ...x, yieldM2L: Math.max(0.5, n) } : x)))} suffix="m²/L" step={0.5} />
            </Field>
            <Field label="Prix du pot (€)">
              <Num value={p.pricePot} onChange={(n) => onChange(items.map((x) => (x.id === p.id ? { ...x, pricePot: Math.max(0, n) } : x)))} suffix="€" step={0.5} />
            </Field>
            <Field label="Usage">
              <select
                value={p.usage}
                onChange={(e) => onChange(items.map((x) => (x.id === p.id ? { ...x, usage: e.target.value as PaintProduct["usage"] } : x)))}
                className="w-full rounded-xl border border-rule bg-white/70 px-3 py-2 text-sm outline-none focus:border-terra"
              >
                <option value="universel">Universel</option>
                <option value="mur">Murs</option>
                <option value="plafond">Plafond</option>
                <option value="sol">Sol</option>
                <option value="sous-couche">Sous-couche</option>
              </select>
            </Field>
            <Field label="Lien d'achat">
              <Input value={p.link ?? ""} onChange={(e) => onChange(items.map((x) => (x.id === p.id ? { ...x, link: e.target.value } : x)))} placeholder="https://…" />
            </Field>
            <div className="flex items-end justify-between sm:col-span-2 lg:col-span-4">
              <span className="text-[11px] text-stone-400">
                ≈ {Math.round(p.potL * p.yieldM2L)} m² couverts par pot · {fmtE(p.pricePot / Math.max(0.01, p.potL * p.yieldM2L))}/m²
              </span>
              <button onClick={() => onChange(items.filter((x) => x.id !== p.id))} className="inline-flex items-center gap-1 text-xs text-red-700">
                <Trash2 size={13} /> Supprimer
              </button>
            </div>
          </div>
        </div>
      ))}
      <Btn
        variant="forest"
        onClick={() => onChange([...items, { id: uid(), name: "Nouvelle peinture", potL: 10, yieldM2L: 11, pricePot: 49, usage: "universel" as const }])}
      >
        <Plus size={14} /> Ajouter une peinture
      </Btn>
    </div>
  );
}

function IsolantsTable({ items, onChange }: { items: IsolantProduct[]; onChange: (i: IsolantProduct[]) => void }) {
  return (
    <Card>
      <div className="mb-3 flex justify-between">
        <h2 className="font-display text-lg font-bold">Panneaux d'isolant</h2>
        <Btn
          variant="forest"
          onClick={() =>
            onChange([
              ...items,
              {
                id: uid(),
                name: "Nouvel isolant",
                family: "autre",
                lambda: 0.038,
                thickness: 100,
                panelL: 1.35,
                panelW: 0.6,
                priceM2: 12,
                usages: ["mur"],
                bio: false,
                notes: "",
              },
            ])
          }
        >
          Ajouter
        </Btn>
      </div>
      <TableWrap>
        <thead>
          <tr>
            <Th>Nom</Th>
            <Th>λ</Th>
            <Th>Ép. mm</Th>
            <Th>Panneau L</Th>
            <Th>Panneau l</Th>
            <Th>€/m²</Th>
            <Th>R</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={it.id}>
              <Td>
                <Input value={it.name} onChange={(e) => onChange(items.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))} />
              </Td>
              <Td>
                <Num value={it.lambda} onChange={(n) => onChange(items.map((x, i) => (i === idx ? { ...x, lambda: n } : x)))} step={0.001} />
              </Td>
              <Td>
                <Num value={it.thickness} onChange={(n) => onChange(items.map((x, i) => (i === idx ? { ...x, thickness: n } : x)))} step={1} />
              </Td>
              <Td>
                <Num value={it.panelL} onChange={(n) => onChange(items.map((x, i) => (i === idx ? { ...x, panelL: n } : x)))} />
              </Td>
              <Td>
                <Num value={it.panelW} onChange={(n) => onChange(items.map((x, i) => (i === idx ? { ...x, panelW: n } : x)))} />
              </Td>
              <Td>
                <Num value={it.priceM2} onChange={(n) => onChange(items.map((x, i) => (i === idx ? { ...x, priceM2: n } : x)))} suffix="€" />
              </Td>
              <Td className="font-mono">{fmtD(rValue(it.lambda, it.thickness), 2)}</Td>
              <Td>
                <button className="text-xs text-red-700" onClick={() => onChange(items.filter((_, i) => i !== idx))}>
                  ×
                </button>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </Card>
  );
}
