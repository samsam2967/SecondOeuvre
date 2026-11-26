import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ISOLANTS } from "../data/catalogs";
import { useStore } from "../store";
import type { HeatExcl, Room } from "../types";
import { centroid, pointsForRoom, polyPath, svgCoords } from "../utils/geometry";
import { floorCollectors, roomOrigin } from "../utils/heating";
import { uid } from "../utils/id";
import { Btn, Card, Num, Select } from "./ui";

type Drag = { kind: "coll"; id: string } | { kind: "excl"; roomId: string; id: string; du: number; dv: number } | null;

/** Plan du plancher chauffant : pièces chauffées, isolant du sol, zones non chauffées et collecteurs déplaçables (visibles en 3D). */
export function HeatPlan() {
  const { project, updateFloor, updateRoom } = useStore();
  const [floorId, setFloorId] = useState(project.floors[0]?.id ?? "");
  const floor = project.floors.find((f) => f.id === floorId) ?? project.floors[0];
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const [selRoom, setSelRoom] = useState<string | null>(null);
  if (!floor) return null;
  const sc = floor.planScale || 40;
  const isolants = (project.settings.isolants?.length ? project.settings.isolants : ISOLANTS).filter((i) => i.usages.includes("sol"));
  const rooms = floor.rooms;
  const colls = floorCollectors(floor);
  const autoColl = !floor.collectors?.length;

  const allPts = rooms.flatMap((r) => pointsForRoom(r, sc));
  const minX = Math.min(...allPts.map((p) => p.x), 0) - 20;
  const minY = Math.min(...allPts.map((p) => p.y), 0) - 20;
  const maxX = Math.max(...allPts.map((p) => p.x), 100) + 20;
  const maxY = Math.max(...allPts.map((p) => p.y), 100) + 20;
  const vb = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  const span = maxX - minX;

  const setColl = (list: { id: string; x: number; y: number }[]) => updateFloor(floor.id, { collectors: list });
  const patchExcl = (room: Room, id: string, p: Partial<HeatExcl>) => updateRoom(floor.id, room.id, { heatExcl: (room.heatExcl ?? []).map((e) => (e.id === id ? { ...e, ...p } : e)) });
  const addExcl = (room: Room) => {
    const e: HeatExcl = { id: uid(), u: Math.max(0, room.width / 2 - 0.5), v: Math.max(0, room.length / 2 - 0.5), w: 1, h: 1 };
    updateRoom(floor.id, room.id, { heatExcl: [...(room.heatExcl ?? []), e] });
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drag || !svg.current) return;
    const p = svgCoords(svg.current, e.clientX, e.clientY);
    if (drag.kind === "coll") setColl(colls.map((c) => (c.id === drag.id ? { id: c.id, x: p.x, y: p.y } : c)));
    else {
      const room = rooms.find((r) => r.id === drag.roomId);
      if (!room) return;
      const o = roomOrigin(room, sc);
      patchExcl(room, drag.id, { u: Math.max(0, (p.x - o.x) / sc - drag.du), v: Math.max(0, (p.y - o.y) / sc - drag.dv) });
    }
  };

  const heatedM2 = rooms.filter((r) => r.floorHeating).reduce((s, r) => s + r.length * r.width - (r.heatExcl ?? []).reduce((a, e) => a + e.w * e.h, 0), 0);

  return (
    <Card>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">Plan du plancher chauffant</h2>
        {project.floors.length > 1 && (
          <Select value={floor.id} onChange={(e) => { setFloorId(e.target.value); setSelRoom(null); }} className="w-auto">
            {project.floors.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </Select>
        )}
      </div>
      <p className="mb-2 text-xs text-stone-500">
        Vert = pièce chauffée, gris = non chauffée. Glisse un collecteur <b>C</b> ou une zone hachurée pour les déplacer : conduits de départ (rouge) et de retour (bleu) et tubes se redessinent dans la vue 3D. Surface chauffée : <b>{heatedM2.toFixed(1).replace(".", ",")} m²</b>.
      </p>
      <svg
        ref={svg}
        viewBox={vb}
        className="w-full touch-none select-none rounded-xl bg-[#f4f3ee]"
        style={{ aspectRatio: `${maxX - minX} / ${maxY - minY}`, maxHeight: 460 }}
        onPointerMove={onMove}
        onPointerUp={() => setDrag(null)}
        onPointerLeave={() => setDrag(null)}
      >
        <defs>
          <pattern id="hx" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#64748b" strokeWidth="2" />
          </pattern>
        </defs>
        {floor.planImage && <image href={floor.planImage} x={0} y={0} width={floor.planWidth} height={floor.planHeight} opacity={0.35} preserveAspectRatio="none" />}
        {rooms.map((r) => {
          const pts = pointsForRoom(r, sc);
          const c = centroid(pts);
          const o = roomOrigin(r, sc);
          return (
            <g key={r.id}>
              <path d={polyPath(pts)} fill={r.floorHeating ? "#86efac" : "#d6d3d1"} fillOpacity={selRoom === r.id ? 0.85 : 0.55} stroke="#334155" strokeWidth={selRoom === r.id ? 2.5 : 1.2} vectorEffect="non-scaling-stroke" className="cursor-pointer" onPointerDown={() => setSelRoom(r.id)} />
              <text x={c.x} y={c.y} textAnchor="middle" fontSize={span / 55} fill="#1f2937" className="pointer-events-none">{r.name}</text>
              {(r.heatExcl ?? []).map((e) => (
                <rect
                  key={e.id}
                  x={o.x + e.u * sc}
                  y={o.y + e.v * sc}
                  width={e.w * sc}
                  height={e.h * sc}
                  fill="url(#hx)"
                  stroke="#475569"
                  strokeDasharray="5 3"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                  className="cursor-move"
                  onPointerDown={(ev) => {
                    ev.stopPropagation();
                    svg.current?.setPointerCapture(ev.pointerId);
                    setSelRoom(r.id);
                    const p = svgCoords(svg.current!, ev.clientX, ev.clientY);
                    setDrag({ kind: "excl", roomId: r.id, id: e.id, du: (p.x - o.x) / sc - e.u, dv: (p.y - o.y) / sc - e.v });
                  }}
                />
              ))}
            </g>
          );
        })}
        {colls.map((c) => (
          <g
            key={c.id}
            className="cursor-move"
            onPointerDown={(ev) => {
              ev.stopPropagation();
              svg.current?.setPointerCapture(ev.pointerId);
              if (autoColl) {
                const id = uid();
                setColl([{ id, x: c.x, y: c.y }]);
                setDrag({ kind: "coll", id });
              } else setDrag({ kind: "coll", id: c.id });
            }}
          >
            <circle cx={c.x} cy={c.y} r={span / 60} fill="#0f766e" stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            <text x={c.x} y={c.y + span / 150} textAnchor="middle" fontSize={span / 55} fontWeight={700} fill="#fff" className="pointer-events-none">C</text>
          </g>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Btn variant="ghost" onClick={() => setColl([...colls.map((c) => ({ id: c.id.startsWith("auto:") ? uid() : c.id, x: c.x, y: c.y })), { id: uid(), x: colls[0] ? colls[0].x + 30 : 60, y: colls[0] ? colls[0].y + 30 : 60 }])}>
          <Plus size={14} /> Collecteur
        </Btn>
        {!autoColl && (
          <>
            <Btn variant="ghost" onClick={() => setColl(colls.slice(0, -1))} disabled={colls.length <= 1}>
              <Trash2 size={14} /> Retirer le dernier
            </Btn>
            <Btn variant="ghost" onClick={() => updateFloor(floor.id, { collectors: undefined })}>Placement automatique</Btn>
          </>
        )}
        {autoColl && colls.length > 0 && <span className="text-[11px] text-stone-400">Collecteur placé automatiquement dans un local technique ou un dégagement.</span>}
      </div>

      <h3 className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">Pièces : chauffage, isolant du sol, zones non chauffées</h3>
      <div className="space-y-2">
        {rooms.map((r) => {
          const iso = isolants.find((i) => i.id === (r.floorInsulId || project.settings.isolation.isolantSolId)) ?? isolants[0];
          return (
            <div key={r.id} className={`rounded-xl border p-3 text-sm ${selRoom === r.id ? "border-terra" : "border-rule"}`} onClick={() => setSelRoom(r.id)}>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 font-semibold">
                  <input type="checkbox" checked={r.floorHeating} onChange={(e) => updateRoom(floor.id, r.id, { floorHeating: e.target.checked })} />
                  {r.name}
                </label>
                <span className="text-xs text-stone-500">{(r.length * r.width).toFixed(1).replace(".", ",")} m²</span>
                {!r.floorHeating && <span className="rounded bg-stone-100 px-2 py-0.5 text-[11px] text-stone-500">non chauffée</span>}
              </div>
              {r.floorHeating && (
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_120px]">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                    Isolant sous le sol
                    <Select value={r.floorInsulId || project.settings.isolation.isolantSolId} onChange={(e) => updateRoom(floor.id, r.id, { floorInsulId: e.target.value, floorInsulMm: undefined })}>
                      {isolants.map((i) => (
                        <option key={i.id} value={i.id}>{i.name} — {i.thickness} mm</option>
                      ))}
                    </Select>
                  </label>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                    Épaisseur (mm)
                    <Num value={r.floorInsulMm ?? iso?.thickness ?? 0} onChange={(n) => updateRoom(floor.id, r.id, { floorInsulMm: Math.max(10, n) })} step={10} />
                  </label>
                </div>
              )}
              {r.floorHeating && (
                <div className="mt-2 space-y-1.5">
                  {(r.heatExcl ?? []).map((e) => (
                    <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-stone-50 px-2 py-1.5 text-xs">
                      <span className="font-semibold">Zone non chauffée</span>
                      {([["u", "à droite de", e.u], ["v", "vers le bas", e.v], ["w", "largeur", e.w], ["h", "hauteur", e.h]] as const).map(([k, l, val]) => (
                        <label key={k} className="flex items-center gap-1">
                          {l}
                          <input type="number" step={5} min={0} className="w-16 rounded border border-rule px-1 py-0.5" value={Math.round(val * 100)} onChange={(ev) => patchExcl(r, e.id, { [k]: Math.max(k === "w" || k === "h" ? 10 : 0, Number(ev.target.value)) / 100 } as Partial<HeatExcl>)} />
                          cm
                        </label>
                      ))}
                      <button className="ml-auto text-red-700" onClick={() => updateRoom(floor.id, r.id, { heatExcl: (r.heatExcl ?? []).filter((x) => x.id !== e.id) })}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <Btn variant="ghost" onClick={() => addExcl(r)}>
                    <Plus size={14} /> Zone non chauffée (îlot, escalier, meuble fixe…)
                  </Btn>
                </div>
              )}
            </div>
          );
        })}
        {rooms.length === 0 && <p className="text-xs text-stone-500">Crée d'abord tes pièces dans « Plans & pièces ».</p>}
      </div>
    </Card>
  );
}
