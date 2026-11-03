import { useEffect, useMemo, useRef, useState } from "react";
import { Cable, MousePointer2, Plus, Trash2, Undo2, Maximize, Minus } from "lucide-react";
import { useStore } from "../store";
import type { ElecDevice, ElecDeviceKind, ElecRun, ElecRunPoint, Floor } from "../types";
import { compute } from "../utils/calc";
import { centroid, pointsForRoom, polyPath, svgCoords } from "../utils/geometry";
import {
  DEVICE_KINDS,
  RUN_TYPES,
  defaultDeviceZ,
  devicePoints,
  elecPlanTotals,
  kindInfo,
  newRun,
  roomAt,
} from "../utils/elecPlan";
import { defaultElec } from "../utils/surfaces";
import { fmtD, fmtE, fmtN } from "../utils/format";
import { uid } from "../utils/id";
import { Btn, Card, Field, H, Input, Num, Select, Toggle } from "./ui";

type Tool = "select" | "place" | "run";
type Sel = { k: "device" | "run"; id: string } | null;
type Drag =
  | { t: "device"; id: string; x: number; y: number }
  | { t: "wp"; runId: string; i: number; x: number; y: number }
  | null;

export function ElecPlan() {
  const { project, updateFloor, setElecRuns, patchSettings } = useStore();
  const floorsSorted = useMemo(() => [...project.floors].sort((a, b) => a.level - b.level), [project.floors]);
  const [floorId, setFloorId] = useState(floorsSorted[0]?.id ?? "");
  const floor: Floor | undefined = project.floors.find((f) => f.id === floorId) ?? floorsSorted[0];
  const [tool, setTool] = useState<Tool>("select");
  const [placeKind, setPlaceKind] = useState<ElecDeviceKind>("prise");
  const [sel, setSel] = useState<Sel>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const runs = project.elecRuns ?? [];
  const S = project.settings.elec;

  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ x: number; y: number } | null>(null);
  const vw = floor?.planWidth || 1000;
  const vh = floor?.planHeight || 700;
  const [cam, setCam] = useState({ x: 0, y: 0, w: vw, h: vh });
  useEffect(() => setCam({ x: 0, y: 0, w: vw, h: vh }), [floor?.id, vw, vh]);

  const totals = useMemo(() => elecPlanTotals(project), [project]);
  const cmp = useMemo(() => {
    const mk = (mode: "forfait" | "plan") =>
      compute({ ...project, settings: { ...project.settings, elec: { ...project.settings.elec, cableMode: mode } } });
    const sum = (c: ReturnType<typeof compute>) => {
      const its = c.byPost.electricite.filter((i) => i.category === "Câbles" || i.category === "Gaines");
      return {
        cable: its.filter((i) => i.category === "Câbles").reduce((s, i) => s + i.quantity, 0),
        gaine: its.filter((i) => i.category === "Gaines").reduce((s, i) => s + i.quantity, 0),
        cost: its.reduce((s, i) => s + i.quantity * i.unitPrice, 0),
      };
    };
    return { forfait: sum(mk("forfait")), plan: sum(mk("plan")) };
  }, [project]);

  const devices = (floor?.elecDevices ?? []) as ElecDevice[];
  const allDevices = useMemo(() => {
    const m = new Map<string, { dev: ElecDevice; floor: Floor }>();
    for (const f of project.floors) for (const d of f.elecDevices ?? []) m.set(d.id, { dev: d, floor: f });
    return m;
  }, [project.floors]);

  const selRun = sel?.k === "run" ? runs.find((r) => r.id === sel.id) : undefined;
  const selDev = sel?.k === "device" ? allDevices.get(sel.id)?.dev : undefined;

  // ---------- Modifications ----------
  const setDevices = (fid: string, fn: (d: ElecDevice[]) => ElecDevice[]) =>
    updateFloor(fid, (f) => ({ ...f, elecDevices: fn(f.elecDevices ?? []) }));
  const patchRun = (id: string, patch: Partial<ElecRun>) =>
    setElecRuns((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addDevice = (x: number, y: number) => {
    if (!floor) return;
    const dev: ElecDevice = { id: uid(), kind: placeKind, x, y, z: defaultDeviceZ(placeKind, floor) };
    setDevices(floor.id, (d) => [...d, dev]);
    setSel({ k: "device", id: dev.id });
  };
  const deleteDevice = (id: string) => {
    const e = allDevices.get(id);
    if (!e) return;
    setDevices(e.floor.id, (d) => d.filter((x) => x.id !== id));
    setElecRuns((rs) => rs.map((r) => ({ ...r, points: r.points.filter((p) => p.deviceId !== id) })));
    setSel(null);
  };
  const createRun = (type: ElecRun["type"] = "prises") => {
    const r = newRun(uid(), `Circuit ${runs.length + 1}`, type);
    setElecRuns((rs) => [...rs, r]);
    setSel({ k: "run", id: r.id });
    setTool("run");
    return r;
  };
  const addRunPoint = (runId: string, p: ElecRunPoint) =>
    setElecRuns((rs) =>
      rs.map((r) => {
        if (r.id !== runId) return r;
        const last = r.points[r.points.length - 1];
        if (p.deviceId && last?.deviceId === p.deviceId) return r;
        return { ...r, points: [...r.points, p] };
      }),
    );

  const unit = () => {
    const r = svgRef.current?.getBoundingClientRect();
    return r && r.width && r.height ? Math.max(cam.w / r.width, cam.h / r.height) : cam.w / 800;
  };
  const rad = Math.max(6, cam.w / 110);
  const pt = (e: { clientX: number; clientY: number }) =>
    svgRef.current ? svgCoords(svgRef.current, e.clientX, e.clientY) : { x: 0, y: 0 };

  const onBackground = (e: React.PointerEvent) => {
    if (!floor) return;
    try {
      svgRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (e.button === 1 || e.altKey || e.shiftKey) {
      panRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    const p = pt(e);
    if (tool === "place") return addDevice(p.x, p.y);
    if (tool === "run") {
      const run = selRun ?? createRun();
      // Accroche à un élément proche, sinon point de passage libre.
      const near = devices.find((d) => Math.hypot(d.x - p.x, d.y - p.y) < rad * 1.8);
      addRunPoint(run.id, near ? { floorId: floor.id, x: near.x, y: near.y, deviceId: near.id } : { floorId: floor.id, x: p.x, y: p.y });
      return;
    }
    setSel(null);
    panRef.current = { x: e.clientX, y: e.clientY };
  };

  const onMove = (e: React.PointerEvent) => {
    if (panRef.current) {
      const u = unit();
      const dx = e.clientX - panRef.current.x;
      const dy = e.clientY - panRef.current.y;
      setCam((c) => ({ ...c, x: c.x - dx * u, y: c.y - dy * u }));
      panRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (drag) {
      const p = pt(e);
      setDrag({ ...drag, x: p.x, y: p.y });
    }
  };

  const onUp = () => {
    panRef.current = null;
    if (!drag || !floor) return setDrag(null);
    if (drag.t === "device") {
      const e = allDevices.get(drag.id);
      if (e) setDevices(e.floor.id, (d) => d.map((x) => (x.id === drag.id ? { ...x, x: drag.x, y: drag.y } : x)));
    } else {
      setElecRuns((rs) =>
        rs.map((r) =>
          r.id === drag.runId ? { ...r, points: r.points.map((p, i) => (i === drag.i ? { ...p, x: drag.x, y: drag.y } : p)) } : r,
        ),
      );
    }
    setDrag(null);
  };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const stop = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", stop, { passive: false });
    return () => el.removeEventListener("wheel", stop);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "SELECT", "TEXTAREA"].includes(t.tagName)) return;
      if (e.key === "Escape") setTool("select");
      if (e.key === "Delete" || e.key === "Backspace") {
        if (tool === "run" && selRun) {
          patchRun(selRun.id, { points: selRun.points.slice(0, -1) });
          e.preventDefault();
        } else if (sel?.k === "device") {
          deleteDevice(sel.id);
          e.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!floor) {
    return (
      <div>
        <H kicker="Électricité" title="Plan électrique" />
        <Card>
          <p className="text-sm text-stone-600">Aucun étage : créez-en un dans « Plans &amp; pièces ».</p>
        </Card>
      </div>
    );
  }

  const posOf = (p: ElecRunPoint, fl: Floor) => {
    if (drag?.t === "wp" && drag.runId && false) return p;
    const ref = p.deviceId ? allDevices.get(p.deviceId) : undefined;
    if (p.deviceId && !ref) return null;
    const f = ref?.floor ?? project.floors.find((x) => x.id === p.floorId);
    if (!f || f.id !== fl.id) return null;
    const devDrag = ref && drag?.t === "device" && drag.id === ref.dev.id ? drag : null;
    return { x: devDrag ? devDrag.x : (ref?.dev.x ?? p.x), y: devDrag ? devDrag.y : (ref?.dev.y ?? p.y) };
  };

  const routePath = (r: ElecRun) => {
    const segs: string[] = [];
    const marks: { x: number; y: number }[] = [];
    const pos = r.points.map((p, i) => {
      if (drag?.t === "wp" && drag.runId === r.id && drag.i === i) return { x: drag.x, y: drag.y };
      return posOf(p, floor);
    });
    for (let i = 1; i < r.points.length; i++) {
      const a = pos[i - 1];
      const b = pos[i];
      if (a && b) {
        segs.push(r.ortho ? `M${a.x},${a.y} L${b.x},${a.y} L${b.x},${b.y}` : `M${a.x},${a.y} L${b.x},${b.y}`);
      } else if (a && !b) marks.push(a);
      else if (b && !a) marks.push(b);
    }
    return { d: segs.join(" "), marks, pos };
  };

  const scale = floor.planScale || 40;
  const runTotals = new Map(totals.runs.map((m) => [m.runId, m]));
  const selMetrics = selRun ? runTotals.get(selRun.id) : undefined;

  // ---------- Pose vs prévu par pièce ----------
  const coverage = project.floors.flatMap((f) =>
    f.rooms.map((room) => {
      const placed = { prises: 0, inters: 0, lum: 0, faibles: 0 };
      for (const d of f.elecDevices ?? []) {
        if (roomAt(f, d)?.id !== room.id) continue;
        if (d.kind.startsWith("prise")) placed.prises += devicePoints(d.kind);
        else if (["inter", "inter_double", "va_et_vient", "poussoir"].includes(d.kind)) placed.inters += devicePoints(d.kind);
        else if (d.kind === "dcl" || d.kind === "spot") placed.lum += 1;
        else if (d.kind === "rj45" || d.kind === "tv") placed.faibles += 1;
      }
      const e = defaultElec(room);
      return {
        room,
        floor: f,
        rows: [
          ["Prises", placed.prises, e.prises],
          ["Interrupteurs", placed.inters, e.interrupteurs + e.vaEtVient + e.poussoirs],
          ["Lumières", placed.lum, e.dcl + e.spots],
          ["Réseau / TV", placed.faibles, e.rj45 + e.tv],
        ] as [string, number, number][],
      };
    }),
  );

  return (
    <div>
      <H
        kicker="Électricité"
        title="Plan électrique"
        sub="Posez tableau, prises, interrupteurs et points lumineux sur le plan à l'échelle, puis tracez vos câbles : le site mesure les longueurs de câble et de gaine, étage compris. À utiliser sur ordinateur."
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-stone-500">Calcul des câbles et gaines du chiffrage :</span>
          {(["forfait", "plan"] as const).map((m) => (
            <button
              key={m}
              onClick={() => patchSettings("elec", { ...S, cableMode: m })}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${S.cableMode === m ? "bg-ink text-paper" : "border border-rule"}`}
            >
              {m === "forfait" ? "Au forfait (m par point)" : "Mesuré sur le plan"}
            </button>
          ))}
          <span className="text-xs text-stone-500">
            Forfait : {fmtN(cmp.forfait.cable, 0)} m de câble · {fmtN(cmp.forfait.gaine, 0)} m de gaine · {fmtE(cmp.forfait.cost)} — Plan :{" "}
            {runs.length ? `${fmtN(cmp.plan.cable, 0)} m · ${fmtN(cmp.plan.gaine, 0)} m · ${fmtE(cmp.plan.cost)}` : "aucun circuit tracé"}
          </span>
        </div>
        {S.cableMode === "plan" && runs.length === 0 && (
          <p className="mt-2 text-xs text-amber-700">
            Aucun circuit tracé : le calcul au forfait reste utilisé tant que vous n'avez rien tracé.
          </p>
        )}
        {S.cableMode === "plan" && runs.length > 0 && (
          <p className="mt-2 text-xs text-stone-500">
            Seuls les circuits tracés comptent : un point sans circuit n'a pas de câble. Vérifiez « Pose vs prévu » plus bas.
          </p>
        )}
      </Card>

      <div className="mb-3 flex flex-wrap gap-2">
        {floorsSorted.map((f) => (
          <button
            key={f.id}
            onClick={() => setFloorId(f.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${f.id === floor.id ? "bg-ink text-paper" : "border border-rule"}`}
          >
            {f.name}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setTool("select")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${tool === "select" ? "bg-terra text-white" : "border border-rule"}`}
            >
              <MousePointer2 size={14} /> Sélection
            </button>
            <button
              onClick={() => setTool("place")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${tool === "place" ? "bg-terra text-white" : "border border-rule"}`}
            >
              <Plus size={14} /> Poser : {kindInfo(placeKind).label}
            </button>
            <button
              onClick={() => setTool("run")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${tool === "run" ? "bg-terra text-white" : "border border-rule"}`}
            >
              <Cable size={14} /> Tracer un câble{selRun ? ` : ${selRun.name}` : ""}
            </button>
            <span className="text-[11px] text-stone-400">
              Molette : zoom · Maj + glisser : déplacer · Échap : sélection · Suppr : retirer
            </span>
          </div>

          <div
            ref={wrapRef}
            className="relative overflow-hidden rounded-2xl border border-rule bg-paper shadow-[inset_0_1px_0_#fff,0_12px_30px_-18px_rgba(28,25,23,0.4)]"
          >
            <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1 rounded-xl border border-rule bg-white/95 p-1 shadow-lg">
              <button
                title="Zoom avant"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-600 hover:bg-paper-2"
                onClick={() => setCam((c) => ({ x: c.x + c.w * 0.1, y: c.y + c.h * 0.1, w: c.w * 0.8, h: c.h * 0.8 }))}
              >
                <Plus size={15} />
              </button>
              <button
                title="Zoom arrière"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-600 hover:bg-paper-2"
                onClick={() => setCam((c) => ({ x: c.x - c.w * 0.125, y: c.y - c.h * 0.125, w: c.w * 1.25, h: c.h * 1.25 }))}
              >
                <Minus size={15} />
              </button>
              <button
                title="Voir tout le plan"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-600 hover:bg-paper-2"
                onClick={() => setCam({ x: 0, y: 0, w: vw, h: vh })}
              >
                <Maximize size={14} />
              </button>
            </div>
            <svg
              ref={svgRef}
              viewBox={`${cam.x} ${cam.y} ${cam.w} ${cam.h}`}
              className={`h-[560px] w-full touch-none select-none lg:h-[680px] ${tool === "select" ? "cursor-grab" : "cursor-crosshair"}`}
              preserveAspectRatio="xMidYMid meet"
              onWheel={(e) => {
                const p = pt(e);
                const f = e.deltaY > 0 ? 1.12 : 0.89;
                setCam({ x: p.x - (p.x - cam.x) * f, y: p.y - (p.y - cam.y) * f, w: cam.w * f, h: cam.h * f });
              }}
              onPointerDown={onBackground}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              <rect x={cam.x} y={cam.y} width={cam.w} height={cam.h} fill="#fbfcfa" />
              {floor.planImage && <image href={floor.planImage} width={vw} height={vh} opacity={0.5} />}
              {floor.rooms.map((r) => {
                const pts = pointsForRoom(r, scale);
                const c = centroid(pts);
                return (
                  <g key={r.id} pointerEvents="none">
                    <path d={polyPath(pts)} fill={r.color} fillOpacity={0.1} stroke={r.color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                    <text x={c.x} y={c.y} textAnchor="middle" fontSize={Math.max(10, cam.w / 70)} fill="#57534e" opacity={0.8}>
                      {r.name}
                    </text>
                  </g>
                );
              })}

              {/* Trajets des câbles */}
              {runs.map((r) => {
                const { d, marks, pos } = routePath(r);
                const active = selRun?.id === r.id;
                const color = RUN_TYPES[r.type].color;
                return (
                  <g key={r.id}>
                    {d && (
                      <>
                        {active && <path d={d} fill="none" stroke="#fff" strokeWidth={6} strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
                        <path
                          d={d}
                          fill="none"
                          stroke={color}
                          strokeWidth={active ? 3.5 : 2.2}
                          strokeDasharray={r.gaine ? undefined : "7 5"}
                          strokeLinejoin="round"
                          opacity={active ? 1 : 0.75}
                          vectorEffect="non-scaling-stroke"
                          className={tool === "select" ? "cursor-pointer" : ""}
                          onPointerDown={(e) => {
                            if (tool !== "select") return;
                            e.stopPropagation();
                            setSel({ k: "run", id: r.id });
                          }}
                        />
                      </>
                    )}
                    {marks.map((m, i) => (
                      <g key={i} pointerEvents="none">
                        <rect x={m.x - rad * 0.9} y={m.y - rad * 1.9} width={rad * 1.8} height={rad * 1.2} rx={3} fill={color} />
                        <text x={m.x} y={m.y - rad * 1.0} textAnchor="middle" fontSize={rad * 0.9} fill="#fff" fontWeight={700}>
                          ↕
                        </text>
                      </g>
                    ))}
                    {active &&
                      r.points.map((p, i) => {
                        if (p.deviceId) return null;
                        const q = pos[i];
                        if (!q) return null;
                        return (
                          <circle
                            key={i}
                            cx={q.x}
                            cy={q.y}
                            r={rad * 0.6}
                            fill="#fff"
                            stroke={color}
                            strokeWidth={2}
                            vectorEffect="non-scaling-stroke"
                            className={tool === "select" ? "cursor-move" : ""}
                            onPointerDown={(e) => {
                              if (tool !== "select") return;
                              e.stopPropagation();
                              try {
                                svgRef.current?.setPointerCapture(e.pointerId);
                              } catch {
                                /* ignore */
                              }
                              setDrag({ t: "wp", runId: r.id, i, x: q.x, y: q.y });
                            }}
                          />
                        );
                      })}
                  </g>
                );
              })}

              {/* Éléments */}
              {devices.map((d) => {
                const info = kindInfo(d.kind);
                const dd = drag?.t === "device" && drag.id === d.id ? drag : null;
                const x = dd ? dd.x : d.x;
                const y = dd ? dd.y : d.y;
                const active = sel?.k === "device" && sel.id === d.id;
                return (
                  <g
                    key={d.id}
                    className={tool === "select" ? "cursor-move" : "cursor-pointer"}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      try {
                        svgRef.current?.setPointerCapture(e.pointerId);
                      } catch {
                        /* ignore */
                      }
                      if (tool === "run") {
                        const run = selRun ?? createRun();
                        addRunPoint(run.id, { floorId: floor.id, x: d.x, y: d.y, deviceId: d.id });
                        return;
                      }
                      setSel({ k: "device", id: d.id });
                      if (tool === "select") setDrag({ t: "device", id: d.id, x: d.x, y: d.y });
                    }}
                  >
                    <circle cx={x} cy={y} r={rad} fill={info.color} stroke={active ? "#f97316" : "#fff"} strokeWidth={active ? 3 : 1.5} vectorEffect="non-scaling-stroke" />
                    <text x={x} y={y + rad * 0.35} textAnchor="middle" fontSize={rad * (info.short.length > 1 ? 0.85 : 1)} fill="#fff" fontWeight={700} pointerEvents="none">
                      {info.short}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          {!floor.rooms.length && !floor.planImage && (
            <p className="mt-2 text-xs text-amber-700">
              Cet étage n'a ni plan ni pièce : importez le plan et réglez l'échelle dans « Plans &amp; pièces » pour que les longueurs soient justes.
            </p>
          )}
          <p className="mt-2 text-[11px] text-stone-500">
            Échelle de cet étage : {fmtD(scale, 0)} px/m (réglée dans « Plans &amp; pièces »). Un câble qui change d'étage compte la hauteur entre les deux ;
            posez un point au même endroit (la trémie) sur chaque étage.
          </p>
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="font-display mb-2 text-base font-bold">Éléments à poser</h2>
            <div className="grid grid-cols-2 gap-1.5">
              {DEVICE_KINDS.map((k) => (
                <button
                  key={k.id}
                  onClick={() => {
                    setPlaceKind(k.id);
                    setTool("place");
                  }}
                  className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs ${placeKind === k.id && tool === "place" ? "border-terra bg-orange-50" : "border-rule"}`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: k.color }}>
                    {k.short}
                  </span>
                  <span className="leading-tight">{k.label}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-stone-400">
              Un interrupteur connecté est un interrupteur / poussoir : la différence (module) se règle dans l'onglet Électricité.
            </p>
          </Card>

          {selDev && (
            <Card>
              <h2 className="font-display mb-2 text-base font-bold">Élément sélectionné</h2>
              <div className="grid gap-2">
                <Field label="Type">
                  <Select
                    value={selDev.kind}
                    onChange={(e) => {
                      const kind = e.target.value as ElecDeviceKind;
                      const ent = allDevices.get(selDev.id)!;
                      setDevices(ent.floor.id, (ds) => ds.map((x) => (x.id === selDev.id ? { ...x, kind, z: defaultDeviceZ(kind, ent.floor) } : x)));
                    }}
                  >
                    {DEVICE_KINDS.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Hauteur au-dessus du sol" hint="Centre du boîtier — sert aux montées de câble.">
                  <Num
                    value={selDev.z}
                    suffix="m"
                    step={0.05}
                    onChange={(n) => {
                      const ent = allDevices.get(selDev.id)!;
                      setDevices(ent.floor.id, (ds) => ds.map((x) => (x.id === selDev.id ? { ...x, z: Math.max(0, n) } : x)));
                    }}
                  />
                </Field>
                <Btn variant="ghost" className="text-red-700" onClick={() => deleteDevice(selDev.id)}>
                  <Trash2 size={14} /> Supprimer l'élément
                </Btn>
              </div>
            </Card>
          )}

          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-base font-bold">Circuits ({runs.length})</h2>
              <Btn onClick={() => createRun()}>
                <Plus size={14} /> Nouveau
              </Btn>
            </div>
            {!runs.length && (
              <p className="text-xs text-stone-500">
                Un circuit = un câble qui relie des éléments, souvent en guirlande : tableau → prise 1 → prise 2… Choisissez « Tracer un câble »,
                cliquez sur le tableau, puis sur les points de passage (angles, plafond, trémie) et enfin sur chaque élément.
              </p>
            )}
            <ul className="space-y-1">
              {runs.map((r) => {
                const m = runTotals.get(r.id);
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => setSel({ k: "run", id: r.id })}
                      className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs ${selRun?.id === r.id ? "border-terra bg-orange-50" : "border-rule"}`}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: RUN_TYPES[r.type].color }} />
                      <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
                      <span className="font-mono text-stone-600">{m ? `${fmtD(m.cable, 1)} m` : "—"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {selRun && (
            <Card>
              <h2 className="font-display mb-2 text-base font-bold">Circuit sélectionné</h2>
              <div className="grid gap-2">
                <Field label="Nom">
                  <Input value={selRun.name} onChange={(e) => patchRun(selRun.id, { name: e.target.value })} />
                </Field>
                <Field label="Usage">
                  <Select
                    value={selRun.type}
                    onChange={(e) => {
                      const type = e.target.value as ElecRun["type"];
                      const t = RUN_TYPES[type];
                      patchRun(selRun.id, { type, section: t.section, gaineMm: t.gaineMm, routeMode: type === "eclairage" ? "plafond" : selRun.routeMode });
                    }}
                  >
                    {(Object.keys(RUN_TYPES) as ElecRun["type"][]).map((k) => (
                      <option key={k} value={k}>
                        {RUN_TYPES[k].label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Section câble">
                    <Select value={selRun.section} onChange={(e) => patchRun(selRun.id, { section: e.target.value as ElecRun["section"] })}>
                      <option value="1.5">1,5 mm²</option>
                      <option value="2.5">2,5 mm²</option>
                      <option value="6">6 mm²</option>
                    </Select>
                  </Field>
                  <Field label="Gaine ICTA">
                    <Select value={String(selRun.gaineMm)} onChange={(e) => patchRun(selRun.id, { gaineMm: Number(e.target.value) as ElecRun["gaineMm"] })}>
                      <option value="16">Ø16</option>
                      <option value="20">Ø20</option>
                      <option value="25">Ø25</option>
                    </Select>
                  </Field>
                </div>
                <Toggle value={selRun.gaine} onChange={(v) => patchRun(selRun.id, { gaine: v })} label="Sous gaine (trait plein) — sinon pointillé" />
                <Toggle value={selRun.ortho} onChange={(v) => patchRun(selRun.id, { ortho: v })} label="Angles droits entre deux points (suit les murs)" />
                <Field label="Hauteur de passage" hint="Où le câble chemine à l'horizontale entre deux éléments.">
                  <Select value={selRun.routeMode} onChange={(e) => patchRun(selRun.id, { routeMode: e.target.value as ElecRun["routeMode"] })}>
                    <option value="plafond">Sous plafond</option>
                    <option value="sol">Dans la chape / en plinthe (10 cm)</option>
                    <option value="custom">Hauteur libre…</option>
                  </Select>
                </Field>
                {selRun.routeMode === "custom" && (
                  <Field label="Hauteur libre">
                    <Num value={selRun.routeZ} suffix="m" step={0.05} onChange={(n) => patchRun(selRun.id, { routeZ: Math.max(0, n) })} />
                  </Field>
                )}
                {selMetrics && (
                  <div className="rounded-lg bg-paper p-2 text-xs leading-relaxed text-stone-700">
                    Trajet <strong>{fmtD(selMetrics.path, 1)} m</strong> (dont {fmtD(selMetrics.vertical, 1)} m en hauteur) + réserve{" "}
                    {fmtD(selMetrics.slack, 1)} m ({selMetrics.devices} boîtiers) = <strong>{fmtD(selMetrics.cable, 1)} m de câble</strong>
                    {selRun.gaine && <> · {fmtD(selMetrics.gaine, 1)} m de gaine</>}
                  </div>
                )}
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">Points du trajet ({selRun.points.length})</div>
                  <ol className="max-h-40 space-y-0.5 overflow-auto text-xs">
                    {selRun.points.map((p, i) => {
                      const ent = p.deviceId ? allDevices.get(p.deviceId) : undefined;
                      const fl = project.floors.find((f) => f.id === (ent?.floor.id ?? p.floorId));
                      return (
                        <li key={i} className="flex items-center gap-1.5">
                          <span className="w-5 text-right font-mono text-stone-400">{i + 1}</span>
                          <span className="min-w-0 flex-1 truncate">
                            {p.deviceId ? (ent ? kindInfo(ent.dev.kind).label : "Élément supprimé") : "Point de passage"}{" "}
                            <span className="text-stone-400">· {fl?.name}</span>
                          </span>
                          <button
                            title="Retirer ce point"
                            className="rounded p-0.5 text-red-700 hover:bg-red-50"
                            onClick={() => patchRun(selRun.id, { points: selRun.points.filter((_, j) => j !== i) })}
                          >
                            <Trash2 size={12} />
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Btn variant="ghost" onClick={() => patchRun(selRun.id, { points: selRun.points.slice(0, -1) })}>
                    <Undo2 size={14} /> Retirer le dernier
                  </Btn>
                  <Btn
                    variant="ghost"
                    className="text-red-700"
                    onClick={() => {
                      setElecRuns((rs) => rs.filter((r) => r.id !== selRun.id));
                      setSel(null);
                    }}
                  >
                    <Trash2 size={14} /> Supprimer le circuit
                  </Btn>
                </div>
              </div>
            </Card>
          )}

          <Card>
            <h2 className="font-display mb-2 text-base font-bold">Totaux mesurés sur le plan</h2>
            <div className="space-y-1 text-xs">
              {(["1.5", "2.5", "6"] as const).map((k) => (
                <div key={k} className="flex justify-between">
                  <span>Câble 3G{k.replace(".", ",")} mm²</span>
                  <span className="font-mono">{fmtD(totals.cable[k], 1)} m</span>
                </div>
              ))}
              {(["16", "20", "25"] as const).map((k) => (
                <div key={k} className="flex justify-between">
                  <span>Gaine ICTA Ø{k}</span>
                  <span className="font-mono">{fmtD(totals.gaine[k], 1)} m</span>
                </div>
              ))}
              {(totals.unassigned.cable > 0.05 || totals.unassigned.gaine > 0.05) && (
                <p className="pt-1 text-[10px] text-stone-400">
                  Dont {fmtD(totals.unassigned.cable, 1)} m de câble hors de toute pièce (couloir technique, trémie…) : compté au global, pas dans le récapitulatif par pièce.
                </p>
              )}
              <p className="pt-1 text-[10px] text-stone-400">
                Avant pertes ({S.wastePct} %) et marge de gaine ({S.gaineMarge} %), ajoutées au chiffrage.
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Field label="Réserve par boîtier">
                <Num value={S.slackPerEndM} suffix="m" step={0.05} onChange={(n) => patchSettings("elec", { ...S, slackPerEndM: Math.max(0, n) })} />
              </Field>
              <Field label="Épaisseur plancher">
                <Num value={S.slabM} suffix="m" step={0.05} onChange={(n) => patchSettings("elec", { ...S, slabM: Math.max(0, n) })} />
              </Field>
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <details>
          <summary className="cursor-pointer font-display text-base font-bold">Pose vs prévu, pièce par pièce</summary>
          <p className="mb-3 mt-2 text-xs text-stone-500">
            Compare ce que vous avez posé sur le plan avec les quantités de l'onglet Électricité (en points de la norme : une prise double = 2). Une
            différence n'est pas une erreur, mais un point non posé n'aura pas de câble en mode « plan ».
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.12em] text-stone-500">
                  <th className="py-1 pr-3">Pièce</th>
                  {["Prises", "Interrupteurs", "Lumières", "Réseau / TV"].map((h) => (
                    <th key={h} className="px-2 py-1 text-right">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coverage.map(({ room, floor: f, rows }) => (
                  <tr key={room.id} className="border-t border-rule">
                    <td className="py-1.5 pr-3">
                      {room.name} <span className="text-stone-400">· {f.name}</span>
                    </td>
                    {rows.map(([label, placed, wanted]) => (
                      <td
                        key={label}
                        className={`px-2 py-1.5 text-right font-mono ${placed === wanted ? "text-forest" : placed < wanted ? "text-amber-700" : "text-stone-600"}`}
                      >
                        {placed} / {wanted}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Card>
    </div>
  );
}
