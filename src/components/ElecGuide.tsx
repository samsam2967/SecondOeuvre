import { useMemo, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AlertTriangle, ChevronDown, ChevronRight, Info, Lightbulb, Search } from "lucide-react";
import { ELEC_GUIDE, type Block, type Chapter } from "../data/elecGuide";
import { useStore } from "../store";
import { buildElecGuidePdf, svgToPng } from "../utils/pdfDocs";
import { Btn, Card, H } from "./ui";

/** Met en gras les passages écrits **comme ceci**. */
function rich(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>));
}

const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function chapterText(ch: Chapter): string {
  const parts: string[] = [ch.title, ch.intro ?? ""];
  for (const b of ch.blocks) {
    if (b.t === "p" || b.t === "tip" || b.t === "warn" || b.t === "info") parts.push(b.text);
    else if (b.t === "list" || b.t === "ol") parts.push(...b.items);
    else if (b.t === "table") parts.push(...b.head, ...b.rows.flat(), b.note ?? "");
    else if (b.t === "svg") parts.push(b.caption);
  }
  return plain(parts.join(" "));
}

/** Schéma du guide en PNG pour le PDF. */
async function rasterizeGuideSvg(id: string) {
  const C = { arrivee: SvgArrivee, guirlande: SvgGuirlande, volumes: SvgVolumes, eclairage: SvgEclairage }[id as "arrivee"];
  if (!C) return null;
  return svgToPng(renderToStaticMarkup(<C />));
}

export function ElecGuide() {
  const { project } = useStore();
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({ avant: true });
  const index = useMemo(() => ELEC_GUIDE.map((c) => ({ c, text: chapterText(c) })), []);
  const words = plain(q).split(/\s+/).filter(Boolean);
  const shown = index.filter((x) => words.every((w) => x.text.includes(w))).map((x) => x.c);

  const goTo = (id: string) => {
    setOpen((o) => ({ ...o, [id]: true }));
    window.setTimeout(() => document.getElementById(`guide-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  return (
    <div>
      <H
        kicker="Savoir-faire"
        title="Guide électricité : comprendre et faire ses circuits"
        sub="Pour partir de zéro : les bases, les règles de la norme NF C 15-100, comment découper la maison en circuits, câbler chaque circuit et passer le Consuel."
      />
      <div className="mb-4">
        <Btn
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const doc = await buildElecGuidePdf(project, rasterizeGuideSvg);
              doc.save("guide-electricite.pdf");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Création du PDF…" : "Télécharger le guide en PDF (imprimable)"}
        </Btn>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card className="p-3">
            <div className="relative mb-3">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Chercher (ex. salle de bain, 32 A…)"
                className="w-full rounded-xl border border-rule bg-white/70 py-2 pl-8 pr-3 text-sm outline-none focus:border-terra"
              />
            </div>
            <nav className="max-h-[60vh] space-y-0.5 overflow-auto text-sm">
              {shown.map((c) => (
                <button key={c.id} onClick={() => goTo(c.id)} className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-paper-2">
                  {c.title}
                </button>
              ))}
              {!shown.length && <p className="px-2 text-xs text-stone-400">Aucun chapitre ne correspond.</p>}
            </nav>
            <div className="mt-3 flex gap-2">
              <button
                className="flex-1 rounded-full border border-rule px-3 py-1.5 text-xs font-semibold hover:bg-paper-2"
                onClick={() => setOpen(Object.fromEntries(ELEC_GUIDE.map((c) => [c.id, true])))}
              >
                Tout déplier
              </button>
              <button className="flex-1 rounded-full border border-rule px-3 py-1.5 text-xs font-semibold hover:bg-paper-2" onClick={() => setOpen({})}>
                Tout replier
              </button>
            </div>
          </Card>
        </aside>

        <div className="space-y-3">
          {shown.map((c) => {
            const isOpen = open[c.id] || words.length > 0;
            return (
              <Card key={c.id} className="p-0">
                <section id={`guide-${c.id}`} className="scroll-mt-4">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-5 py-4 text-left"
                    aria-expanded={isOpen}
                    onClick={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))}
                  >
                    {isOpen ? <ChevronDown size={18} className="shrink-0 text-stone-500" /> : <ChevronRight size={18} className="shrink-0 text-stone-500" />}
                    <h2 className="font-display text-lg font-bold">{c.title}</h2>
                  </button>
                  {isOpen && (
                    <div className="space-y-4 px-5 pb-5">
                      {c.intro && <p className="text-sm italic leading-relaxed text-stone-600">{c.intro}</p>}
                      {c.blocks.map((b, i) => (
                        <BlockView key={i} b={b} />
                      ))}
                    </div>
                  )}
                </section>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BlockView({ b }: { b: Block }) {
  switch (b.t) {
    case "p":
      return <p className="text-sm leading-relaxed text-stone-700">{rich(b.text)}</p>;
    case "list":
      return (
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-stone-700">
          {b.items.map((x, i) => (
            <li key={i}>{rich(x)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-stone-700 marker:font-bold marker:text-terra">
          {b.items.map((x, i) => (
            <li key={i}>{rich(x)}</li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div>
          <div className="overflow-x-auto rounded-xl border border-rule">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="bg-paper-2 text-[11px] uppercase tracking-[0.1em] text-stone-500">
                  {b.head.map((h) => (
                    <th key={h} className="px-3 py-2 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, i) => (
                  <tr key={i} className="border-t border-rule align-top">
                    {r.map((cell, j) => (
                      <td key={j} className={`px-3 py-2 leading-snug ${j === 0 ? "font-semibold text-stone-800" : "text-stone-600"}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {b.note && <p className="mt-1.5 text-xs text-stone-500">{b.note}</p>}
        </div>
      );
    case "tip":
      return <Callout icon={<Lightbulb size={16} />} cls="border-forest/40 bg-green-50 text-green-900" text={b.text} />;
    case "warn":
      return <Callout icon={<AlertTriangle size={16} />} cls="border-amber-300 bg-amber-50 text-amber-900" text={b.text} />;
    case "info":
      return <Callout icon={<Info size={16} />} cls="border-sky-200 bg-sky-50 text-sky-900" text={b.text} />;
    case "svg":
      return (
        <figure className="rounded-xl border border-rule bg-white p-3">
          {b.id === "arrivee" && <SvgArrivee />}
          {b.id === "guirlande" && <SvgGuirlande />}
          {b.id === "volumes" && <SvgVolumes />}
          {b.id === "eclairage" && <SvgEclairage />}
          <figcaption className="mt-2 text-center text-xs text-stone-500">{b.caption}</figcaption>
        </figure>
      );
  }
}

function Callout({ icon, cls, text }: { icon: React.ReactNode; cls: string; text: string }) {
  return (
    <div className={`flex gap-2 rounded-xl border p-3 text-sm leading-relaxed ${cls}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{rich(text)}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ schémas ------------------------------------------------------------------ */

const INK = "#1d211c";
const PAPER = "#f4f5f2";
const GOLD = "#f2c230";
const FOREST = "#3f6b52";
const PHASE = "#92400e";
const NEUTRE = "#2563eb";
const TERRE = "#65a30d";

function Box({ x, y, w, h, label, sub, fill = PAPER }: { x: number; y: number; w: number; h: number; label: string; sub?: string; fill?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={10} fill={fill} stroke={INK} strokeWidth={1.5} />
      <text x={x + w / 2} y={y + h / 2 - (sub ? 3 : -4)} textAnchor="middle" fontSize={13} fontWeight={700} fill={INK}>
        {label}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 13} textAnchor="middle" fontSize={11} fill="#57534e">
          {sub}
        </text>
      )}
    </g>
  );
}

function Arrow({ x1, y1, x2, y2, color = INK }: { x1: number; y1: number; x2: number; y2: number; color?: string }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2} markerEnd="url(#arr)" />;
}

function Defs() {
  return (
    <defs>
      <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill={INK} />
      </marker>
    </defs>
  );
}

function SvgArrivee() {
  return (
    <svg viewBox="0 0 720 330" className="w-full" role="img" aria-label="Du réseau aux circuits">
      <Defs />
      <Box x={10} y={20} w={130} h={56} label="Réseau" sub="Enedis" />
      <Box x={170} y={20} w={130} h={56} label="Compteur" sub="Linky" />
      <Box x={330} y={20} w={170} h={56} label="Disjoncteur" sub="de branchement (général)" />
      <Box x={530} y={20} w={170} h={56} label="Tableau" sub="dans la GTL" fill="#fef3c7" />
      <Arrow x1={140} y1={48} x2={168} y2={48} />
      <Arrow x1={300} y1={48} x2={328} y2={48} />
      <Arrow x1={500} y1={48} x2={528} y2={48} />
      <text x={604} y={110} textAnchor="end" fontSize={12} fill={INK} fontWeight={700}>
        Interrupteur différentiel 30 mA
      </text>
      <line x1={615} y1={76} x2={615} y2={116} stroke={INK} strokeWidth={2} />
      <line x1={90} y1={150} x2={640} y2={150} stroke={INK} strokeWidth={2} />
      <line x1={615} y1={116} x2={615} y2={150} stroke={INK} strokeWidth={2} />
      {[
        { x: 10, t: "Éclairage", s: "1,5 mm² · 16 A", c: GOLD },
        { x: 190, t: "Prises", s: "2,5 mm² · 20 A", c: "#93c5fd" },
        { x: 370, t: "Four, lave-linge…", s: "2,5 mm² · 20 A", c: "#fca5a5" },
        { x: 550, t: "Plaque cuisson", s: "6 mm² · 32 A", c: "#fdba74" },
      ].map((b) => (
        <g key={b.t}>
          <line x1={b.x + 80} y1={150} x2={b.x + 80} y2={190} stroke={INK} strokeWidth={2} markerEnd="url(#arr)" />
          <text x={b.x + 90} y={176} fontSize={10} fill="#57534e">
            disjoncteur
          </text>
          <Box x={b.x} y={192} w={160} h={60} label={b.t} sub={b.s} fill={b.c} />
        </g>
      ))}
      <text x={360} y={290} textAnchor="middle" fontSize={12} fill="#57534e">
        Chaque circuit = 1 disjoncteur + 1 fil de la bonne section. Plusieurs circuits (8 maximum) derrière un différentiel.
      </text>
    </svg>
  );
}

function SvgGuirlande() {
  const lines = [
    { y: 108, c: PHASE, t: "Phase" },
    { y: 120, c: NEUTRE, t: "Neutre" },
    { y: 132, c: TERRE, t: "Terre" },
  ];
  return (
    <svg viewBox="0 0 720 250" className="w-full" role="img" aria-label="Prises en guirlande">
      <Defs />
      <Box x={10} y={80} w={120} h={80} label="Tableau" sub="disjoncteur 20 A" fill="#fef3c7" />
      {[250, 420, 590].map((x, i) => (
        <g key={x}>
          <rect x={x} y={70} width={90} height={100} rx={12} fill="#fff" stroke={INK} strokeWidth={1.5} />
          <circle cx={x + 30} cy={120} r={9} fill={INK} />
          <circle cx={x + 60} cy={120} r={9} fill={INK} />
          <rect x={x + 38} y={86} width={14} height={8} rx={2} fill={TERRE} />
          <text x={x + 45} y={192} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK}>
            Prise {i + 1}
          </text>
        </g>
      ))}
      {lines.map((l) => (
        <g key={l.y}>
          <line x1={130} y1={l.y} x2={680} y2={l.y} stroke={l.c} strokeWidth={3} strokeDasharray={l.t === "Terre" ? "8 4" : undefined} />
        </g>
      ))}
      <rect x={140} y={198} width={540} height={34} rx={8} fill={PAPER} stroke={INK} strokeWidth={1} />
      <circle cx={170} cy={215} r={5} fill={PHASE} />
      <text x={182} y={219} fontSize={12} fill={INK}>
        Phase (marron / rouge)
      </text>
      <circle cx={340} cy={215} r={5} fill={NEUTRE} />
      <text x={352} y={219} fontSize={12} fill={INK}>
        Neutre (bleu)
      </text>
      <circle cx={470} cy={215} r={5} fill={TERRE} />
      <text x={482} y={219} fontSize={12} fill={INK}>
        Terre (vert / jaune)
      </text>
      <text x={190} y={56} fontSize={11} fill="#57534e">
        Le câble arrive à la 1re prise, puis repart vers la suivante sur les mêmes bornes
      </text>
    </svg>
  );
}

function SvgVolumes() {
  // 1 m = 100 px. Receveur 90 × 90 cm au centre ; volume 2 = 60 cm autour.
  const cx = 250;
  const cy = 170;
  const s = 90;
  const r = 60;
  return (
    <svg viewBox="0 0 500 372" className="mx-auto w-full max-w-xl" role="img" aria-label="Volumes d'une douche, vue de dessus">
      <rect x={4} y={4} width={492} height={364} rx={10} fill="#ecfdf5" stroke={INK} strokeWidth={1.5} />
      <text x={20} y={30} fontSize={13} fontWeight={700} fill={FOREST}>
        Hors volume : prises et appareils autorisés
      </text>
      <rect x={cx - s / 2 - r} y={cy - s / 2 - r} width={s + 2 * r} height={s + 2 * r} rx={8} fill="#fef9c3" stroke="#a16207" strokeWidth={2} strokeDasharray="6 4" />
      <rect x={cx - s / 2} y={cy - s / 2} width={s} height={s} rx={6} fill="#fecaca" stroke="#b91c1c" strokeWidth={2} />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="#7f1d1d">
        Volumes
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize={12} fontWeight={700} fill="#7f1d1d">
        0 et 1
      </text>
      <text x={cx} y={cy - s / 2 - r + 18} textAnchor="middle" fontSize={12} fontWeight={700} fill="#854d0e">
        Volume 2 (60 cm autour)
      </text>
      <line x1={cx + s / 2} y1={cy} x2={cx + s / 2 + r} y2={cy} stroke="#854d0e" strokeWidth={2} markerEnd="url(#arr)" />
      <text x={cx + s / 2 + r / 2} y={cy - 8} textAnchor="middle" fontSize={11} fill="#854d0e">
        60 cm
      </text>
      <Defs />
      <text x={20} y={304} fontSize={12} fill={INK}>
        Volume 0 (dans le receveur) et volume 1 (au-dessus, jusqu'à 2,25 m) :
      </text>
      <text x={20} y={321} fontSize={12} fill={INK}>
        aucune prise.
      </text>
      <text x={20} y={340} fontSize={12} fill={INK}>
        Volume 2 : prise rasoir spéciale seulement.
      </text>
      <text x={20} y={357} fontSize={12} fill={INK}>
        Au-delà : prises autorisées (au moins 1 prise obligatoire).
      </text>
    </svg>
  );
}

function SvgEclairage() {
  return (
    <svg viewBox="0 0 720 260" className="w-full" role="img" aria-label="Simple allumage">
      <Defs />
      <Box x={10} y={90} w={120} h={80} label="Tableau" sub="disjoncteur 16 A" fill="#fef3c7" />
      <Box x={300} y={20} w={130} h={64} label="Interrupteur" sub="(ou poussoir)" />
      <circle cx={640} cy={130} r={38} fill="#fef08a" stroke={INK} strokeWidth={1.5} />
      <text x={640} y={135} textAnchor="middle" fontSize={13} fontWeight={700} fill={INK}>
        Lampe
      </text>
      {/* phase vers l'interrupteur */}
      <polyline points="130,110 215,110 215,52 298,52" fill="none" stroke={PHASE} strokeWidth={3} />
      <text x={175} y={100} fontSize={11} fill={PHASE} fontWeight={700}>
        phase
      </text>
      {/* retour vers la lampe */}
      <polyline points="430,52 520,52 520,115 600,115" fill="none" stroke="#ea580c" strokeWidth={3} />
      <text x={480} y={44} fontSize={11} fill="#ea580c" fontWeight={700}>
        retour
      </text>
      {/* neutre direct */}
      <polyline points="130,140 300,140 300,150 600,150" fill="none" stroke={NEUTRE} strokeWidth={3} />
      <text x={330} y={142} fontSize={11} fill={NEUTRE} fontWeight={700}>
        neutre (direct à la lampe)
      </text>
      {/* terre */}
      <polyline points="130,160 300,160 300,190 640,190 640,168" fill="none" stroke={TERRE} strokeWidth={3} strokeDasharray="8 4" />
      <text x={330} y={208} fontSize={11} fill={TERRE} fontWeight={700}>
        terre (jusqu'au luminaire si métallique)
      </text>
      <text x={360} y={246} textAnchor="middle" fontSize={12} fill="#57534e">
        Avec un module connecté : amène aussi le neutre à l'interrupteur (fil bleu).
      </text>
    </svg>
  );
}
