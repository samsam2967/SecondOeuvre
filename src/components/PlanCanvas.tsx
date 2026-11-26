import { useEffect, useRef, useState } from "react";
import { ImagePlus, Pentagon, Ruler, Square, ScanSearch, MousePointer2, Plus, Minus, Maximize, Undo2, CirclePlus, CircleMinus, Hand } from "lucide-react";
import { useStore } from "../store";
import { ISOLANTS } from "../data/catalogs";
import { sharedWalls, wallInsulated } from "../utils/adjacency";
import { PLACO_T, wallGeometry } from "../utils/wallLayers";
import { isolantColor } from "../utils/scene3d";
import type { Floor, Pt, Stair } from "../types";
import { stairBoxes, stairBoxPoly, stairToPlan } from "../utils/stairs";
import { fmtD } from "../utils/format";
import {
  closestEdge,
  dist,
  edgeAxis,
  snapVertex,
  vertexAngle,
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
import { OPENING_COLOR, openingSpan, placeOpenings, snapToEdge } from "../utils/openings";

function pointInPoly(p: Pt, poly: Pt[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export type PlanTool = "hand" | "select" | "poly" | "rect" | "scale" | "addpt" | "delpt";

export function PlanCanvas({
  floor,
  tool: toolProp,
  setTool,
  sel,
  setSel,
  hoveredEdge,
  selOpening,
  setSelOpening,
  onMoveOpening,
  selStair,
  setSelStair,
  onMoveStair,
  onSettle,
  onInsertPoint,
  onRemovePoint,
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
  /** Ouverture (porte, fenêtre, passage…) sélectionnée, déplaçable le long des parois de la pièce sélectionnée. */
  selOpening?: string | null;
  setSelOpening?: (id: string | null) => void;
  onMoveOpening?: (roomId: string, openingId: string, edge: number, t: number) => void;
  /** Escalier sélectionné (déplaçable à la souris, réglé dans le panneau « Escaliers »). */
  selStair?: string | null;
  setSelStair?: (id: string | null) => void;
  onMoveStair?: (id: string, dxPx: number, dyPx: number) => void;
  /** Appelé après chaque modification de pièce : alignement des coins et détection des cloisons communes. */
  onSettle?: () => void;
  /** Ajout d'un point sur une paroi en conservant les ouvertures et réglages des parois. */
  onInsertPoint?: (roomId: string, edge: number, pt: Pt) => void;
  /** Suppression d'un point en renumérotant les parois. */
  onRemovePoint?: (roomId: string, index: number) => void;
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
  const [moving, setMoving] = useState<{ id: string; last: Pt; start: Pt; pts0: Pt[] } | null>(null);
  const [dragV, setDragV] = useState<{ id: string; i: number } | null>(null);
  const [dragO, setDragO] = useState<{ roomId: string; id: string } | null>(null);
  const [dragS, setDragS] = useState<{ id: string; last: Pt } | null>(null);
  const { undo, canUndo, project, patchSettings } = useStore();
  // Barre d'espace maintenue : on déplace le plan (comme l'outil « main »), quel que soit l'outil choisi
  const [spaceDown, setSpaceDown] = useState(false);
  const tool: PlanTool = spaceDown ? "hand" : toolProp;
  useEffect(() => {
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || typing(e.target)) return;
      e.preventDefault();
      setSpaceDown(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
    };
    const blur = () => setSpaceDown(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
  const [aimant, setAimant] = useState(true);
  const [snapRoomsOn, setSnapRoomsOn] = useState(true);
  const [showLen, setShowLen] = useState(false);
  const [snapMark, setSnapMark] = useState<{ p: Pt; kind: "vertex" | "edge" | "axis" } | null>(null);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [clickRemove, setClickRemove] = useState(true);
  const vDown = useRef<null | { id: string; i: number; x: number; y: number; moved: boolean }>(null);
  const [hint, setHint] = useState("");
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
    setDragO(null);
    setDragS(null);
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
    const vd = vDown.current;
    vDown.current = null;
    if (vd && !vd.moved && (clickRemove || tool === "delpt")) {
      const r = floor.rooms.find((x) => x.id === vd.id);
      if (r) {
        const pts0 = pointsForRoom(r, scale);
        if (pts0.length <= 3) setHint("Une pièce doit garder au moins 3 points.");
        else if (onRemovePoint) onRemovePoint(vd.id, vd.i);
        else onPatch(vd.id, removeVertex(pts0, vd.i));
      }
    }
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) {
      if (moving || dragV || rect) window.setTimeout(() => onSettle?.(), 80);
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
      setDragO(null);
      setDragS(null);
      setSnapMark(null);
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

  // ---- Aimant sur les pièces voisines : plus de vide ni de recouvrement entre deux pièces ----
  const projectOnSeg = (p: Pt, a: Pt, b: Pt): Pt => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    if (l2 < 1e-9) return a;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    return { x: a.x + dx * t, y: a.y + dy * t };
  };
  const otherPolys = (skip?: string) => floor.rooms.filter((r) => r.id !== skip).map((r) => pointsForRoom(r, scale));
  /** Colle un point sur un sommet, puis sur une paroi, puis sur l'alignement (x ou y) des pièces voisines. */
  const snapRooms = (p: Pt, skip?: string, extra: Pt[] = []): { p: Pt; kind: "vertex" | "edge" | "axis" | null } => {
    if (!snapRoomsOn) return { p, kind: null };
    const tol = unitsPerPx() * 11;
    const polys = otherPolys(skip);
    let best: { p: Pt; d: number } | null = null;
    for (const pts of polys) for (const v of pts) {
      const d = dist(p, v);
      if (d < tol && (!best || d < best.d)) best = { p: v, d };
    }
    for (const v of extra) {
      const d = dist(p, v);
      if (d < tol && (!best || d < best.d)) best = { p: v, d };
    }
    if (best) return { p: best.p, kind: "vertex" };
    for (const pts of polys) for (let i = 0; i < pts.length; i++) {
      const q = projectOnSeg(p, pts[i], pts[(i + 1) % pts.length]);
      const d = dist(p, q);
      if (d < tol && (!best || d < best.d)) best = { p: q, d };
    }
    if (best) return { p: best.p, kind: "edge" };
    const q = { ...p };
    let hit = false;
    for (const v of [...polys.flat(), ...extra]) {
      if (Math.abs(p.x - v.x) < tol * 0.7) { q.x = v.x; hit = true; }
      if (Math.abs(p.y - v.y) < tol * 0.7) { q.y = v.y; hit = true; }
    }
    return hit ? { p: q, kind: "axis" } : { p, kind: null };
  };
  /** Décalage à appliquer à une pièce que l'on déplace pour qu'elle vienne se coller à ses voisines. */
  const snapMoveOffset = (pts: Pt[], skip: string): { dx: number; dy: number } | null => {
    if (!snapRoomsOn) return null;
    const tol = unitsPerPx() * 11;
    const polys = otherPolys(skip);
    let best: { dx: number; dy: number; d: number } | null = null;
    const consider = (from: Pt, to: Pt) => {
      const d = dist(from, to);
      if (d < tol && (!best || d < best.d)) best = { dx: to.x - from.x, dy: to.y - from.y, d };
    };
    for (const v of pts) for (const op of polys) for (const w of op) consider(v, w); // sommet sur sommet
    if (best) return best;
    for (const v of pts) for (const op of polys) for (let i = 0; i < op.length; i++) consider(v, projectOnSeg(v, op[i], op[(i + 1) % op.length])); // sommet sur paroi voisine
    for (const op of polys) for (const w of op) for (let i = 0; i < pts.length; i++) consider(projectOnSeg(w, pts[i], pts[(i + 1) % pts.length]), w); // sommet voisin sur ma paroi
    return best;
  };

  // ---- Couches des murs, toujours visibles : brique, isolant des murs extérieurs, cloisons et leur isolant ----
  const isoList = project.settings.isolants?.length ? project.settings.isolants : ISOLANTS;
  const murIso = isoList.find((i) => i.id === project.settings.isolation.isolantMurId) ?? isoList[0];
  const cloIso = isoList.find((i) => i.id === project.settings.isolation.isolantCloisonId) ?? isoList[0];
  const briqueMm = project.settings.briqueMm ?? 200;
  const C_BRIQUE = "#b4553a";
  const C_MUR_ISO = isolantColor(murIso?.name ?? "", !!murIso?.bio);
  let C_CLO_ISO = isolantColor(cloIso?.name ?? "", !!cloIso?.bio);
  if (C_CLO_ISO === C_MUR_ISO) C_CLO_ISO = "#5fa8d3";
  const C_PLACO = "#e9e6df";
  const strip = (a: Pt, b: Pt, nx: number, ny: number, d0: number, d1: number) =>
    `M${a.x + nx * d0} ${a.y + ny * d0} L${b.x + nx * d0} ${b.y + ny * d0} L${b.x + nx * d1} ${b.y + ny * d1} L${a.x + nx * d1} ${a.y + ny * d1} Z`;
  const wallLayers = () => {
    const out: React.ReactNode[] = [];
    const tPlaco = 0.013 * scale;
    const tIso = ((murIso?.thickness ?? 100) / 1000) * scale;
    const tBrique = (briqueMm / 1000) * scale;
    const tCloIso = ((cloIso?.thickness ?? 70) / 1000) * scale;
    // murs extérieurs : de l'intérieur vers l'extérieur = placo, isolant, brique (ou plaque si mur sans brique)
    // les couches de deux murs voisins se rejoignent en biseau (onglet) à chaque coin
    for (const r of floor.rooms) {
      const g = wallGeometry(r, scale);
      const { pts, info, U, corner } = g;
      const n = pts.length;
      if (n < 3) continue;
      const band = (i: number, d0: number, d1: number) => {
        const s0 = corner(i, false, d0);
        const e0 = corner(i, true, d0);
        const e1 = corner(i, true, d1);
        const s1 = corner(i, false, d1);
        return `M${s0.x} ${s0.y} L${e0.x} ${e0.y} L${e1.x} ${e1.y} L${s1.x} ${s1.y} Z`;
      };
      pts.forEach((a, i) => {
        const e = info[i];
        const b = pts[(i + 1) % n];
        if (!e || U[i].len < 1e-6) return;
        if (e.exterior) {
          const openWall = r.wallTypes?.[String(i)] === "none";
          if (e.passage) {
            // mur brut ou paroi sans placo : on dessine la brique seule (rien n'est compté pour l'isolant ni le placo)
            if (!openWall) out.push(<path key={`bn${r.id}${i}`} d={band(i, 0, tBrique)} fill={C_BRIQUE} stroke="#7c2d12" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />);
          } else {
            const d = tPlaco;
            out.push(<path key={`p${r.id}${i}`} d={band(i, 0, tPlaco)} fill={C_PLACO} stroke="#9ca3af" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />);
            out.push(<path key={`i${r.id}${i}`} d={band(i, d, d + tIso)} fill={C_MUR_ISO} stroke="#6b7280" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />);
            if (r.wallStruct?.[String(i)] === "ossature") {
              out.push(<path key={`o${r.id}${i}`} d={band(i, d + tIso, d + tIso + tPlaco)} fill={C_PLACO} stroke="#9ca3af" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />);
            } else {
              out.push(<path key={`b${r.id}${i}`} d={band(i, d + tIso, d + tIso + tBrique)} fill={C_BRIQUE} stroke="#7c2d12" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />);
            }
            if (showLen) {
              // longueurs comptées : placo = face intérieure ; isolant = milieu de son épaisseur (plus long aux angles saillants)
              const dOut = d + tIso + (r.wallStruct?.[String(i)] === "ossature" ? tPlaco : tBrique) + 0.12 * scale;
              const c0 = corner(i, false, dOut);
              const c1 = corner(i, true, dOut);
              const faceM = e.lengthM;
              const isoM = g.lenM(i, PLACO_T + (murIso?.thickness ?? 100) / 2000);
              const fs = Math.max(9, cam.w / 120);
              out.push(
                <text key={`len${r.id}${i}`} x={(c0.x + c1.x) / 2} y={(c0.y + c1.y) / 2} textAnchor="middle" fontSize={fs} fontFamily="IBM Plex Mono" fontWeight={700} fill="#1f2937" stroke="#fff" strokeWidth={fs / 4} paintOrder="stroke">
                  {`placo ${faceM.toFixed(2).replace(".", ",")} · isolant ${isoM.toFixed(2).replace(".", ",")} m`}
                </text>,
              );
            }
          }
        }
        if (e.passage && e.exterior && r.wallStruct?.[String(i)] !== "nu") {
          out.push(<line key={`np${r.id}${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#dc2626" strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />);
        }
      });
    }
    // cloisons entre deux pièces : placo, isolant de cloison (ou ossature vide), placo — centrées sur la limite commune
    for (const w of sharedWalls(floor)) {
      const A = floor.rooms.find((x) => x.id === w.roomAId);
      if (!A) continue;
      const len = Math.hypot(w.p1.x - w.p0.x, w.p1.y - w.p0.y);
      if (len < 1e-6) continue;
      const nx = (w.p1.y - w.p0.y) / len;
      const ny = -(w.p1.x - w.p0.x) / len;
      if (w.passage) {
        out.push(<line key={`pas${w.roomAId}${w.edgeA}${w.roomBId}${w.edgeB}`} x1={w.p0.x} y1={w.p0.y} x2={w.p1.x} y2={w.p1.y} stroke="#dc2626" strokeWidth={2.5} strokeDasharray="2 5" vectorEffect="non-scaling-stroke" />);
        continue;
      }
      const ins = wallInsulated(floor, w);
      const core = ins ? tCloIso : (70 / 1000) * scale;
      const T = core + 2 * tPlaco;
      const k = `c${w.roomAId}${w.edgeA}${w.roomBId}${w.edgeB}`;
      out.push(<path key={`${k}a`} d={strip(w.p0, w.p1, nx, ny, -T / 2, -T / 2 + tPlaco)} fill={C_PLACO} stroke="#9ca3af" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />);
      out.push(<path key={`${k}c`} d={strip(w.p0, w.p1, nx, ny, -T / 2 + tPlaco, T / 2 - tPlaco)} fill={ins ? C_CLO_ISO : "#ffffff"} stroke={ins ? "#475569" : "#9ca3af"} strokeDasharray={ins ? undefined : "3 2"} strokeWidth={0.7} vectorEffect="non-scaling-stroke" />);
      out.push(<path key={`${k}b`} d={strip(w.p0, w.p1, nx, ny, T / 2 - tPlaco, T / 2)} fill={C_PLACO} stroke="#9ca3af" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />);
    }
    return out;
  };

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
        <IconBtn active={toolProp === "hand" || spaceDown} onClick={() => setTool("hand")} title="Main : déplacer le plan (ou maintiens la barre d'espace)">
          <Hand size={16} />
        </IconBtn>
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
        <IconBtn active={tool === "addpt"} onClick={() => setTool(tool === "addpt" ? "select" : "addpt")} title="Ajouter un point : clique sur une paroi (ou clic droit)">
          <CirclePlus size={16} />
        </IconBtn>
        <IconBtn active={tool === "delpt"} onClick={() => setTool(tool === "delpt" ? "select" : "delpt")} title="Supprimer un point : clique sur le point">
          <CircleMinus size={16} />
        </IconBtn>
        <IconBtn active={false} onClick={() => { if (canUndo) undo(); }} title="Retour : annule la dernière modification (Ctrl+Z)">
          <Undo2 size={16} className={canUndo ? "" : "opacity-30"} />
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

      <div className="absolute bottom-3 left-3 z-10 max-w-[80%] space-y-1 rounded-xl border border-rule bg-white/95 px-3 py-2 text-[11px] text-stone-600 shadow">
        <label className="flex items-center gap-1.5 font-semibold"><input type="checkbox" checked={aimant} onChange={(e) => setAimant(e.target.checked)} /> Aimant murs droits et angles droits</label>
        <label className="flex items-center gap-1.5 font-semibold"><input type="checkbox" checked={snapRoomsOn} onChange={(e) => setSnapRoomsOn(e.target.checked)} /> Coller aux pièces voisines (sans vide)</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={clickRemove} onChange={(e) => setClickRemove(e.target.checked)} /> Clic gauche sur un point = le supprimer</label>
        <div className="text-stone-400">Clic droit sur une paroi = ajouter un point · Ctrl+Z = retour</div>
        {hint && <div className="font-semibold text-amber-700">{hint}</div>}
      </div>

      <div className="absolute bottom-3 right-3 z-10 max-w-[44%] space-y-1 rounded-xl border border-rule bg-white/95 px-3 py-2 text-[11px] text-stone-700 shadow">
        <div className="mb-0.5 font-semibold">Murs : ce qui est compté</div>
        {[
          [C_BRIQUE, `Brique / mur porteur`],
          [C_MUR_ISO, `Isolant murs extérieurs — ${murIso?.name} ${murIso?.thickness} mm`],
          [C_CLO_ISO, `Isolant des cloisons — ${cloIso?.name} ${cloIso?.thickness} mm`],
          [C_PLACO, "Plaque de plâtre (aussi côté extérieur d'un mur sans brique)"],
        ].map(([c, l]) => (
          <div key={l} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 shrink-0 rounded-sm border border-black/30" style={{ background: c }} />
            {l}
          </div>
        ))}
        <div className="flex items-center gap-1.5"><span className="inline-block h-0 w-4 shrink-0 border-t-2 border-dashed border-red-600" /> Sans placo / passage</div>
        <div className="text-stone-500">Brique seule = mur brut (ni isolant, ni placo)</div>
        <label className="flex items-center gap-1.5 pt-0.5 font-semibold">
          <input type="checkbox" checked={showLen} onChange={(e) => setShowLen(e.target.checked)} /> Afficher les longueurs comptées
        </label>
        <label className="flex items-center gap-1.5 pt-0.5">
          Épaisseur brique
          <input type="number" min={50} max={500} step={10} className="w-14 rounded border border-rule px-1 py-0.5" value={Math.round(briqueMm / 10)} onChange={(e) => patchSettings("briqueMm", Math.max(5, Number(e.target.value)) * 10)} />
          cm
        </label>
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
        className={`h-[420px] w-full touch-none select-none sm:h-[540px] lg:h-[620px] ${tool === "hand" ? (panRef.current ? "cursor-grabbing" : "cursor-grab") : "cursor-crosshair"}`}
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
          if (e.button === 1 || e.altKey || e.shiftKey || tool === "hand") {
            panRef.current = { x: e.clientX, y: e.clientY };
            return;
          }
          const p = pt(e);
          if (tool === "select") {
            // Fond du plan : glisser pour déplacer (souris et doigt).
            panRef.current = { x: e.clientX, y: e.clientY };
            return;
          }
          if (tool === "delpt") {
            // supprime le point le plus proche du clic (pièce sélectionnée en priorité), sans avoir à viser le rond exactement
            const tol = unitsPerPx() * 18;
            let best: { id: string; i: number; d: number } | null = null;
            for (const r of floor.rooms) {
              const pts0 = pointsForRoom(r, scale);
              pts0.forEach((v, i) => {
                const d = dist(p, v) - (r.id === sel?.id ? unitsPerPx() * 6 : 0);
                if (dist(p, v) < tol && (!best || d < best.d)) best = { id: r.id, i, d };
              });
            }
            if (!best) {
              setHint("Clique sur un point à supprimer.");
              return;
            }
            const b = best as { id: string; i: number; d: number };
            const rr = floor.rooms.find((x) => x.id === b.id);
            if (rr && pointsForRoom(rr, scale).length <= 3) setHint("Une pièce doit garder au moins 3 points.");
            else if (onRemovePoint) onRemovePoint(b.id, b.i);
            else if (rr) onPatch(b.id, removeVertex(pointsForRoom(rr, scale), b.i));
            return;
          }
          if (tool === "addpt") {
            const r = floor.rooms.find((x) => x.id === sel?.id) ?? floor.rooms.find((x) => pointInPoly(p, pointsForRoom(x, scale)));
            if (!r) {
              setHint("Sélectionne d'abord une pièce, puis clique sur une de ses parois.");
              return;
            }
            const pts0 = pointsForRoom(r, scale);
            const ce = closestEdge(pts0, p);
            if (ce.dist > unitsPerPx() * 24) {
              setHint("Clique plus près d'une paroi de la pièce sélectionnée.");
              return;
            }
            setSel({ kind: "room", id: r.id });
            { if (onInsertPoint) onInsertPoint(r.id, ce.edge, ce.hit); else onPatch(r.id, insertOnEdge(pts0, ce.edge, ce.hit)); }
            return;
          }
          if (tool === "poly") {
            if (draft.length >= 3 && dist(p, draft[0]) < Math.max(10, cam.w / 80)) {
              onCreate(draft);
              setDraft([]);
              setSnapMark(null);
              window.setTimeout(() => onSettle?.(), 80);
            } else {
              const sn = snapRooms(p, undefined, draft);
              setDraft([...draft, sn.p]);
            }
            return;
          }
          if (tool === "rect") {
            const sn = snapRooms(p);
            setRect({ a: sn.p, b: sn.p });
          }
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
          if (tool === "poly" && draft.length > 0) {
            const sn = snapRooms(p, undefined, draft);
            setCursor(sn.p);
            setSnapMark(sn.kind ? { p: sn.p, kind: sn.kind } : null);
          }
          if (rect) {
            const sn = snapRooms(p);
            setRect({ ...rect, b: sn.p });
            setSnapMark(sn.kind ? { p: sn.p, kind: sn.kind } : null);
          }
          if (moving) {
            const r = floor.rooms.find((x) => x.id === moving.id);
            if (r) {
              const moved = translate(moving.pts0, p.x - moving.start.x, p.y - moving.start.y);
              const off = snapMoveOffset(moved, moving.id);
              onPatch(moving.id, off ? translate(moved, off.dx, off.dy) : moved);
              setSnapMark(off ? { p: { x: moved[0].x + off.dx, y: moved[0].y + off.dy }, kind: "vertex" } : null);
            }
          }
          if (dragV) {
            const r = floor.rooms.find((x) => x.id === dragV.id);
            if (vDown.current && Math.hypot(e.clientX - vDown.current.x, e.clientY - vDown.current.y) > 4) vDown.current.moved = true;
            if (r && (!vDown.current || vDown.current.moved)) {
              const cur = pointsForRoom(r, scale);
              const sn = snapRooms(p, dragV.id);
              const q = sn.kind === "vertex" || sn.kind === "edge" ? sn.p : aimant ? snapVertex(cur, dragV.i, sn.p, unitsPerPx() * 7) : sn.p;
              setSnapMark(sn.kind ? { p: sn.p, kind: sn.kind } : null);
              onPatch(dragV.id, setVertex(cur, dragV.i, q));
            }
          }
          if (dragS && onMoveStair) {
            onMoveStair(dragS.id, p.x - dragS.last.x, p.y - dragS.last.y);
            setDragS({ ...dragS, last: p });
          }
          if (dragO && onMoveOpening) {
            const r = floor.rooms.find((x) => x.id === dragO.roomId);
            const o = r?.openings.find((x) => x.id === dragO.id);
            if (r && o) {
              const hit = snapToEdge(r, scale, p, o.width / 2);
              if (hit) onMoveOpening(r.id, o.id, hit.edge, Math.round(hit.t * 1000) / 1000);
            }
          }
        }}
        onPointerUp={releasePointer}
        onPointerCancel={releasePointer}
        onContextMenu={(e) => {
          // Clic droit sur la paroi d'une pièce = ajouter un point à cet endroit
          e.preventDefault();
          const p = pt(e);
          const r = floor.rooms.find((x) => x.id === sel?.id) ?? floor.rooms.find((x) => pointInPoly(p, pointsForRoom(x, scale)));
          if (!r) {
            setHint("Clic droit sur la paroi d'une pièce pour ajouter un point.");
            return;
          }
          const pts0 = pointsForRoom(r, scale);
          const ce = closestEdge(pts0, p);
          if (ce.dist > unitsPerPx() * 30) {
            setHint("Fais le clic droit plus près d'une paroi de la pièce.");
            return;
          }
          setSel({ kind: "room", id: r.id });
          { if (onInsertPoint) onInsertPoint(r.id, ce.edge, ce.hit); else onPatch(r.id, insertOnEdge(pts0, ce.edge, ce.hit)); }
        }}
      >
        <rect x={cam.x} y={cam.y} width={cam.w} height={cam.h} fill="#fbfcfa" />
        {floor.planImage && (
          <image href={floor.planImage} width={vw} height={vh} opacity={opacity / 100} />
        )}
        <g className="pointer-events-none">{wallLayers()}</g>
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
                  { const p0 = pt(e); setMoving({ id: r.id, last: p0, start: p0, pts0: pointsForRoom(r, scale) }); }
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
              {/* Portes, fenêtres et ouvertures de la pièce sélectionnée : glisse-les le long des parois */}
              {active &&
                placeOpenings(r, scale).map((pl) => {
                  const sp = openingSpan(r, scale, pl, pl.o.width);
                  const col = pl.o.id === selOpening ? "#f97316" : OPENING_COLOR[pl.o.type];
                  const mx = (sp.a.x + sp.b.x) / 2;
                  const my = (sp.a.y + sp.b.y) / 2;
                  const short = { porte: "P", fenetre: "F", baie: "B", porte_fenetre: "PF", porte_garage: "G", arche: "A", passage: "O", trappe: "T" }[pl.o.type];
                  const grab = (e: React.PointerEvent) => {
                    if (tool === "hand") return;
                    e.stopPropagation();
                    track(e);
                    if (pinchRef.current) return;
                    setSel({ kind: "room", id: r.id });
                    setSelOpening?.(pl.o.id);
                    setDragO({ roomId: r.id, id: pl.o.id });
                  };
                  return (
                    <g key={`op-${pl.o.id}`}>
                      <line x1={sp.a.x} y1={sp.a.y} x2={sp.b.x} y2={sp.b.y} stroke={col} strokeWidth={pl.o.type === "passage" ? 9 : 7} strokeLinecap="butt" strokeDasharray={pl.o.type === "passage" ? "4 3" : undefined} vectorEffect="non-scaling-stroke" opacity={0.95} />
                      <line x1={sp.a.x} y1={sp.a.y} x2={sp.b.x} y2={sp.b.y} stroke="transparent" strokeWidth={22} vectorEffect="non-scaling-stroke" className="cursor-grab" onPointerDown={grab} />
                      <g transform={`translate(${mx}, ${my})`} onPointerDown={grab} className="cursor-grab">
                        <circle r={Math.max(8, cam.w / 100)} fill={col} stroke="#fff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                        <text y={Math.max(8, cam.w / 100) * 0.35} textAnchor="middle" fontSize={Math.max(8, cam.w / 100) * 0.95} fontWeight={700} fontFamily="IBM Plex Mono" fill="#fff" className="pointer-events-none">
                          {short}
                        </text>
                      </g>
                    </g>
                  );
                })}
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
                      if (tool === "hand") return;
                      e.stopPropagation();
                      track(e);
                      if (pinchRef.current) return;
                      setSel({ kind: "room", id: r.id });
                      vDown.current = { id: r.id, i, x: e.clientX, y: e.clientY, moved: false };
                      setDragV({ id: r.id, i });
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  />
                ))}
              {/* Indicateurs : murs droits et angles droits (permanents sur la pièce sélectionnée, détaillés pendant le déplacement d'un point) */}
              {active &&
                pts.map((p, i) => {
                  const dragging = dragV?.id === r.id;
                  const a = vertexAngle(pts, i);
                  const isRight = Math.abs(a - 90) < 0.6;
                  const near = dragging && (dragV!.i === i || (dragV!.i + 1) % pts.length === i || (dragV!.i + pts.length - 1) % pts.length === i);
                  if (!isRight && !(dragging && dragV!.i === i)) return null;
                  const col = isRight ? "#16a34a" : "#ea580c";
                  const sz = Math.max(9, cam.w / 90);
                  return (
                    <g key={`ang-${i}`} className="pointer-events-none">
                      {isRight && near !== false && <circle cx={p.x} cy={p.y} r={sz * 1.5} fill="none" stroke={col} strokeWidth={2} vectorEffect="non-scaling-stroke" opacity={0.9} />}
                      {dragging && dragV!.i === i && (
                        <g>
                          <rect x={p.x + sz * 1.2} y={p.y - sz * 2.6} width={sz * 7.2} height={sz * 1.8} rx={sz * 0.4} fill={col} />
                          <text x={p.x + sz * 4.8} y={p.y - sz * 1.3} textAnchor="middle" fontSize={sz * 1.05} fontFamily="IBM Plex Mono" fontWeight={700} fill="#fff">
                            {isRight ? "90° ✓ angle droit" : `${a.toFixed(1).replace(".", ",")}°`}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              {active &&
                dragV?.id === r.id &&
                pts.map((p, i) => {
                  const q = pts[(i + 1) % pts.length];
                  const touches = i === dragV.i || (i + 1) % pts.length === dragV.i;
                  const ax = edgeAxis(p, q);
                  if (!touches || !ax) return null;
                  return (
                    <g key={`ax-${i}`} className="pointer-events-none">
                      <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#16a34a" strokeWidth={4} vectorEffect="non-scaling-stroke" opacity={0.8} />
                      <text x={(p.x + q.x) / 2} y={(p.y + q.y) / 2 - Math.max(10, cam.w / 70)} textAnchor="middle" fontSize={Math.max(10, cam.w / 80)} fontFamily="IBM Plex Mono" fontWeight={700} fill="#16a34a">
                        mur droit {ax === "h" ? "horizontal" : "vertical"} ✓
                      </text>
                    </g>
                  );
                })}
            </g>
          );
        })}
        {/* Escaliers : marches et paliers à l'échelle, déplaçables */}
        {(floor.stairs ?? []).map((st: Stair) => {
          const boxes = stairBoxes(st);
          const on = selStair === st.id;
          const start = stairToPlan(st, scale, 0, st.width / 2);
          const end = stairToPlan(st, scale, Math.min(0.9, st.tread * 3), st.width / 2);
          const lab = stairToPlan(st, scale, 0, 0);
          const col = on ? "#f97316" : "#475569";
          return (
            <g
              key={st.id}
              className={tool === "select" ? "cursor-move" : ""}
              onPointerDown={(e) => {
                if (tool !== "select") return;
                e.stopPropagation();
                track(e);
                if (pinchRef.current) return;
                setSelStair?.(st.id);
                setSel(null);
                setDragS({ id: st.id, last: pt(e) });
              }}
            >
              {boxes.map((b, i) => (
                <path key={i} d={polyPath(stairBoxPoly(st, scale, b))} fill={b.landing ? "#fde68a" : "#e2e8f0"} fillOpacity={0.9} stroke={col} strokeWidth={on ? 2 : 1.2} vectorEffect="non-scaling-stroke" />
              ))}
              <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#0f172a" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              <circle cx={start.x} cy={start.y} r={Math.max(3, cam.w / 260)} fill="#0f172a" />
              <text x={lab.x} y={lab.y - Math.max(6, cam.w / 120)} fontSize={Math.max(10, cam.w / 80)} fontFamily="IBM Plex Mono" fontWeight={700} fill={col} className="pointer-events-none">
                {st.name} ↑ {Math.round(st.rise * 100)} cm
              </text>
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
        {draft.length > 0 && cursor && tool === "poly" && (
          <line x1={draft[draft.length - 1].x} y1={draft[draft.length - 1].y} x2={cursor.x} y2={cursor.y} stroke="#23271f" strokeDasharray="3 4" strokeWidth={1.2} vectorEffect="non-scaling-stroke" opacity={0.7} />
        )}
        {snapMark && (
          <g className="pointer-events-none">
            {snapMark.kind === "vertex" && <circle cx={snapMark.p.x} cy={snapMark.p.y} r={Math.max(7, cam.w / 120)} fill="none" stroke="#16a34a" strokeWidth={3} vectorEffect="non-scaling-stroke" />}
            {snapMark.kind === "edge" && <rect x={snapMark.p.x - Math.max(5, cam.w / 160)} y={snapMark.p.y - Math.max(5, cam.w / 160)} width={Math.max(10, cam.w / 80)} height={Math.max(10, cam.w / 80)} fill="none" stroke="#16a34a" strokeWidth={3} vectorEffect="non-scaling-stroke" />}
            {snapMark.kind === "axis" && <circle cx={snapMark.p.x} cy={snapMark.p.y} r={Math.max(4, cam.w / 200)} fill="#16a34a" opacity={0.7} />}
          </g>
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
            <span className="inline-flex h-3.5 w-5 items-center justify-center rounded-full bg-[#2b6cb0] font-mono text-[8px] font-bold text-white">F</span> Fenêtre / porte / ouverture : glisse-la sur les parois
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
