import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import { POSTS } from "../data/catalogs";
import { TUTORIALS, type Tutorial } from "../data/tutorials";
import { useStore } from "../store";
import { browserImageLoader, buildPostPdf, buildTutorialPdf } from "../utils/pdfDocs";
import { glossaryFor } from "../data/glossary";
import { fmtDays, projectQuantities, tutorialEstimate } from "../utils/durations";
import { FicheDiagram } from "./FicheDiagram";
import { Card, H } from "./ui";

export function Tutorials() {
  const { setPage, project, tutoOpen, openTutorial } = useStore();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [post, setPost] = useState<string>("all");
  const [open, setOpen] = useState<string | null>(TUTORIALS[0]?.id ?? null);
  const [q, setQ] = useState("");
  const [oneBusy, setOneBusy] = useState(false);
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const list = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    return TUTORIALS.filter((t) => {
      if (post !== "all" && t.post !== post) return false;
      if (!words.length) return true;
      const hay = norm([t.title, t.duration, ...(t.memo ?? []), ...t.tools, ...t.norms, ...t.steps.flatMap((s) => [s.title, s.body, s.tip ?? "", s.warn ?? ""])].join(" "));
      const tokens = hay.split(/[^a-z0-9]+/);
      return words.every((w) => tokens.some((tk) => tk.startsWith(w)));
    });
  }, [post, q]);
  // Arrivée depuis un poste : on ouvre exactement la fiche demandée (et on retire les filtres qui la cacheraient)
  useEffect(() => {
    if (!tutoOpen) return;
    const target = TUTORIALS.find((t) => t.id === tutoOpen);
    if (target) {
      setOpen(target.id);
      setPost("all");
      setQ("");
      document.getElementById("fiche-detail")?.scrollIntoView({ block: "start" });
    }
    openTutorial(null);
  }, [tutoOpen, openTutorial]);
  const current = TUTORIALS.find((t) => t.id === open && list.includes(t)) ?? (open && !list.some((t) => t.id === open) ? list[0] : undefined) ?? list[0];
  const printOne = async (t: Tutorial) => {
    setOneBusy(true);
    try {
      const doc = await buildTutorialPdf(project, t.id, browserImageLoader);
      doc?.save(`fiche-${t.id}.pdf`);
    } finally {
      setOneBusy(false);
    }
  };

  return (
    <div>
      <H
        kicker="Savoir-faire"
        title="Tutoriels de pose"
        sub="Pas à pas, schémas, outils, normes et vidéos — pour chaque geste du second œuvre."
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          disabled={pdfBusy}
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
          onClick={async () => {
            setPdfBusy(true);
            try {
              const key = post === "all" ? "all" : (post as never);
              const doc = await buildPostPdf(project, key, browserImageLoader);
              doc.save(post === "all" ? "normes-et-tutoriels-tous-postes.pdf" : `normes-et-tutoriels-${post}.pdf`);
            } finally {
              setPdfBusy(false);
            }
          }}
        >
          {pdfBusy ? "Création du PDF…" : post === "all" ? "PDF imprimable : tous les postes" : "PDF imprimable : ce poste (normes + tutoriels)"}
        </button>
        <span className="text-xs text-stone-500">Choisissez un poste ci-dessous pour n'imprimer que celui-ci.</span>
      </div>
      <button
        onClick={() => setPage("guideelec")}
        className="mb-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-gold bg-yellow-50 px-4 py-3 text-left hover:brightness-95"
      >
        <span>
          <span className="block font-display text-base font-bold">Guide électricité pour débutant</span>
          <span className="block text-xs text-stone-600">
            Les bases, la norme NF C 15-100, comment découper la maison en circuits et câbler chaque circuit — du tableau jusqu'au Consuel.
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-terra">Ouvrir →</span>
      </button>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Chercher un problème ou un geste : porte, fenêtre, arche, passage, spot, douche, seuil, fissure…"
        className="mb-3 w-full rounded-xl border border-rule bg-white px-4 py-2.5 text-sm"
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <ChipBtn active={post === "all"} onClick={() => setPost("all")}>
          Tous
        </ChipBtn>
        {POSTS.map((p) => (
          <ChipBtn key={p.id} active={post === p.id} onClick={() => setPost(p.id)}>
            {p.short}
          </ChipBtn>
        ))}
        <ChipBtn active={post === "general"} onClick={() => setPost("general")}>
          Phasage
        </ChipBtn>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2 lg:max-h-[80vh] lg:overflow-y-auto lg:pr-1">
          <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">{list.length} fiche{list.length > 1 ? "s" : ""}</div>
          {list.length === 0 && <div className="rounded-xl border border-rule p-3 text-sm text-stone-500">Aucune fiche ne correspond à cette recherche.</div>}
          {list.map((t) => (
            <button
              key={t.id}
              onClick={() => setOpen(t.id)}
              className={`w-full rounded-xl border p-3 text-left ${current?.id === t.id ? "border-terra bg-paper-2" : "border-rule bg-white/40"}`}
            >
              <div className="text-sm font-semibold">{t.title}</div>
              <div className="text-[11px] text-stone-500">
                {t.duration} · {t.level}
              </div>
            </button>
          ))}
        </div>
        {current && <TutoDetail t={current} onPrint={() => printOne(current)} busy={oneBusy} />}
      </div>
    </div>
  );
}

function ChipBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm font-semibold ${active ? "bg-ink text-paper" : "border border-rule"}`}
    >
      {children}
    </button>
  );
}

const LEVEL_STYLE: Record<Tutorial["level"], string> = {
  base: "bg-emerald-100 text-emerald-900",
  intermédiaire: "bg-amber-100 text-amber-900",
  avancé: "bg-rose-100 text-rose-900",
};
const LEVEL_TEXT: Record<Tutorial["level"], string> = {
  base: "Débutant — gestes simples",
  intermédiaire: "Intermédiaire — soin et méthode",
  avancé: "Avancé — à faire seul(e) avec expérience",
};

/** Titre de section identique sur toutes les fiches. */
function Sec({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h3 className="mb-3 flex items-center gap-2 border-b border-rule pb-1.5 font-display text-lg font-bold">
        <span className="text-terra">{n}</span> {title}
      </h3>
      {children}
    </section>
  );
}

/** Fiche tutoriel : toutes les fiches ont exactement la même trame. */
function TutoDetail({ t, onPrint, busy }: { t: Tutorial; onPrint: () => void; busy: boolean }) {
  const { project, calc, setPage } = useStore();
  const postMeta = POSTS.find((p) => p.id === t.post);
  const q = useMemo(() => projectQuantities(project, calc), [project, calc]);
  const est = tutorialEstimate(q, t);
  const material = t.post === "general" ? [] : [...calc.byPost[t.post]].filter((i) => i.quantity > 0).sort((a, b) => b.quantity * b.unitPrice - a.quantity * a.unitPrice).slice(0, 12);
  const text = [t.title, ...(t.memo ?? []), ...t.tools, ...t.norms, ...t.steps.flatMap((s) => [s.title, s.body, s.tip ?? "", s.warn ?? ""])].join(" ");
  const gloss = useMemo(() => glossaryFor(text), [text]);
  const fr = (n: number, d = 1) => n.toLocaleString("fr-FR", { maximumFractionDigits: d });

  return (
    <Card className="overflow-hidden p-0" >
      <div id="fiche-detail" />
      <div className="border-b border-rule px-6 py-5" style={{ background: `${postMeta?.color ?? "#8a8577"}22` }}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Fiche pratique · {postMeta?.label ?? "Phasage"}</div>
        <h2 className="mt-1 font-display text-2xl font-bold leading-tight">{t.title}</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          <span className={`rounded-full px-3 py-1 ${LEVEL_STYLE[t.level]}`}>Niveau : {LEVEL_TEXT[t.level]}</span>
          <span className="rounded-full bg-white px-3 py-1 text-stone-700">Durée type : {t.duration}</span>
          {est && <span className="rounded-full bg-ink px-3 py-1 text-paper">Pour ton projet : {fmtDays(est.days)}</span>}
        </div>
        <button onClick={onPrint} disabled={busy} className="mt-3 rounded-full border border-rule bg-white px-4 py-1.5 text-xs font-semibold hover:border-terra disabled:opacity-60">
          {busy ? "Création du PDF…" : "Imprimer cette fiche (PDF)"}
        </button>
      </div>

      <div className="px-6 pb-6">
        <Sec n="01" title="Schéma">
          <FicheDiagram post={t.post} title={t.title} project={project} />
          {t.image && (
            <img src={t.image} alt="" className="mt-3 max-h-72 w-full rounded-xl border border-rule bg-stone-50 object-contain" />
          )}
        </Sec>

        <Sec n="02" title="Durée réaliste et niveau">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-rule p-3 text-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">Durée type</div>
              <div className="mt-1 font-semibold">{t.duration}</div>
              <p className="mt-1 text-xs text-stone-500">Autoconstruction soignée, une personne, séchages à ajouter.</p>
            </div>
            <div className="rounded-xl border border-rule p-3 text-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">Pour ta maison</div>
              {est ? (
                <>
                  <div className="mt-1 font-semibold">{fmtDays(est.days)}</div>
                  <p className="mt-1 text-xs text-stone-500">{est.basis}</p>
                </>
              ) : (
                <p className="mt-1 text-xs text-stone-500">Geste ponctuel : la durée type ci-contre s'applique à chaque occurrence.</p>
              )}
            </div>
          </div>
        </Sec>

        {t.memo && t.memo.length > 0 && (
          <Sec n="03" title="À retenir sur le chantier">
            <ul className="list-disc space-y-1 rounded-xl border border-gold bg-yellow-50 py-3 pl-8 pr-4 text-sm font-medium text-stone-800">
              {t.memo.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </Sec>
        )}

        <Sec n="04" title="Outils et matériel pour ton projet">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">Outils</h4>
              <ul className="mt-1 list-disc pl-5 text-sm text-stone-700">
                {t.tools.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">Matériel (quantités de ton projet)</h4>
              {material.length === 0 ? (
                <p className="mt-1 text-sm text-stone-500">Aucun matériau compté pour cette fiche : renseigne tes pièces dans « Plans & pièces ».</p>
              ) : (
                <ul className="mt-1 space-y-0.5 text-sm text-stone-700">
                  {material.map((i) => (
                    <li key={i.id} className="flex justify-between gap-2">
                      <span>{i.name}</span>
                      <span className="shrink-0 font-semibold">{fr(i.quantity)} {i.unit}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Sec>

        <Sec n="05" title="Le tutoriel pas à pas">
          <ol className="space-y-4">
            {t.steps.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[44px_1fr] gap-3">
                <div className="font-display text-3xl font-bold leading-none text-terra">{String(i + 1).padStart(2, "0")}</div>
                <div>
                  <div className="font-semibold">{s.title}</div>
                  <p className="mt-1 text-sm leading-relaxed text-stone-600">{s.body}</p>
                  {s.tip && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900"><b>Astuce —</b> {s.tip}</p>}
                  {s.warn && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-900"><b>Attention —</b> {s.warn}</p>}
                </div>
              </li>
            ))}
          </ol>
        </Sec>

        <Sec n="06" title="Normes à respecter">
          <ul className="list-disc space-y-1 pl-5 text-sm text-stone-700">
            {t.norms.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <button className="mt-2 text-xs font-semibold text-terra" onClick={() => setPage("normes")}>Voir la page Normes →</button>
        </Sec>

        <Sec n="07" title="Glossaire">
          {gloss.length === 0 ? (
            <p className="text-sm text-stone-500">Aucun terme technique particulier dans cette fiche.</p>
          ) : (
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {gloss.map((g) => (
                <div key={g.term}>
                  <dt className="text-sm font-semibold">{g.term}</dt>
                  <dd className="text-xs leading-relaxed text-stone-600">{g.def}</dd>
                </div>
              ))}
            </dl>
          )}
        </Sec>

        {t.videos.length > 0 && (
          <Sec n="08" title="Vidéos">
            <div className="flex flex-col gap-2">
              {t.videos.map((v) => (
                <a key={v.url} href={v.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-rule px-4 py-2 text-sm font-semibold hover:border-terra">
                  <Play size={14} /> {v.title} <ExternalLink size={12} className="text-stone-400" />
                </a>
              ))}
            </div>
          </Sec>
        )}
      </div>
    </Card>
  );
}
