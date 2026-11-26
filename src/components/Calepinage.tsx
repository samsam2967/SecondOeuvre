import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { useStore } from "../store";
import { HelpBox } from "./HelpBox";
import { pointsForRoom } from "../utils/geometry";
import { closestEdge, insertOnEdge, removeVertex, snapVertex, vertexAngle } from "../utils/geometry";
import { computeLayout, effectiveAngle, isStaggered, optimizeLayout, PATTERNS, type PatternId } from "../utils/tileLayout";
import type { Pt, TileLayoutData } from "../types";

type Mode = "move" | "draw" | "edit" | "pan";
type Drag =
  | { k: "grid"; sx: number; sy: number; ox: number; oy: number }
  | { k: "pan"; sx: number; sy: number; vx: number; vy: number }
  | { k: "vertex"; i: number }
  | null;

const btn = "rounded-lg border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-black/5 disabled:opacity-40";
const btnOn = "rounded-lg border border-black bg-black px-3 py-1.5 text-xs font-semibold text-white";
const card = "rounded-xl border border-black/10 bg-white p-4";
const inp = "w-full rounded-lg border border-black/15 bg-white px-2 py-1 text-sm";
const f1 = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export function Calepinage() {
  const { project, setTileLayout, patchSettings, updateRoom } = useStore();
  const floors = project.floors;
  const [floorId, setFloorId] = useState(floors[0]?.id ?? "");
  const [roomId, setRoomId] = useState("");
  const [mode, setMode] = useState<Mode>("move");
  const [draft, setDraft] = useState<TileLayoutData | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, w: 25 });
  const [busy, setBusy] = useState(false);
  const [optPattern, setOptPattern] = useState<PatternId | "auto">("auto");
  const [snap, setSnap] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const drag = useRef<Drag>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const floor = floors.find((f) => f.id === floorId) ?? floors[0];
  const room = floor?.rooms.find((r) => r.id === roomId) ?? floor?.rooms[0];
  const scale = floor?.planScale || 40;
  const tiles = project.settings.carrelage.tiles ?? [];
  const saved = room ? project.tileLayouts?.[room.id] : undefined;
  const data = draft ?? saved ?? null;
  const tile = data ? (tiles.find((t) => t.id === data.tileId) ?? tiles[0]) : undefined;
  const ar = 0.7;

  const stats = useMemo(
    () => (data && tile && data.points.length >= 3 ? computeLayout(data.points, tile, data) : null),
    [data, tile],
  );

  // Récapitulatif de toutes les pièces calepinées
  const summary = useMemo(() => {
    const rows: { name: string; tileName: string; priceM2: number; s: ReturnType<typeof computeLayout> }[] = [];
    for (const f of project.floors)
      for (const r of f.rooms) {
        const d = project.tileLayouts?.[r.id];
        const t = d && tiles.find((x) => x.id === d.tileId);
        if (!d || !t || d.points.length < 3) continue;
        rows.push({ name: r.name, tileName: t.name, priceM2: t.priceM2, s: computeLayout(d.points, t, d, false) });
      }
    return rows;
  }, [project.floors, project.tileLayouts, tiles]);
  const sumBought = summary.reduce((a, r) => a + r.s.total * r.s.tileArea, 0);
  const sumRoom = summary.reduce((a, r) => a + r.s.roomArea, 0);
  const sumCost = summary.reduce((a, r) => a + r.s.total * r.s.tileArea * r.priceM2, 0);

  if (!floor) return <div className={card}>Ajoute d'abord un étage et des pièces dans « Plans & pièces ».</div>;

  const baseData = (points: Pt[]): TileLayoutData => ({
    points,
    tileId: room?.tileSolId && tiles.some((t) => t.id === room.tileSolId) ? room.tileSolId : (tiles[0]?.id ?? ""),
    pattern: "droit",
    swap: false,
    offX: 0,
    offY: 0,
    jointMm: room?.jointMm && room.jointMm > 0 ? room.jointMm : project.settings.carrelage.jointMm || 3,
    minCutCm: 5,
  });
  const commit = (d: TileLayoutData | null) => {
    if (room) setTileLayout(room.id, d);
    if (room && d && (room.jointMm ?? 0) !== d.jointMm) updateRoom(room.floorId, room.id, { jointMm: d.jointMm });
    setDraft(null);
  };
  /** Même largeur de joint pour toutes les pièces (réglage des pièces + calepinages existants). */
  const applyJointToAll = (mm: number) => {
    for (const f of project.floors)
      for (const r of f.rooms) {
        updateRoom(f.id, r.id, { jointMm: mm });
        const d = project.tileLayouts?.[r.id];
        if (d) setTileLayout(r.id, { ...d, jointMm: mm });
      }
  };
  const nudgeGrid = (dxCm: number, dyCm: number) => data && commit({ ...data, centered: false, offX: data.offX + dxCm / 100, offY: data.offY + dyCm / 100 });
  const update = (patch: Partial<TileLayoutData>) => data && commit({ ...data, ...patch });

  const fit = (pts: Pt[] | undefined) => {
    if (!pts || pts.length < 2) return setView({ x: 0, y: 0, w: (floor.planWidth || 1000) / scale });
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const bw = Math.max(...xs) - Math.min(...xs);
    const bh = Math.max(...ys) - Math.min(...ys);
    const w = Math.max(bw * 1.4, (bh * 1.4) / ar, 2);
    setView({ x: (Math.min(...xs) + Math.max(...xs)) / 2 - w / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 - (w * ar) / 2, w });
  };

  const importFromPlan = () => {
    if (!room) return;
    const pts = pointsForRoom(room, scale).map((p) => ({ x: p.x / scale, y: p.y / scale }));
    commit(baseData(pts));
    fit(pts);
    setMode("move");
  };

  const toM = (e: { clientX: number; clientY: number }): Pt => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const r = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: r.x, y: r.y };
  };
  const sn = (p: Pt): Pt => (snap ? { x: Math.round(p.x / 0.05) * 0.05, y: Math.round(p.y / 0.05) * 0.05 } : p);

  const onDown = (e: RPointerEvent<SVGSVGElement>) => {
    const p = toM(e);
    if (mode === "draw") {
      const pts = data?.points ?? [];
      if (pts.length >= 3 && Math.hypot(p.x - pts[0].x, p.y - pts[0].y) < view.w * 0.012) {
        setMode("move");
        return;
      }
      const np = [...pts, sn(p)];
      commit(data ? { ...data, points: np } : baseData(np));
    } else if (mode === "move" && data) {
      svgRef.current?.setPointerCapture(e.pointerId);
      drag.current = { k: "grid", sx: p.x, sy: p.y, ox: data.offX, oy: data.offY };
    } else if (mode === "pan" || (mode === "edit" && !drag.current)) {
      svgRef.current?.setPointerCapture(e.pointerId);
      drag.current = { k: "pan", sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
    }
  };
  const vclick = useRef<null | { i: number; x: number; y: number; moved: boolean }>(null);
  const { undo, canUndo } = useStore();
  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    if (d.k === "pan") {
      const r = svgRef.current!.getBoundingClientRect();
      const k = view.w / r.width;
      setView((v) => ({ ...v, x: d.vx - (e.clientX - d.sx) * k, y: d.vy - (e.clientY - d.sy) * k }));
    } else if (d.k === "grid" && data) {
      const p = toM(e);
      const rad = (effectiveAngle(data) * Math.PI) / 180;
      const dx = p.x - d.sx;
      const dy = p.y - d.sy;
      const mx = data.origin === "hd" || data.origin === "bd" ? -1 : 1;
      const my = data.origin === "bg" || data.origin === "bd" ? -1 : 1;
      const ex = dx * mx;
      const ey = dy * my;
      setDraft({ ...data, centered: false, offX: d.ox + ex * Math.cos(rad) + ey * Math.sin(rad), offY: d.oy - ex * Math.sin(rad) + ey * Math.cos(rad) });
    } else if (d.k === "vertex" && data) {
      if (vclick.current && Math.hypot(e.clientX - vclick.current.x, e.clientY - vclick.current.y) > 4) vclick.current.moved = true;
      if (vclick.current && !vclick.current.moved) return;
      const raw = toM(e);
      const base = draft ?? data;
      const p = snapVertex(base.points, d.i, sn(raw), view.w * 0.006);
      setDraft({ ...data, points: data.points.map((q, i) => (i === d.i ? p : q)) });
    }
  };
  const onUp = () => {
    const vc = vclick.current;
    vclick.current = null;
    drag.current = null;
    if (vc && !vc.moved && data && data.points.length > 3) {
      // clic gauche sur un point (sans le déplacer) = le supprimer
      commit({ ...data, points: removeVertex(data.points, vc.i) });
      return;
    }
    if (draft) commit(draft);
  };
  const addPointAt = (e: RPointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>) => {
    if (!data || data.points.length < 3) return;
    const ce = closestEdge(data.points, toM(e as RPointerEvent<SVGSVGElement>));
    commit({ ...data, points: insertOnEdge(data.points, ce.edge, ce.hit) });
  };

  const optimize = () => {
    if (!data || !tile) return;
    setBusy(true);
    setTimeout(() => {
      const pats: PatternId[] = optPattern === "auto" ? ["droit", "demi", "tiers", "quinconce", "diag"] : [optPattern];
      const best = optimizeLayout(data.points, tile, data, pats);
      commit({ ...data, ...best });
      setBusy(false);
    }, 30);
  };

  const cutGroups = useMemo(() => {
    const m = new Map<string, number>();
    stats?.cells.forEach((c) => {
      if (c.full) return;
      const k = `${Math.round(c.w * 100)} × ${Math.round(c.h * 100)} cm`;
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [stats]);

  const planW = (floor.planWidth || 1000) / scale;
  const planH = (floor.planHeight || 700) / scale;
  const lbl = showLabels && stats && stats.cells.length < 400 && view.w < 12;
  const centroid = (poly: Pt[]) => ({ x: poly.reduce((a, p) => a + p.x, 0) / poly.length, y: poly.reduce((a, p) => a + p.y, 0) / poly.length });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl uppercase">Calepinage du sol</h1>
        <p className="text-sm text-black/60">
          Redessine la pièce par-dessus le plan, choisis un carreau du catalogue Carrelage, puis laisse le site optimiser pour limiter les pertes.
        </p>
      </div>

      <HelpBox id="calepinage">
        <ol>
          <li><b>Choisis l'étage et la pièce</b> en haut. Le plan de l'étage (image importée dans « Plans & pièces ») s'affiche en transparence sous la pièce. Son échelle doit être réglée pour que les mètres soient justes.</li>
          <li><b>Contour de la pièce</b> : clique sur « Reprendre le contour de la pièce du plan », ou « Redessiner à la main » : clique pour poser chaque angle, puis reclique sur le point rouge (le premier) pour fermer. « Aimanter » cale les points tous les 5 cm.</li>
          <li><b>Corriger</b> : mode « Éditer les angles », puis glisse un point. « Déplacer la vue » et « Zoom » servent à se promener sur le plan.</li>
          <li><b>Carreau</b> : choisis-le dans la liste. C'est le catalogue de l'onglet Carrelage (format, prix au m²) : pour en ajouter un, va d'abord là-bas.</li>
          <li><b>Motif, joint, coupe mini</b> : motif droit, décalé ou diagonal ; largeur du joint ; « Coupe mini » = en dessous de cette largeur, la coupe est jugée trop étroite à poser et passe en rouge.</li>
          <li><b>Optimiser</b> : le site essaie tous les motifs, les deux sens et des centaines de décalages, puis garde celui qui demande le moins de carreaux sans chute trop étroite.</li>
          <li><b>Déplacer le calepinage à la main</b> : mode « Déplacer le calepinage », puis glisse sur le plan (ou saisis le décalage X / Y en cm). Utile pour centrer la pose sur une porte ou un joint de référence.</li>
          <li><b>Lire le résultat</b> : vert = carreau entier, orange = coupe (avec ses cotes en cm), rouge = chute trop étroite. À droite : carreaux entiers / coupés, total à acheter, perte, coût et estimation avec réemploi des chutes.</li>
          <li><b>Tableau du bas</b> : récapitule toutes les pièces calepinées. Le bouton « Utiliser cette perte dans le chiffrage Carrelage » met le pourcentage de perte réel dans les réglages du poste Carrelage.</li>
        </ol>
        <p>Le calepinage de chaque pièce est enregistré avec le projet (sauvegarde automatique dans ton compte).</p>
      </HelpBox>

      <div className={`${card} flex flex-wrap items-end gap-3`}>
        <label className="text-xs font-semibold">
          Étage
          <select className={inp} value={floor.id} onChange={(e) => { setFloorId(e.target.value); setRoomId(""); setDraft(null); }}>
            {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold">
          Pièce
          <select className={inp} value={room?.id ?? ""} onChange={(e) => { setRoomId(e.target.value); setDraft(null); }}>
            {floor.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {([["move", "Déplacer le calepinage"], ["draw", "Dessiner la pièce"], ["edit", "Éditer les angles"], ["pan", "Déplacer la vue"]] as [Mode, string][]).map(([m, l]) => (
            <button key={m} className={mode === m ? btnOn : btn} onClick={() => setMode(m)}>{l}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button className={btn} onClick={() => setView((v) => ({ ...v, w: v.w * 0.8 }))}>Zoom +</button>
          <button className={btn} onClick={() => setView((v) => ({ ...v, w: v.w * 1.25 }))}>Zoom −</button>
          <button className={btn} onClick={() => fit(data?.points)}>Ajuster la vue</button>
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} /> Aimanter (5 cm)</label>
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} /> Cotes des coupes</label>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className={`${card} p-2`}>
          <svg
            ref={svgRef}
            viewBox={`${view.x} ${view.y} ${view.w} ${view.w * ar}`}
            className="w-full touch-none select-none rounded-lg bg-[#f4f3ee]"
            style={{ aspectRatio: "10 / 7", cursor: mode === "draw" ? "crosshair" : mode === "move" ? "grab" : mode === "pan" ? "move" : "default" }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onContextMenu={(e) => {
              e.preventDefault();
              addPointAt(e);
            }}
          >
            {floor.planImage && <image href={floor.planImage} x={0} y={0} width={planW} height={planH} opacity={0.55} preserveAspectRatio="none" />}
            {stats?.cells.map((c, i) => (
              <path
                key={i}
                d={`M${c.poly.map((p) => `${p.x},${p.y}`).join("L")}Z`}
                fill={c.sliver ? "#f3a6a6" : c.full ? "#d8e6dc" : "#f7cf9e"}
                fillOpacity={0.9}
                stroke={c.sliver ? "#b91c1c" : "#5f8a70"}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {lbl && stats!.cells.filter((c) => !c.full).map((c, i) => {
              const m = centroid(c.poly);
              return (
                <text key={i} x={m.x} y={m.y} fontSize={view.w / 110} textAnchor="middle" fill="#7c2d12" style={{ pointerEvents: "none" }}>
                  {Math.round(c.w * 100)}×{Math.round(c.h * 100)}
                </text>
              );
            })}
            {data && data.points.length > 0 && (
              <polygon points={data.points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#111" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            )}
            {data && (mode === "edit" || mode === "draw") &&
              data.points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={view.w * 0.007}
                  fill={i === 0 ? "#dc2626" : "#fff"}
                  stroke="#111"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                  style={{ cursor: "grab" }}
                  onPointerDown={(e) => {
                    if (mode !== "edit") return;
                    e.stopPropagation();
                    svgRef.current?.setPointerCapture(e.pointerId);
                    drag.current = { k: "vertex", i };
                    vclick.current = { i, x: e.clientX, y: e.clientY, moved: false };
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                />
              ))}
            {data && mode === "edit" && data.points.length >= 3 && data.points.map((p, i) => {
              const a = vertexAngle(data.points, i);
              const right = Math.abs(a - 90) < 0.6;
              const isDrag = drag.current?.k === "vertex" && drag.current.i === i;
              if (!right && !isDrag) return null;
              const fs = view.w / 60;
              return (
                <g key={`a${i}`} style={{ pointerEvents: "none" }}>
                  {right && <circle cx={p.x} cy={p.y} r={view.w * 0.014} fill="none" stroke="#16a34a" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
                  {isDrag && <text x={p.x + fs} y={p.y - fs} fontSize={fs} fontWeight={700} fill={right ? "#16a34a" : "#ea580c"}>{right ? "90° ✓" : `${a.toFixed(1).replace(".", ",")}°`}</text>}
                </g>
              );
            })}
          </svg>
          <div className="flex flex-wrap items-center gap-2 px-2 pt-1 text-[11px]">
            <button className={btn} disabled={!canUndo} onClick={undo} title="Annule la dernière modification (Ctrl+Z)">↶ Retour</button>
            {mode === "edit" && <span className="text-black/50">Clic droit sur le contour = ajouter un point · clic gauche sur un point = le supprimer · les murs et angles droits sont signalés en vert.</span>}
          </div>
          <p className="px-2 pt-1 text-[11px] text-black/50">
            Vert = carreau entier · orange = coupe · rouge = chute trop étroite. {mode === "draw" ? "Clique pour poser les angles ; reclique sur le point rouge pour fermer." : mode === "move" ? "Glisse sur le plan pour décaler tout le calepinage." : ""}
          </p>
        </div>

        <div className="space-y-3 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto xl:pr-1">
          {!data || data.points.length < 3 ? (
            <div className={card}>
              <div className="mb-2 text-sm font-semibold">Contour de {room?.name ?? "la pièce"}</div>
              <div className="flex flex-col gap-2">
                <button className={btn} onClick={importFromPlan} disabled={!room}>Reprendre le contour de la pièce du plan</button>
                <button className={btn} onClick={() => { setMode("draw"); if (data) commit(null); }}>Redessiner à la main sur le plan</button>
              </div>
              {data && data.points.length > 0 && <p className="mt-2 text-xs">{data.points.length} point(s) posé(s) — il en faut au moins 3.</p>}
            </div>
          ) : (
            <div className={`${card} space-y-3`}>
              <label className="block text-xs font-semibold">
                Carreau (catalogue Carrelage)
                <select className={inp} value={tile?.id ?? ""} onChange={(e) => update({ tileId: e.target.value })}>
                  {tiles.map((t) => <option key={t.id} value={t.id}>{t.name} — {Math.round(t.tileL * 100)}×{Math.round(t.tileW * 100)} cm · {f1(t.priceM2)} €/m²</option>)}
                </select>
              </label>
              <div>
                <div className="mb-1 text-xs font-semibold">Pose en quinconce (carreaux décalés d'une rangée à l'autre)</div>
                <div className="grid grid-cols-2 gap-2">
                  <button className={!isStaggered(data) && data.pattern !== "diag" && data.pattern !== "chevron" && data.pattern !== "batons" ? btnOn : btn} onClick={() => update({ pattern: "droit" })}>Non — joints alignés</button>
                  <button className={isStaggered(data) ? btnOn : btn} onClick={() => update({ pattern: "quinconce", shiftPct: data.shiftPct ?? 50 })}>Oui — en quinconce</button>
                  <button className={data.pattern === "chevron" ? btnOn : btn} onClick={() => update({ pattern: "chevron", angleDeg: data.pattern === "chevron" ? data.angleDeg : 0 })}>Chevron (en V)</button>
                  <button className={data.pattern === "batons" ? btnOn : btn} onClick={() => update({ pattern: "batons", angleDeg: data.pattern === "batons" ? data.angleDeg : 0 })}>Bâtons rompus</button>
                </div>
                {(data.pattern === "chevron" || data.pattern === "batons") && (
                  <p className="mt-1 text-[11px] text-black/50">
                    {data.pattern === "chevron"
                      ? "Chevron : carreaux rectangulaires coupés à 45° à chaque bout, posés en V autour d'une ligne centrale. Le sens se tourne avec « Angle de pose » (ajoute 90° pour changer de sens)."
                      : "Bâtons rompus (point de Hongrie) : carreaux entiers posés à 90° les uns des autres. Le motif est parfait si la longueur est un multiple de la largeur (ex. 60×10, 90×15)."}
                    {" "}Prévois 15 à 25 % de chutes (mesuré sur la pièce) et commence la pose au centre d'un mur, sur la ligne de repère tracée au laser.
                  </p>
                )}
              </div>
              {isStaggered(data) && (
                <div className="space-y-2 rounded-lg bg-black/[0.03] p-2">
                  <div className="text-xs font-semibold">Décalage d'une rangée sur la précédente</div>
                  <div className="flex flex-wrap gap-1.5">
                    {[[50, "1/2"], [33, "1/3"], [25, "1/4"], [20, "1/5"], [10, "10 %"]].map(([v, l]) => (
                      <button key={v} className={data.pattern === "quinconce" && (data.shiftPct ?? 50) === v ? btnOn : btn} onClick={() => update({ pattern: "quinconce", shiftPct: v as number })}>{l}</button>
                    ))}
                    <label className="flex items-center gap-1 text-xs">
                      libre
                      <input className="w-16 rounded-lg border border-black/15 bg-white px-2 py-1 text-sm" type="number" min={1} max={99} value={data.pattern === "quinconce" ? (data.shiftPct ?? 50) : data.pattern === "demi" ? 50 : 33} onChange={(e) => update({ pattern: "quinconce", shiftPct: Math.min(99, Math.max(1, Number(e.target.value))) })} />
                      % du carreau
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs font-semibold">Répartition
                      <select className={inp} value={data.shiftMode ?? "alterne"} onChange={(e) => update({ pattern: "quinconce", shiftPct: data.shiftPct ?? (data.pattern === "tiers" ? 33 : 50), shiftMode: e.target.value as "alterne" | "progressif" })}>
                        <option value="alterne">Une rangée sur deux décalée</option>
                        <option value="progressif">Chaque rangée décalée de plus</option>
                      </select>
                    </label>
                    <label className="text-xs font-semibold">Sens du décalage
                      <select className={inp} value={data.shiftAxis ?? "rangees"} onChange={(e) => update({ shiftAxis: e.target.value as "rangees" | "colonnes" })}>
                        <option value="rangees">Rangées (décalage horizontal)</option>
                        <option value="colonnes">Colonnes (décalage vertical)</option>
                      </select>
                    </label>
                  </div>
                  <p className="text-[11px] text-black/50">Un décalage de 1/2 sur un carreau long (ex. 20×120 cm) est déconseillé : les carreaux rectifiés peuvent bomber ; 1/3 ou 1/4 est la règle usuelle (DTU 52.2).</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold">Motif
                  <select className={inp} value={data.pattern} onChange={(e) => update({ pattern: e.target.value as PatternId, ...(e.target.value === "quinconce" ? { shiftPct: data.shiftPct ?? 50 } : {}) })}>
                    {(Object.keys(PATTERNS) as PatternId[]).map((k) => <option key={k} value={k}>{PATTERNS[k].label}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold">Joint (mm)
                  <input className={inp} type="number" min={0} step={0.5} value={data.jointMm} onChange={(e) => update({ jointMm: Number(e.target.value) })} />
                </label>
                <label className="text-xs font-semibold">Angle de pose (°)
                  <input className={inp} type="number" step={1} value={data.angleDeg ?? 0} onChange={(e) => update({ angleDeg: Number(e.target.value) })} />
                </label>
                <label className="text-xs font-semibold">Coupe mini (cm)
                  <input className={inp} type="number" min={0} value={data.minCutCm} onChange={(e) => update({ minCutCm: Number(e.target.value) })} />
                </label>
                <label className="text-xs font-semibold">Décalage X (cm)
                  <input className={inp} type="number" step={0.5} value={Math.round(data.offX * 1000) / 10} onChange={(e) => update({ centered: false, offX: Number(e.target.value) / 100 })} />
                </label>
                <label className="text-xs font-semibold">Décalage Y (cm)
                  <input className={inp} type="number" step={0.5} value={Math.round(data.offY * 1000) / 10} onChange={(e) => update({ centered: false, offY: Number(e.target.value) / 100 })} />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <label className="flex items-center gap-1"><input type="checkbox" checked={data.swap} onChange={(e) => update({ swap: e.target.checked })} /> Tourner le carreau de 90°</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={!!data.centered} onChange={(e) => update({ centered: e.target.checked })} /> Centrer la pose sur la pièce</label>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold">Pose partant du coin</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {([["hg", "↖ haut-gauche"], ["hd", "↗ haut-droit"], ["bg", "↙ bas-gauche"], ["bd", "↘ bas-droit"]] as const).map(([k, l]) => (
                    <button key={k} className={(data.origin ?? "hg") === k ? btnOn : btn} onClick={() => update({ origin: k, centered: false })}>{l}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold">Déplacer le calepinage au clavier</div>
                <div className="flex flex-wrap gap-1.5">
                  {[1, 5].map((n) => (
                    <span key={n} className="flex gap-1">
                      <button className={btn} onClick={() => nudgeGrid(-n, 0)}>← {n} cm</button>
                      <button className={btn} onClick={() => nudgeGrid(n, 0)}>{n} cm →</button>
                      <button className={btn} onClick={() => nudgeGrid(0, -n)}>↑ {n} cm</button>
                      <button className={btn} onClick={() => nudgeGrid(0, n)}>↓ {n} cm</button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button className={btn} onClick={() => applyJointToAll(data.jointMm)}>Appliquer ce joint ({data.jointMm} mm) à toutes les pièces</button>
              </div>
              <div className="flex gap-2">
                <select className={inp} value={optPattern} onChange={(e) => setOptPattern(e.target.value as PatternId | "auto")}>
                  <option value="auto">Optimiser : tous les motifs</option>
                  {(Object.keys(PATTERNS) as PatternId[]).map((k) => <option key={k} value={k}>Optimiser : {PATTERNS[k].label}</option>)}
                </select>
                <button className={btnOn} onClick={optimize} disabled={busy || !tile}>{busy ? "Calcul…" : "Optimiser"}</button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className={btn} onClick={() => update({ offX: 0, offY: 0 })}>Remettre le décalage à 0</button>
                <button className={btn} onClick={() => commit(null)}>Supprimer ce calepinage</button>
              </div>
            </div>
          )}

          {stats && tile && (
            <div className={`${card} text-sm`}>
              <div className="mb-2 font-semibold">Résultat — {room?.name}</div>
              <table className="w-full text-xs">
                <tbody>
                  <tr><td>Surface de la pièce</td><td className="text-right">{f1(stats.roomArea)} m²</td></tr>
                  <tr><td>Carreaux entiers</td><td className="text-right">{stats.full}</td></tr>
                  <tr><td>Carreaux à couper</td><td className="text-right">{stats.cut}</td></tr>
                  <tr className="font-bold"><td>Total à acheter</td><td className="text-right">{stats.total} ({f1(stats.total * stats.tileArea)} m²)</td></tr>
                  <tr><td>Perte</td><td className="text-right">{f1(stats.wastePct)} %</td></tr>
                  <tr><td>Avec réemploi des chutes (estim.)</td><td className="text-right">{stats.needReuse}</td></tr>
                  <tr><td>Chutes trop étroites</td><td className={`text-right ${stats.slivers ? "font-bold text-red-600" : ""}`}>{stats.slivers}</td></tr>
                  <tr><td>Coût carreaux</td><td className="text-right">{f1(stats.total * stats.tileArea * tile.priceM2)} €</td></tr>
                </tbody>
              </table>
              {cutGroups.length > 0 && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer font-semibold">Liste des coupes à préparer ({cutGroups.reduce((a, [, n]) => a + n, 0)})</summary>
                  <table className="mt-1 w-full">
                    <thead><tr className="text-left text-black/50"><th>Coupe (longueur × largeur)</th><th className="text-right">Nombre</th></tr></thead>
                    <tbody>{cutGroups.map(([k, n]) => <tr key={k} className="border-t border-black/5"><td>{k}</td><td className="text-right">{n}</td></tr>)}</tbody>
                  </table>
                </details>
              )}
              {cutGroups.length > 0 && (
                <div className="mt-2 text-xs text-black/60">
                  Coupes : {cutGroups.slice(0, 8).map(([k, n]) => `${n} × ${k}`).join(" · ")}{cutGroups.length > 8 ? ` · … (${cutGroups.length} formats, liste complète ci-dessus)` : ""}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {summary.length > 0 && (
        <div className={card}>
          <div className="mb-2 text-sm font-semibold">Toutes les pièces calepinées</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-black/50"><th>Pièce</th><th>Carreau</th><th className="text-right">Surface</th><th className="text-right">Carreaux</th><th className="text-right">Perte</th><th className="text-right">Coût</th></tr></thead>
              <tbody>
                {summary.map((r, i) => (
                  <tr key={i} className="border-t border-black/5">
                    <td>{r.name}</td><td>{r.tileName}</td>
                    <td className="text-right">{f1(r.s.roomArea)} m²</td><td className="text-right">{r.s.total}</td>
                    <td className="text-right">{f1(r.s.wastePct)} %</td><td className="text-right">{f1(r.s.total * r.s.tileArea * r.priceM2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <span>Total : {f1(sumCost)} € · perte réelle équivalente {f1(sumRoom > 0 ? (sumBought / sumRoom - 1) * 100 : 0)} % de la surface</span>
            <button
              className={btn}
              onClick={() => patchSettings("carrelage", (c) => ({ ...c, wastePct: Math.ceil((sumBought / sumRoom - 1) * 1000) / 10 }))}
            >
              Utiliser cette perte dans le chiffrage Carrelage
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
