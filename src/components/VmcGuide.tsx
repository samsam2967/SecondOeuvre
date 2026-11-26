import { useMemo, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { VMC_GUIDE } from "../data/vmcGuide";
import { useStore } from "../store";
import { buildVmcGuidePdf, svgToPng } from "../utils/pdfDocs";
import { BlockView, chapterText, plain } from "./ElecGuide";
import { SvgVmcDouble, SvgVmcReseau, SvgVmcSimple } from "./VmcSvgs";
import { Btn, Card, H } from "./ui";

async function rasterize(id: string) {
  const C = { "vmc-simple": SvgVmcSimple, "vmc-double": SvgVmcDouble, "vmc-reseau": SvgVmcReseau }[id as "vmc-simple"];
  return C ? svgToPng(renderToStaticMarkup(<C />)) : null;
}

/** Guide VMC : simple flux, double flux, débits, gaines, pose, entretien. Même présentation que le guide électricité. */
export function VmcGuide() {
  const { project, setPage } = useStore();
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({ "vmc-flux": true });
  const index = useMemo(() => VMC_GUIDE.map((c) => ({ c, text: chapterText(c) })), []);
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
        title="Guide VMC : simple flux, double flux, gaines et pose"
        sub="Pour partir de zéro : à quoi sert la VMC, la différence entre simple et double flux, les débits, le placement des bouches et du caisson, les gaines, la pose et l'entretien."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Btn
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const doc = await buildVmcGuidePdf(project, rasterize);
              doc.save("guide-vmc.pdf");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Création du PDF…" : "Télécharger le guide en PDF (imprimable)"}
        </Btn>
        <Btn variant="ghost" onClick={() => setPage("vmcplan")}>Ouvrir le plan des gaines VMC</Btn>
        <Btn variant="ghost" onClick={() => setPage("vmc")}>Ouvrir le poste VMC</Btn>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card className="p-3">
            <div className="relative mb-3">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher (ex. double flux, gaine…)" className="w-full rounded-xl border border-rule bg-white/70 py-2 pl-8 pr-3 text-sm outline-none focus:border-terra" />
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
              <button className="flex-1 rounded-full border border-rule px-3 py-1.5 text-xs font-semibold hover:bg-paper-2" onClick={() => setOpen(Object.fromEntries(VMC_GUIDE.map((c) => [c.id, true])))}>Tout déplier</button>
              <button className="flex-1 rounded-full border border-rule px-3 py-1.5 text-xs font-semibold hover:bg-paper-2" onClick={() => setOpen({})}>Tout replier</button>
            </div>
          </Card>
        </aside>

        <div className="space-y-3">
          {shown.map((c) => {
            const isOpen = open[c.id] || words.length > 0;
            return (
              <Card key={c.id} className="p-0">
                <section id={`guide-${c.id}`} className="scroll-mt-4">
                  <button type="button" className="flex w-full items-center gap-2 px-5 py-4 text-left" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))}>
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
