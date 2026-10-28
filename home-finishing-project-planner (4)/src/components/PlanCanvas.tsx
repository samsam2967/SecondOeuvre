import { useEffect, useRef, useState } from "react";
import { ImagePlus, Pentagon, Ruler, Square, ScanSearch, MousePointer2, Plus, Minus, Maximize } from "lucide-react";
import type { Floor, Pt } from "../types";
import { fmtD } from "../utils/format";
import {
  closestEdge,
  dist,
  insertOnEdge,
  pointsForRoom,
  polyPath,
  removeVertex,
  setEdgeLength,
  setVertex,
  svgCoords,
  translate,
} from "../utils/geometry";
import { centroid } from "../utils/geometry";
import { roomEdges } from "../utils/surfaces";

export type PlanTool = "select" | "poly" | "rect" | "scale";

export function PlanCanvas({
  floor,
  tool,
  setTool,
  sel,
  setSel,
  hoveredEdge,
  onCreate,
  onPatch,
  onScale,
  onImport,
  onReanalyze,
  busy,
  opacity,
  setOpacity,
}: {
  floor: Floor;
  tool: PlanTool;
  setTool: (t: PlanTool) => void;
  sel: { kind: "room" | "part"; id: string } | null;
  setSel: (s: { kind: "room" | "part"; id: string } | null) => void;
  hoveredEdge?: number | null;
  onCreate: (pts: Pt[]) => void;
  onPatch: (id: string, pts: Pt[]) => void;
  onScale: (px: number, meters: number) => void;
  onImport: (src: string) => void;
  onReanalyze: () => void;
  busy: boolean;
  opacity: number;
  setOpacity: (n: number) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Pt[]>([]);
  const [rect, setRect] = useState<{ a: Pt; b: Pt } | null>(null);
  const [scalePts, setScalePts] = useState<Pt[]>([]);
  const [scaleVal, setScaleVal] = useState("4.50");
  const [moving, setMoving] = useState<{ id: string; last: Pt } | null>(null);
  const [dragV, setDragV] = useState<{ id: string; i: number } | null>(null);
  const [edgeEdit, setEdgeEdit] = useState<{ id: string; edge: number; value: string } | null>(null);
  const vw = floor.planWidth || 1000;
  const vh = floor.planHeight || 700;
  const [cam, setCam] = useState({ x: 0, y: 0, w: vw, h: vh });
  const scale = floor.planScale || 40;

  // Gestes tactiles : suivi des doigts, pincement pour zoomer, glisser pour déplacer.
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<null | { d0: number; cam0: { x: number; y: number; w: number; h: number }; p0: Pt; mid0: { x: number; y: number } }>(null);
  const panRef = useRef<null | { x: number; y: number }>(null);

  const unitsPerPx = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !r.width || !r.height) return cam.w / 800;
    return Math.max(cam.w / r.width, cam.h / r.height);
  };

  const startPinch = () => {
    const pts = [...pointersRef.current.values()];
    if (pts.length < 2 || !ref.current) return;
    const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    pinchRef.current = {
      d0: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
      cam0: { ...cam },
      p0: svgCoords(ref.current, mid.x, mid.y),
      mid0: mid,
    };
    setMoving(null);
    setDragV(null);
    setRect(null);
    panRef.current = null;
  };

  const track = (e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      ref.current?.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (pointersRef.current.size === 2) startPinch();
  };

  const releasePointer = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) {
      if (rect) {
        const x = Math.min(rect.a.x, rect.b.x);
        const y = Math.min(rect.a.y, rect.b.y);
        const w = Math.abs(rect.b.x - rect.a.x);
        const h = Math.abs(rect.b.y - rect.a.y);
        if (w > 8 && h > 8) onCreate([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }]);
        setRect(null);
      }
      setMoving(null);
      setDragV(null);
      panRef.current = null;
    }
  };

  const zoomBy = (f: number) => {
    setCam((c) => {
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2;
      const nw = Math.min(Math.max(c.w * f, vw / 60), vw * 12);
      const k = nw / c.w;
      return { x: cx - (cx - c.x) * k, y: cy - (cy - c.y) * k, w: nw, h: c.h * k };
    });
  };

  useEffect(() => {
    setCam({ x: 0, y: 0, w: vw, h: vh });
  }, [vw, vh, floor.planImage]);

  const pt = (e: { clientX: number; clientY: number }) => {
    const svg = ref.current;
    if (!svg) return { x: 0, y: 0 };
    return svgCoords(svg, e.clientX, e.clientY);
  };

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDraft([]);
        setRect(null);
        setScalePts([]);
      }
      if (e.key === "Enter" && draft.length >= 3) {
        onCreate(draft);
        setDraft([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft, onCreate]);

  const commitScale = () => {
    if (scalePts.length < 2) return;
    const d = dist(scalePts[0], scalePts[1]);
    const meters = parseFloat(scaleVal.replace(",", ".")) || 0;
    onScale(d, meters);
    setScalePts([]);
    setTool("select");
  };

  return (
    <div
      ref={wrap}
      className="relative overflow-hidden rounded-2xl border border-rule bg-paper shadow-[inset_0_1px_0_#fff,0_12px_30px_-18px_rgba(28,25,23,0.4)]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (!file || !file.type.startsWith("image/")) return;
        const reader = new FileReader();
        reader.onload = () => onImport(String(reader.result));
        reader.readAsDataURL(file);
      }}
    >
      <div className="absolute left-3 top-3 z-10 flex flex-col gap-1 rounded-2xl border border-rule bg-white/95 p-1.5 shadow-lg">
        <IconBtn active={tool === "select"} onClick={() => setTool("select")} title="Sélection">
          <MousePointer2 size={16} />
        </IconBtn>
        <IconBtn active={tool === "poly"} onClick={() => setTool("poly")} title="Polygone">
          <Pentagon size={16} />
        </IconBtn>
        <IconBtn active={tool === "rect"} onClick={() => setTool("rect")} title="Rectangle">
          <Square size={16} />
        </IconBtn>
        <IconBtn active={tool === "scale"} onClick={() => setTool("scale")} title="Cote / échelle">
          <Ruler size={16} />
        </IconBtn>
        <div className="my-1 h-px bg-rule" />
        <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-stone-600 hover:bg-paper-2" title="Importer un plan">
          <ImagePlus size={16} />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => onImport(String(reader.result));
              reader.readAsDataURL(file);
            }}
          />
        </label>
        {floor.planImage && (
          <IconBtn active={false} onClick={onReanalyze} title="Relancer l'analyse">
            <ScanSearch size={16} />
          </IconBtn>
        )}
      </div>

      <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-full border border-rule bg-white/95 px-3 py-1.5 text-[11px] font-medium text-stone-500 shadow">
        Plan
        <input
          type="range"
          min={15}
          max={100}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="w-20 accent-terra"
        />
        {fmtD(scale, 0)} px/m
      </div>

      {!floor.planImage && (
        <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
          <div className="rounded-2xl border border-dashed border-rule bg-white/80 px-8 py-10 text-center">
            <ImagePlus className="mx-auto mb-3 text-stone-400" />
            <div className="text-sm font-semibold text-stone-700">Déposez votre plan ici</div>
            <div className="mt-1 text-xs text-stone-400">PNG, JPG — les pièces sont créées automatiquement</div>
          </div>
        </div>
      )}

      {busy && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 text-sm font-semibold text-stone-700">
          Analyse du plan — lecture des pièces…
        </div>
      )}

      <svg
        ref={ref}
        viewBox={`${cam.x} ${cam.y} ${cam.w} ${cam.h}`}
        className="h-[420px] w-full cursor-crosshair touch-none select-none sm:h-[540px] lg:h-[620px]"
        preserveAspectRatio="xMidYMid meet"
        onWheel={(e) => {
          e.preventDefault();
          const p = pt(e);
          const f = e.deltaY > 0 ? 1.12 : 0.89;
          const nw = cam.w * f;
          const nh = cam.h * f;
          const nx = p.x - (p.x - cam.x) * f;
          const ny = p.y - (p.y - cam.y) * f;
          setCam({ x: nx, y: ny, w: nw, h: nh });
        }}
        onPointerDown={(e) => {
          track(e);
          if (pinchRef.current) return;
          if (e.button === 1 || e.altKey || e.shiftKey) {
            panRef.current = { x: e.clientX, y: e.clientY };
            return;
          }
          const p = pt(e);
          if (tool === "select") {
            // Fond du plan : glisser pour déplacer (souris et doigt).
            panRef.current = { x: e.clientX, y: e.clientY };
            return;
          }
          if (tool === "poly") {
            if (draft.length >= 3 && dist(p, draft[0]) < Math.max(10, cam.w / 80)) {
              onCreate(draft);
              setDraft([]);
            } else setDraft([...draft, p]);
            return;
          }
          if (tool === "rect") setRect({ a: p, b: p });
          if (tool === "scale") {
            const next = [...scalePts, p].slice(-2);
            setScalePts(next);
          }
        }}
        onPointerMove={(e) => {
          if (pointersRef.current.has(e.pointerId)) {
            pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          }
          const pinch = pinchRef.current;
          if (pinch && pointersRef.current.size >= 2) {
            const pts = [...pointersRef.current.values()];
            const d1 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
            const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
            let f = pinch.d0 / d1;
            const nw = Math.min(Math.max(pinch.cam0.w * f, vw / 60), vw * 12);
            f = nw / pinch.cam0.w;
            const r = ref.current?.getBoundingClientRect();
            const upp = r && r.width ? Math.max(nw / r.width, (pinch.cam0.h * f) / r.height) : nw / 800;
            const nx = pinch.p0.x - (pinch.p0.x - pinch.cam0.x) * f - (mid.x - pinch.mid0.x) * upp;
            const ny = pinch.p0.y - (pinch.p0.y - pinch.cam0.y) * f - (mid.y - pinch.mid0.y) * upp;
            setCam({ x: nx, y: ny, w: nw, h: pinch.cam0.h * f });
            return;
          }
          const p = pt(e);
          if (panRef.current) {
            const dx = e.clientX - panRef.current.x;
            const dy = e.clientY - panRef.current.y;
            const upp = unitsPerPx();
            setCam((c) => ({ ...c, x: c.x - dx * upp, y: c.y - dy * upp }));
            panRef.current = { x: e.clientX, y: e.clientY };
            return;
          }
          if (rect) setRect({ ...rect, b: p });
          if (moving) {
            const r = floor.rooms.find((x) => x.id === moving.id);
            if (r) onPatch(moving.id, translate(pointsForRoom(r, scale), p.x - moving.last.x, p.y - moving.last.y));
            setMoving({ ...moving, last: p });
          }
          if (dragV) {
            const r = floor.rooms.find((x) => x.id === dragV.id);
            if (r) onPatch(dragV.id, setVertex(pointsForRoom(r, scale), dragV.i, p));
          }
        }}
        onPointerUp={releasePointer}
        onPointerCancel={releasePointer}
      >
        <rect x={cam.x} y={cam.y} width={cam.w} height={cam.h} fill="#fbfcfa" />
        {floor.planImage && (
          <image href={floor.planImage} width={vw} height={vh} opacity={opacity / 100} />
        )}
        {floor.rooms.map((r) => {
          const pts = pointsForRoom(r, scale);
          const active = sel?.id === r.id;
          const c = centroid(pts);
          const fs = Math.max(11, Math.min(22, cam.w / 55));
          const edgesInfo = active ? roomEdges(r, scale) : [];
          return (
            <g key={r.id}>
              <path
                d={polyPath(pts)}
                fill={r.color}
                fillOpacity={active ? 0.28 : 0.16}
                stroke={r.color}
                strokeWidth={active ? 2.4 : 1.5}
                vectorEffect="non-scaling-stroke"
                className="cursor-pointer"
                onPointerDown={(e) => {
                  if (tool !== "select") return;
                  e.stopPropagation();
                  track(e);
                  if (pinchRef.current) return;
                  setSel({ kind: "room", id: r.id });
                  setMoving({ id: r.id, last: pt(e) });
                }}
                onDoubleClick={(e) => {
                  if (tool !== "select") return;
                  e.stopPropagation();
                  const hit = closestEdge(pts, pt(e));
                  if (hit.dist < cam.w / 40) onPatch(r.id, insertOnEdge(pts, hit.edge, hit.hit));
                }}
              />
              {/* État des parois de la pièce sélectionnée : extérieur (vert), passage (pointillé), survol (jaune) */}
              {active &&
                edgesInfo.map((ei) => {
                  const p = pts[ei.index];
                  const q = pts[(ei.index + 1) % pts.length];
                  const hovered = hoveredEdge === ei.index;
                  return (
                    <g key={`st-${ei.index}`}>
                      {ei.exterior && !ei.passage && (
                        <line
                          x1={p.x} y1={p.y} x2={q.x} y2={q.y}
                          stroke="#3f6b52"
                          strokeWidth={6}
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                          opacity={0.85}
                        />
                      )}
                      {ei.passage && (
                        <line
                          x1={p.x} y1={p.y} x2={q.x} y2={q.y}
                          stroke="#b45309"
                          strokeWidth={4}
                          strokeDasharray="10 7"
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                          opacity={0.9}
                        />
                      )}
                      {hovered && (
                        <line
                          x1={p.x} y1={p.y} x2={q.x} y2={q.y}
                          stroke="#f2c230"
                          strokeWidth={9}
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                          opacity={0.95}
                        />
                      )}
                    </g>
                  );
                })}
              {pts.map((p, i) => {
                const q = pts[(i + 1) % pts.length];
                const mx = (p.x + q.x) / 2;
                const my = (p.y + q.y) / 2;
                const lenM = dist(p, q) / scale;
                const ang = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
                const rot = ang > 90 || ang < -90 ? ang + 180 : ang;
                if (lenM < 0.35) return null;
                return (
                  <g key={i} transform={`translate(${mx}, ${my}) rotate(${rot})`}>
                    <line x1={-8} y1={-6} x2={-8} y2={6} stroke={r.color} strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.7} />
                    <line x1={8} y1={-6} x2={8} y2={6} stroke={r.color} strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.7} />
                    <text
                      y={-8}
                      textAnchor="middle"
                      fontSize={Math.max(9, fs * 0.72)}
                      fontFamily="IBM Plex Mono"
                      fill="#1d211c"
                      className="cursor-pointer"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        track(e);
                        setSel({ kind: "room", id: r.id });
                        setEdgeEdit({ id: r.id, edge: i, value: lenM.toFixed(2) });
                      }}
                    >
                      {fmtD(lenM, 2)}
                    </text>
                    {/* Numéro de paroi, visible quand la pièce est sélectionnée */}
                    {active && (
                      <g className="pointer-events-none">
                        <rect
                          x={-fs * 0.85}
                          y={fs * 0.35}
                          width={fs * 1.7}
                          height={fs * 1.05}
                          rx={fs * 0.25}
                          fill={hoveredEdge === i ? "#f2c230" : "#1d211c"}
                        />
                        <text
                          y={fs * 1.12}
                          textAnchor="middle"
                          fontSize={fs * 0.68}
                          fontFamily="IBM Plex Mono"
                          fontWeight={700}
                          fill={hoveredEdge === i ? "#1d211c" : "#ffffff"}
                        >
                          P{i + 1}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
              <g className="pointer-events-none">
                <rect
                  x={c.x - fs * 3.4}
                  y={c.y - fs * 1.35}
                  width={fs * 6.8}
                  height={fs * 2.7}
                  rx={fs * 0.45}
                  fill="white"
                  fillOpacity={0.92}
                  stroke={r.color}
                  strokeWidth={1.2}
                  vectorEffect="non-scaling-stroke"
                />
                <text x={c.x} y={c.y - 2} textAnchor="middle" fontSize={fs} fontFamily="Barlow Condensed, sans-serif" fontWeight={700} fill="#1d211c">
                  {r.name}
                </text>
                <text x={c.x} y={c.y + fs * 0.95} textAnchor="middle" fontSize={fs * 0.72} fontFamily="IBM Plex Mono" fill="#6b736a">
                  {fmtD(r.areaM2 || r.length * r.width, 1)} m²
                </text>
              </g>
              {active &&
                pts.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={Math.max(7, cam.w / 110)}
                    fill="#fff"
                    stroke={r.color}
                    strokeWidth={2}
                    className="cursor-nwse-resize"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      track(e);
                      if (pinchRef.current) return;
                      setSel({ kind: "room", id: r.id });
                      setDragV({ id: r.id, i });
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onPatch(r.id, removeVertex(pts, i));
                    }}
                  />
                ))}
            </g>
          );
        })}
        {draft.length > 0 && (
          <polyline
            points={draft.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="#23271f"
            strokeDasharray="6 4"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        )}
        {rect && (
          <rect
            x={Math.min(rect.a.x, rect.b.x)}
            y={Math.min(rect.a.y, rect.b.y)}
            width={Math.abs(rect.b.x - rect.a.x)}
            height={Math.abs(rect.b.y - rect.a.y)}
            fill="#23271f"
            fillOpacity={0.1}
            stroke="#23271f"
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {scalePts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={5} fill="#23271f" />
        ))}
        {scalePts.length === 2 && (
          <line x1={scalePts[0].x} y1={scalePts[0].y} x2={scalePts[1].x} y2={scalePts[1].y} stroke="#23271f" strokeWidth={2} />
        )}
      </svg>

      {scalePts.length === 2 && (
        <form
          className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-rule bg-white px-3 py-2 shadow-xl"
          onSubmit={(e) => {
            e.preventDefault();
            commitScale();
          }}
        >
          <span className="text-xs font-semibold text-stone-600">Longueur réelle</span>
          <input
            autoFocus
            value={scaleVal}
            onChange={(e) => setScaleVal(e.target.value)}
            className="w-20 rounded-lg border border-rule px-2 py-1 font-mono text-sm"
          />
          <span className="text-xs">m</span>
          <button type="submit" className="rounded-full bg-terra px-3 py-1 text-xs font-semibold text-white">
            Caler l'échelle
          </button>
        </form>
      )}

      {edgeEdit && (
        <form
          className="absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-full border border-rule bg-white px-3 py-2 shadow-xl"
          onSubmit={(e) => {
            e.preventDefault();
            const r = floor.rooms.find((x) => x.id === edgeEdit.id);
            if (r) {
              const meters = parseFloat(edgeEdit.value.replace(",", ".")) || 0;
              const pts = pointsForRoom(r, scale);
              onPatch(r.id, setEdgeLength(pts, edgeEdit.edge, meters * scale));
            }
            setEdgeEdit(null);
          }}
        >
          <span className="text-xs font-semibold text-stone-600">Paroi</span>
          <input
            autoFocus
            className="w-20 rounded-lg border border-rule px-2 py-1 font-mono text-sm"
            value={edgeEdit.value}
            onChange={(e) => setEdgeEdit({ ...edgeEdit, value: e.target.value })}
          />
          <span className="text-xs">m</span>
          <button type="submit" className="rounded-full bg-terra px-3 py-1 text-xs font-semibold text-white">
            OK
          </button>
        </form>
      )}

      <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1 rounded-xl border border-rule bg-white/95 p-1 shadow-lg">
        <button
          onClick={() => zoomBy(0.8)}
          title="Zoom avant"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-600 transition hover:bg-paper-2"
        >
          <Plus size={15} />
        </button>
        <button
          onClick={() => zoomBy(1.25)}
          title="Zoom arrière"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-600 transition hover:bg-paper-2"
        >
          <Minus size={15} />
        </button>
        <button
          onClick={() => setCam({ x: 0, y: 0, w: vw, h: vh })}
          title="Voir tout le plan"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-600 transition hover:bg-paper-2"
        >
          <Maximize size={14} />
        </button>
      </div>
      {sel?.kind === "room" && (
        <div className="pointer-events-none absolute left-3 top-16 z-10 mt-2 flex flex-col gap-1 rounded-lg border border-rule bg-white/95 px-2.5 py-2 text-[10px] text-stone-600 shadow lg:top-3 lg:left-auto lg:right-3 lg:mt-12">
          <div className="flex items-center gap-1.5">
            <span className="h-1 w-5 rounded-full bg-forest" /> Mur extérieur (isolé + doublé)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-0 w-5 border-t-2 border-dashed border-amber-600" /> Passage (sans placo)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex h-3.5 w-5 items-center justify-center rounded bg-ink font-mono text-[8px] font-bold text-white">P1</span>
            Numéro de paroi (voir panneau)
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute bottom-3 left-3 hidden text-[10px] text-stone-400 sm:block">
        Molette : zoom · glisser le fond : déplacer
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 text-[10px] text-stone-400 sm:hidden">
        2 doigts : zoom · glisser : déplacer
      </div>
    </div>
  );
}

function IconBtn({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? "bg-terra text-white" : "text-stone-600 hover:bg-paper-2"}`}
    >
      {children}
    </button>
  );
}
