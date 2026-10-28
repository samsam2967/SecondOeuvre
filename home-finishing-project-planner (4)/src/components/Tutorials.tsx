import { useMemo, useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import { POSTS } from "../data/catalogs";
import { TUTORIALS, type Tutorial } from "../data/tutorials";
import { Card, H } from "./ui";

export function Tutorials() {
  const [post, setPost] = useState<string>("all");
  const [open, setOpen] = useState<string | null>(TUTORIALS[0]?.id ?? null);
  const list = useMemo(
    () => TUTORIALS.filter((t) => post === "all" || t.post === post),
    [post],
  );
  const current = TUTORIALS.find((t) => t.id === open) ?? list[0];

  return (
    <div>
      <H
        kicker="Savoir-faire"
        title="Tutoriels de pose"
        sub="Pas à pas, schémas, outils, normes et vidéos — pour chaque geste du second œuvre."
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
        <div className="space-y-2">
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
        {current && <TutoDetail t={current} />}
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

function TutoDetail({ t }: { t: Tutorial }) {
  return (
    <Card className="overflow-hidden p-0">
      <img src={t.image} alt="" className="h-56 w-full object-cover" />
      <div className="p-6">
        <div className="stamp mb-2 inline-block text-terra">{t.level}</div>
        <h2 className="font-display text-2xl font-bold">{t.title}</h2>
        <p className="mt-1 text-sm text-stone-500">{t.duration}</p>

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
      </div>
    </Card>
  );
}
