import {
  ArrowRight,
  Download,
  FolderOpen,
  MapPinned,
  RefreshCw,
  Upload,
} from "lucide-react";
import { POSTS, RE2020_NOTES } from "../data/catalogs";
import { useStore } from "../store";
import type { PageId, PostId } from "../types";
import { fmtD, fmtE } from "../utils/format";
import { exportProjectJson } from "../utils/pdf";
import { Btn, Card, Field, Input, Num, Stat } from "./ui";

export function Dashboard() {
  const { project, calc, setPage, setSettings, loadDemo, resetProject, replaceProject } = useStore();
  const paid = project.expenses.filter((e) => e.status === "paye").reduce((s, e) => s + e.amount, 0);
  const done = project.tasks.filter((t) => t.status === "done").length;
  const pct = project.tasks.length ? Math.round((done / project.tasks.length) * 100) : 0;

  return (
    <div>
      <div className="relative mb-8 overflow-hidden rounded-[24px] bg-[#1e221d]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_84%_20%,rgba(242,194,48,0.08),transparent_38%)]" />
        <div className="pointer-events-none absolute -bottom-56 -right-28 h-[520px] w-[520px] rounded-full border border-[#ffffff]/10 shadow-[0_0_0_28px_rgba(255,255,255,0.03),0_0_0_68px_rgba(255,255,255,0.02)]" />
        <svg
          className="pointer-events-none absolute right-2 top-1/2 hidden h-[290px] w-[430px] -translate-y-1/2 opacity-80 lg:block"
          viewBox="0 0 440 300"
          aria-hidden="true"
        >
          <path className="hero-plan-stroke" d="M43 229V92l91-43 97 44v136H43Z" />
          <path className="hero-plan-stroke" style={{ animationDelay: "0.1s" }} d="m43 92 94 50 94-49M137 142v87m-47-111v-37m97 60v-72" />
          <path className="hero-plan-stroke" style={{ animationDelay: "0.2s" }} d="M70 229v-61h43v61m66 0v-48h30v48M112 78l21-10 19 10M158 123l22-11 22 11" />
          <path className="hero-plan-stroke" style={{ animationDelay: "0.3s" }} d="M27 240h226M34 231v18m211-18v18M266 57v183m-8-175h16m-16 167h16" />
          <path className="hero-plan-stroke" style={{ animationDelay: "0.4s" }} d="m278 91 70-34 52 26v108l-57 34-65-32V91Z" />
          <path className="hero-plan-stroke" style={{ animationDelay: "0.5s" }} d="m278 91 65 34 57-42m-57 42v102m-33-119v-35m64 76v-50" />
          <text x="49" y="270" fill="#99a29a" fontSize="8" letterSpacing="1.8" fontFamily="Inter, sans-serif">RDC · COUPE DE PRINCIPE</text>
          <text x="282" y="270" fill="#99a29a" fontSize="8" letterSpacing="1.8" fontFamily="Inter, sans-serif">ÉTAGE · VOLUMES</text>
        </svg>
        <div className="relative grid gap-6 p-8 md:p-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="max-w-xl">
            <div className="mb-5 inline-flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.17em] text-[#b6bfb2]">
              <span className="hero-dot" /> Pilotage du second œuvre
            </div>
            <h1 className="font-display text-5xl uppercase leading-[0.98] tracking-[0.01em] text-white md:text-6xl">
              {project.settings.projectName || "Votre chantier"}
              <br />
              <em className="font-medium normal-case italic tracking-normal text-sage">pièce après pièce.</em>
            </h1>
            <p className="mt-4 max-w-md text-[13px] leading-relaxed text-[#c2c8bd]">
              Plans, quantitatifs, listes de courses, suivi financier et conducteur — chaque vis, chaque plaque, chaque
              bouche VMC. Les prix et dimensions se règlent, les calculs suivent.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setPage("plans")}
                className="inline-flex items-center gap-2 rounded-lg bg-[#f2c230] px-4 py-2.5 text-[13px] font-semibold text-ink transition hover:-translate-y-px hover:bg-[#ffd84d]"
              >
                Ouvrir les plans <ArrowRight size={16} />
              </button>
              <button
                onClick={loadDemo}
                className="inline-flex items-center gap-1.5 px-1 py-2 text-[12px] font-semibold text-[#b6bfb2] transition hover:text-white"
              >
                Charger l'exemple <ArrowRight size={14} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 self-end lg:max-w-[300px] lg:justify-self-end">
            <Mini k="Plancher" v={`${fmtD(calc.surfaces.floor, 1)} m²`} />
            <Mini k="Pièces" v={String(calc.surfaces.rooms)} />
            <Mini k="Estimé" v={fmtE(calc.costTotal)} />
            <Mini k="Avancement" v={`${pct} %`} />
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Surface plancher" value={`${fmtD(calc.surfaces.floor, 1)} m²`} hint={`${fmtD(calc.surfaces.volume, 0)} m³`} />
        <Stat label="Murs extérieurs" value={`${fmtD(calc.surfaces.exterior, 1)} m²`} hint="à isoler" accent="forest" />
        <Stat label="Cloisons" value={`${fmtD(calc.surfaces.cloison, 1)} m²`} hint={`${fmtD(calc.surfaces.cloisonLm, 1)} ml`} accent="navy" />
        <Stat
          label="Reste à payer"
          value={fmtE(Math.max(0, calc.costTotal - paid))}
          hint={`Payé ${fmtE(paid)}`}
          accent="gold"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <h2 className="font-display mb-4 text-lg font-bold">Les neuf postes</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {POSTS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPage(p.id as PageId)}
                className="group flex items-center justify-between rounded-xl border border-rule bg-white/50 px-3 py-3 text-left hover:border-terra"
              >
                <div>
                  <div className="text-sm font-semibold">{p.label}</div>
                  <div className="text-[11px] text-stone-500">{p.blurb}</div>
                </div>
                <div className="font-display text-sm font-bold" style={{ color: p.color }}>
                  {fmtE(calc.costByPost[p.id as PostId])}
                </div>
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="font-display mb-3 text-lg font-bold">Projet</h2>
            <div className="space-y-3">
              <Field label="Nom">
                <Input
                  value={project.settings.projectName}
                  onChange={(e) => setSettings({ ...project.settings, projectName: e.target.value })}
                />
              </Field>
              <Field label="Adresse">
                <Input
                  value={project.settings.address}
                  onChange={(e) => setSettings({ ...project.settings, address: e.target.value })}
                />
              </Field>
              <Field label="TVA">
                <Num
                  value={project.settings.tva}
                  onChange={(n) => setSettings({ ...project.settings, tva: n })}
                  step={1}
                  suffix="%"
                />
              </Field>
              <p className="text-[11px] text-stone-500">10 % rénovation / 20 % neuf — à valider selon votre chantier.</p>
            </div>
          </Card>
          <Card>
            <h2 className="font-display mb-3 text-lg font-bold">Données</h2>
            <div className="flex flex-wrap gap-2">
              <Btn variant="ink" onClick={() => exportProjectJson(project)}>
                <Download size={14} /> Export JSON
              </Btn>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-white">
                <Upload size={14} /> Import JSON
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const r = new FileReader();
                    r.onload = () => {
                      try {
                        const p = JSON.parse(String(r.result));
                        if (p.floors && p.settings) replaceProject(p);
                        else alert("Fichier JSON non reconnu.");
                      } catch {
                        alert("JSON invalide.");
                      }
                    };
                    r.readAsText(f);
                  }}
                />
              </label>
              <Btn variant="ghost" onClick={loadDemo}>
                <FolderOpen size={14} /> Exemple
              </Btn>
              <Btn variant="forest" onClick={() => setPage("sync")}>
                Compte & sauvegarde
              </Btn>
              <Btn
                variant="ghost"
                className="text-red-700"
                onClick={() => {
                  if (confirm("Réinitialiser tout le projet ?")) resetProject();
                }}
              >
                <RefreshCw size={14} /> Reset
              </Btn>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display mb-3 text-lg font-bold">Conformité visée</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            <Pill ok={calc.isolation.re2020Mur} label={`Murs R=${fmtD(calc.isolation.rMur, 2)} (cible ≥ 4)`} />
            <Pill ok={calc.isolation.re2020Sol} label={`Sol R=${fmtD(calc.isolation.rSol, 2)} (cible ≥ 3,2)`} />
            <Pill ok={calc.isolation.re2020Plafond} label="Toiture / combles" />
          </div>
          <ul className="space-y-1.5 text-xs leading-relaxed text-stone-600">
            {RE2020_NOTES.map((n) => (
              <li key={n} className="flex gap-2">
                <MapPinned size={12} className="mt-0.5 shrink-0 text-terra" /> {n}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="font-display mb-3 text-lg font-bold">Conducteur — {pct} %</h2>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-paper-2">
            <div className="h-full bg-terra" style={{ width: `${pct}%` }} />
          </div>
          <ul className="space-y-1 text-sm">
            {project.tasks.slice(0, 6).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2">
                <span className={t.status === "done" ? "text-stone-400 line-through" : ""}>{t.title}</span>
                <span className="text-[11px] uppercase tracking-wider text-stone-400">{t.status}</span>
              </li>
            ))}
          </ul>
          <Btn variant="ghost" className="mt-3" onClick={() => setPage("conducteur")}>
            Voir le conducteur <ArrowRight size={14} />
          </Btn>
        </Card>
      </div>
    </div>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-white/12 bg-white/[0.07] p-3 backdrop-blur-sm">
      <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#a7afa2]">{k}</div>
      <div className="font-display mt-0.5 text-xl text-white">{v}</div>
    </div>
  );
}

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${ok ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
      {ok ? "OK" : "Vigilance"} · {label}
    </span>
  );
}
