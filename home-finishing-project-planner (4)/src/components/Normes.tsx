import { useMemo, useState } from "react";
import { NORMS, NORM_POSTS } from "../data/norms";
import { ROOM_TYPES } from "../data/catalogs";
import { useStore } from "../store";
import type { RoomType } from "../types";
import { Card, H, Select } from "./ui";

const SEV: Record<string, string> = {
  obligatoire: "bg-red-100 text-red-800",
  recommandé: "bg-amber-100 text-amber-800",
  contexte: "bg-stone-200 text-stone-700",
};

const POST_COLOR: Record<string, string> = {
  général: "#26362f",
  placo: "#6e9c81",
  isolation: "#4f7a63",
  électricité: "#c2a756",
  sanitaire: "#8493b6",
  vmc: "#659ca0",
  chauffage: "#bf7e89",
  peinture: "#9b85b8",
  carrelage: "#858b72",
  quincaillerie: "#8a8577",
};

const POST_BLURB: Record<string, string> = {
  général: "Code de la construction, habitabilité, diagnostics, réception",
  placo: "DTU 25.41 / 25.42 — plaques, ossatures, acoustique, feu",
  isolation: "RE2020, R minimaux, étanchéité à l'air, ponts thermiques",
  électricité: "NF C 15-100, volumes SDB, circuits, Consuel",
  sanitaire: "DTU 60.1 / 60.11 — PER, évacuations, épreuves",
  vmc: "DTU 68.3 et débits réglementaires",
  chauffage: "DTU 65.14 plancher chauffant, PAC",
  peinture: "DTU 59.1 — impression et finitions",
  carrelage: "DTU 52.2, SPEC, plancher chauffant",
  quincaillerie: "Portes, huisseries, cheminements",
};

export function Normes() {
  const { project } = useStore();
  const types = useMemo(() => {
    const set = new Set<RoomType>(project.floors.flatMap((f) => f.rooms.map((r) => r.type)));
    return [...set];
  }, [project.floors]);
  const [post, setPost] = useState<string>("tous");
  const [room, setRoom] = useState<string>("chantier");
  const [q, setQ] = useState("");

  const filtered = NORMS.filter((n) => {
    if (post !== "tous" && n.post !== post) return false;
    if (q && !`${n.title} ${n.body} ${n.code}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (room === "toutes") return true;
    if (room === "chantier") {
      if (n.rooms.includes("*")) return true;
      return types.some((t) => n.rooms.includes(t));
    }
    return n.rooms.includes("*") || n.rooms.includes(room as RoomType);
  });

  const groups = NORM_POSTS.map((p) => ({
    post: p,
    items: filtered.filter((n) => n.post === p),
  })).filter((g) => g.items.length);

  const jump = (id: string) => {
    setPost("tous");
    requestAnimationFrame(() => document.getElementById(`norm-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div>
      <H
        kicker="Réglementation"
        title="Normes par poste"
        sub="Chaque corps d'état a ses DTU et règles. Parcourez poste par poste, ou filtrez selon les pièces de votre chantier."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {NORM_POSTS.map((p) => (
          <button
            key={p}
            onClick={() => (post === p ? setPost("tous") : setPost(p))}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold capitalize ${post === p ? "text-white" : "border border-rule bg-white/50"}`}
            style={post === p ? { background: POST_COLOR[p] } : undefined}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une règle…"
          className="w-56 rounded-full border border-rule bg-white/70 px-4 py-2 text-sm"
        />
        <Select value={room} onChange={(e) => setRoom(e.target.value)} className="w-auto rounded-full">
          <option value="chantier">Pièces de mon chantier</option>
          <option value="toutes">Toutes les pièces</option>
          {ROOM_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
        <span className="self-center text-xs text-stone-500">{filtered.length} règles</span>
      </div>

      {post === "tous" && (
        <div className="mb-6 hidden gap-2 overflow-x-auto pb-1 md:flex">
          {groups.map((g) => (
            <button
              key={g.post}
              onClick={() => jump(g.post)}
              className="shrink-0 rounded-xl border border-rule bg-white/60 px-3 py-2 text-left text-xs"
            >
              <div className="font-semibold capitalize" style={{ color: POST_COLOR[g.post] }}>
                {g.post}
              </div>
              <div className="text-stone-400">{g.items.length} règles</div>
            </button>
          ))}
        </div>
      )}

      <div className="space-y-10">
        {groups.map((g) => (
          <section key={g.post} id={`norm-${g.post}`} className="scroll-mt-6">
            <div className="mb-3 flex items-end gap-3 border-b-2 pb-2" style={{ borderColor: POST_COLOR[g.post] }}>
              <h2 className="font-display text-2xl font-bold capitalize" style={{ color: POST_COLOR[g.post] }}>
                {g.post}
              </h2>
              <p className="mb-1 hidden text-sm text-stone-500 sm:block">{POST_BLURB[g.post]}</p>
              <span className="ml-auto text-xs text-stone-400">{g.items.length}</span>
            </div>
            <div className="space-y-3">
              {g.items.map((n) => (
                <Card key={n.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="stamp mb-1 inline-block" style={{ color: POST_COLOR[n.post] }}>
                        {n.code}
                      </div>
                      <h3 className="font-display text-lg font-bold">{n.title}</h3>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SEV[n.severity]}`}>{n.severity}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-stone-700">{n.body}</p>
                  <div className="mt-2 text-[11px] text-stone-400">
                    {n.rooms.includes("*")
                      ? "Toutes les pièces"
                      : n.rooms.map((r) => ROOM_TYPES.find((t) => t.id === r)?.label ?? r).join(" · ")}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))}
        {groups.length === 0 && (
          <Card>
            <p className="text-sm text-stone-500">Aucune règle pour ce filtre.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
