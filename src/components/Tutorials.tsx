import { useMemo, useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import { POSTS } from "../data/catalogs";
import { TUTORIALS, type Tutorial } from "../data/tutorials";
import { useStore } from "../store";
import { browserImageLoader, buildPostPdf, buildTutorialPdf } from "../utils/pdfDocs";
import { Card, H } from "./ui";

export function Tutorials() {
  const { setPage, project } = useStore();
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
  const current = list.find((t) => t.id === open) ?? list[0];
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

function TutoDetail({ t, onPrint, busy }: { t: Tutorial; onPrint: () => void; busy: boolean }) {
  return (
    <Card className="overflow-hidden p-0">
      <img src={t.image} alt="" className={t.image.includes("/fiche-") ? "max-h-80 w-full bg-stone-50 object-contain" : "h-56 w-full object-cover"} />
      <div className="p-6">
        <div className="stamp mb-2 inline-block text-terra">{t.level}</div>
        <h2 className="font-display text-2xl font-bold">{t.title}</h2>
        <p className="mt-1 text-sm text-stone-500">{t.duration}</p>
        <button
          onClick={onPrint}
          disabled={busy}
          className="mt-3 rounded-full border border-rule px-4 py-1.5 text-xs font-semibold hover:border-terra disabled:opacity-60"
        >
          {busy ? "Création du PDF…" : "Imprimer cette fiche (PDF)"}
        </button>
        {t.memo && t.memo.length > 0 && (
          <div className="mt-4 rounded-xl border border-gold bg-yellow-50 p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-600">À retenir sur le chantier</h3>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm font-medium text-stone-800">
              {t.memo.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">Outils</h3>
            <ul className="mt-1 list-disc pl-4 text-sm text-stone-700">
              {t.tools.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">Normes</h3>
            <ul className="mt-1 list-disc pl-4 text-sm text-stone-700">
              {t.norms.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </div>

        <ol className="mt-6 space-y-4">
          {t.steps.map((s, i) => (
            <li key={s.title} className="grid grid-cols-[40px_1fr] gap-3">
              <div className="font-display text-2xl font-bold text-terra">{String(i + 1).padStart(2, "0")}</div>
              <div>
                <div className="font-semibold">{s.title}</div>
                <p className="mt-1 text-sm leading-relaxed text-stone-600">{s.body}</p>
                {s.tip && <p className="mt-1 text-xs text-forest">Astuce — {s.tip}</p>}
                {s.warn && <p className="mt-1 text-xs text-amber-800">Attention — {s.warn}</p>}
              </div>
            </li>
          ))}
        </ol>

        {t.videos.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">Vidéos</h3>
          <div className="flex flex-col gap-2">
            {t.videos.map((v) => (
              <a
                key={v.url}
                href={v.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-rule px-4 py-2 text-sm font-semibold hover:border-terra"
              >
                <Play size={14} /> {v.title} <ExternalLink size={12} className="text-stone-400" />
              </a>
            ))}
          </div>
        </div>
        )}
      </div>
    </Card>
  );
}
