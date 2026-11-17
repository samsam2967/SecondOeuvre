import { POSTS } from "../data/catalogs";
import { useStore } from "../store";
import type { TaskStatus } from "../types";
import { Btn, Card, H, Select } from "./ui";

const PHASES = [
  { n: 1, title: "Installation de chantier" },
  { n: 2, title: "Ossatures & isolation" },
  { n: 3, title: "Réseaux (avant fermeture)" },
  { n: 4, title: "Fermeture placo" },
  { n: 5, title: "Chape & sols" },
  { n: 6, title: "Peinture" },
  { n: 7, title: "Appareils & mises en service" },
  { n: 8, title: "Finitions & réception" },
];

export function Conductor() {
  const { project, setTask, resetTasks } = useStore();
  const done = project.tasks.filter((t) => t.status === "done").length;
  const pct = project.tasks.length ? Math.round((done / project.tasks.length) * 100) : 0;
  const hours = project.tasks.reduce((s, t) => s + t.durationH, 0);

  return (
    <div>
      <H
        kicker="Phasage"
        title="Conducteur de travaux"
        sub="L'ordre qui évite de casser du placo pour un tuyau oublié. Cochez au fur et à mesure — durées indicatives en autoconstruction soignée."
      />
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="font-display text-4xl font-bold">{pct}%</div>
        <div className="min-w-[200px] flex-1">
          <div className="h-3 overflow-hidden rounded-full bg-paper-2">
            <div className="h-full bg-terra" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 text-xs text-stone-500">
            {done}/{project.tasks.length} tâches · ~{hours} h estimées
          </div>
        </div>
        <Btn
          variant="ghost"
          onClick={() => {
            if (confirm("Réinitialiser le statut des tâches ?")) resetTasks();
          }}
        >
          Réinitialiser
        </Btn>
      </div>

      <div className="space-y-6">
        {PHASES.map((ph) => {
          const tasks = project.tasks.filter((t) => t.phase === ph.n).sort((a, b) => a.order - b.order);
          const d = tasks.filter((t) => t.status === "done").length;
          return (
            <Card key={ph.n}>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-display text-xl font-bold">
                  <span className="mr-2 text-terra">0{ph.n}</span>
                  {ph.title}
                </h2>
                <span className="text-xs text-stone-500">
                  {d}/{tasks.length}
                </span>
              </div>
              <ol className="space-y-3">
                {tasks.map((t) => (
                  <li key={t.id} className="grid gap-2 rounded-xl border border-rule p-3 md:grid-cols-[1fr_160px]">
                    <div>
                      <div className={`font-semibold ${t.status === "done" ? "text-stone-400 line-through" : ""}`}>{t.title}</div>
                      <p className="mt-1 text-sm leading-relaxed text-stone-600">{t.detail}</p>
                      <div className="mt-1 text-[11px] uppercase tracking-wider text-stone-400">
                        {t.post === "general" ? "Général" : POSTS.find((p) => p.id === t.post)?.label} · {t.durationH} h
                      </div>
                    </div>
                    <Select value={t.status} onChange={(e) => setTask(t.id, { status: e.target.value as TaskStatus })}>
                      <option value="todo">À faire</option>
                      <option value="doing">En cours</option>
                      <option value="blocked">Bloqué</option>
                      <option value="done">Terminé</option>
                    </Select>
                  </li>
                ))}
              </ol>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
