import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { POSTS } from "../data/catalogs";
import { useStore } from "../store";
import type { PostId } from "../types";
import { buildScene, OPENING_LABEL, type Built, type Scene3DOptions, type WallPick } from "../utils/scene3d";
import { fmtD } from "../utils/format";
import { floorElevations } from "../utils/elecPlan";
import { pointsForRoom } from "../utils/geometry";

const btn = "rounded-lg border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-black/5 disabled:opacity-40";
const btnOn = "rounded-lg border border-black bg-black px-3 py-1.5 text-xs font-semibold text-white";
const inp = "w-24 rounded-lg border border-black/15 bg-white px-2 py-1 text-sm";

/** Vue 3D de la maison : un poste seul (ce qui est compté dans ce poste) ou tous les postes réunis (récapitulatif). */
export function House3D({ post }: { post: PostId | "all" }) {
  const [open, setOpen] = useState(false);
  const label = post === "all" ? "toute la maison" : (POSTS.find((p) => p.id === post)?.label ?? post);
  return (
    <div className="mb-6 rounded-xl border border-rule bg-white/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Vue 3D — {label}</div>
          <p className="text-xs text-stone-500">
            {post === "all"
              ? "Tous les postes réunis : active ou masque chaque poste pour voir ce qui est compté, couche par couche."
              : "Seul ce qui est compté dans ce poste est dessiné, à l'échelle réelle (formats, joints, plaques, panneaux)."}
          </p>
        </div>
        <button className={open ? btnOn : btn} onClick={() => setOpen((v) => !v)}>
          {open ? "Fermer la vue 3D" : "Ouvrir la vue 3D"}
        </button>
      </div>
      {open && <Scene post={post} />}
    </div>
  );
}

function Scene({ post }: { post: PostId | "all" }) {
  const { project, calc, updateRoom } = useStore();
  const floors = project.floors;
  const host = useRef<HTMLDivElement>(null);
  const three = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    render: () => void;
    group: THREE.Group;
  } | null>(null);
  const built = useRef<Built | null>(null);
  const texCache = useRef<Map<string, THREE.Texture>>(new Map());
  const fitted = useRef("");
  const [layers, setLayers] = useState<Set<PostId>>(() => new Set(post === "all" ? POSTS.map((p) => p.id) : [post]));
  const [floorId, setFloorId] = useState("all");
  const [ceilings, setCeilings] = useState(true);
  const [xray, setXray] = useState(false);
  const [ossature, setOssature] = useState(false);
  const [cuts, setCuts] = useState(true);
  const [big, setBig] = useState(false);
  const [placeMode, setPlaceMode] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [info, setInfo] = useState<{ legend: Built["legend"]; notes: string[]; placements: Built["placements"] }>({ legend: [], notes: [], placements: new Map() });
  const [error, setError] = useState("");

  const opts: Scene3DOptions = useMemo(
    () => ({ layers, floorId, ceilings, xray, ossature, cuts, selectedOpening: selected }),
    [layers, floorId, ceilings, xray, ossature, cuts, selected],
  );
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const stateRef = useRef({ placeMode, selected, project });
  stateRef.current = { placeMode, selected, project };

  const fit = (view: "iso" | "top") => {
    const t = three.current;
    const b = built.current;
    if (!t || !b || b.box.isEmpty()) return;
    const c = b.box.getCenter(new THREE.Vector3());
    const s = b.box.getSize(new THREE.Vector3());
    const half = Math.tan(THREE.MathUtils.degToRad(t.camera.fov / 2));
    t.controls.target.copy(c);
    if (view === "top") {
      const dist = (Math.max(s.z, s.x / t.camera.aspect) / 2 / half) * 1.08 + s.y;
      t.camera.position.set(c.x, c.y + dist, c.z + dist * 0.02);
    } else {
      const radius = s.length() / 2;
      const dist = (radius / Math.min(half, half * t.camera.aspect)) * 0.82;
      t.camera.position.set(c.x + dist * 0.5, c.y + dist * 0.62, c.z + dist * 0.78);
    }
    const dist = t.camera.position.distanceTo(c);
    t.camera.near = 0.1;
    t.camera.far = dist * 20;
    t.camera.updateProjectionMatrix();
    t.controls.update();
    t.render();
  };

  // Mise en place du moteur 3D (une seule fois)
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setError("Ton navigateur ne permet pas l'affichage 3D (WebGL indisponible).");
      return;
    }
    renderer.localClippingEnabled = true;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor("#eef0ea");
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight("#ffffff", 1.55));
    const l1 = new THREE.DirectionalLight("#ffffff", 1.2);
    l1.position.set(6, 12, 8);
    scene.add(l1);
    const l2 = new THREE.DirectionalLight("#ffffff", 0.5);
    l2.position.set(-8, 6, -6);
    scene.add(l2);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.maxPolarAngle = Math.PI * 0.499;
    const group = new THREE.Group();
    scene.add(group);
    let raf = 0;
    const render = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => renderer.render(scene, camera));
    };
    controls.addEventListener("change", render);
    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    three.current = { renderer, scene, camera, controls, render, group };

    // Clic sur un mur : placement d'une porte ou d'une fenêtre
    const ray = new THREE.Raycaster();
    let down = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const st = stateRef.current;
      if (!st.placeMode || !st.selected || !built.current) return;
      const r = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      let owner: { floorId: string; roomId: string } | null = null;
      let roomName = "";
      for (const f of st.project.floors)
        for (const rm of f.rooms) if (rm.openings.some((o) => o.id === st.selected)) {
          owner = { floorId: f.id, roomId: rm.id };
          roomName = rm.name;
        }
      if (!owner) return;
      const floor = st.project.floors.find((f) => f.id === owner!.floorId)!;
      const room = floor.rooms.find((x) => x.id === owner!.roomId)!;
      const sc = floor.planScale || 40;
      const pts = pointsForRoom(room, sc).map((p) => ({ x: p.x / sc, y: p.y / sc }));
      let edge = -1;
      let t = 0.5;
      // 1) clic directement sur un mur de la pièce
      const hit = ray.intersectObjects(built.current.pickables, false)[0];
      const pick = hit?.object.userData as WallPick | undefined;
      if (hit && pick && pick.roomId === owner.roomId) {
        const dx = pick.bx - pick.ax;
        const dy = pick.by - pick.ay;
        edge = pick.edge;
        t = ((hit.point.x - pick.ax) * dx + (hit.point.z - pick.ay) * dy) / (dx * dx + dy * dy);
      } else {
        // 2) clic au sol (vue de dessus) : on prend le mur de la pièce le plus proche du point cliqué
        const elevY = floorElevations(st.project.floors, st.project.settings.elec.slabM ?? 0.3).get(floor.id) ?? 0;
        const target = new THREE.Vector3();
        if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -elevY), target)) return;
        let best = Infinity;
        pts.forEach((a, i) => {
          const b = pts[(i + 1) % pts.length];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const l2 = dx * dx + dy * dy;
          if (l2 < 1e-6) return;
          const u = Math.min(1, Math.max(0, ((target.x - a.x) * dx + (target.z - a.y) * dy) / l2));
          const d = Math.hypot(target.x - (a.x + u * dx), target.z - (a.y + u * dy));
          if (d < best) {
            best = d;
            edge = i;
            t = u;
          }
        });
        if (edge < 0 || best > 1.5) {
          setMsg(`Clique sur ou près d'un mur de « ${roomName} » pour y placer l'ouverture.`);
          return;
        }
      }
      t = Math.min(0.98, Math.max(0.02, t));
      updateRoom(owner.floorId, owner.roomId, { openings: room.openings.map((o) => (o.id === st.selected ? { ...o, edge, t } : o)) });
      setMsg("");
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    return () => {
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      ro.disconnect();
      controls.dispose();
      built.current?.dispose();
      texCache.current.forEach((t) => t.dispose());
      texCache.current.clear();
      renderer.dispose();
      renderer.domElement.remove();
      three.current = null;
      built.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconstruction de la scène quand le projet ou les options changent
  useEffect(() => {
    const run = () => {
      const t = three.current;
      if (!t) return;
      const next = buildScene(project, optsRef.current, { cache: texCache.current, redraw: t.render });
      if (built.current) {
        t.group.remove(built.current.root);
        built.current.dispose();
      }
      built.current = next;
      t.group.add(next.root);
      setInfo({ legend: next.legend, notes: next.notes, placements: next.placements });
      const key = `${floorId}`;
      if (fitted.current !== key) {
        fitted.current = key;
        fit("iso");
      } else t.render();
    };
    if (!built.current) run();
    const id = window.setTimeout(run, built.current ? 140 : 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, opts]);

  const toggleLayer = (id: PostId) =>
    setLayers((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const visibleFloors = floors.filter((f) => floorId === "all" || f.id === floorId);
  const openingsList = visibleFloors.flatMap((f) =>
    f.rooms.flatMap((r) => r.openings.filter((o) => o.wall !== "plafond" && o.type !== "trappe").map((o) => ({ f, r, o }))),
  );
  const sel = openingsList.find((x) => x.o.id === selected);
  const selPlace = selected ? info.placements.get(selected) : undefined;

  const patchOpening = (patch: Partial<{ edge: number; t: number; sill: number | undefined }>) => {
    if (!sel) return;
    updateRoom(sel.f.id, sel.r.id, { openings: sel.r.openings.map((o) => (o.id === sel.o.id ? { ...o, ...patch } : o)) });
  };
  const nudge = (dm: number) => {
    if (!sel || !selPlace) return;
    const walls = sel.r;
    void walls;
    const len = edgeLength(project, sel.f.id, sel.r.id, selPlace.edge);
    const t = Math.min(0.98, Math.max(0.02, selPlace.t + dm / Math.max(0.3, len)));
    patchOpening({ edge: selPlace.edge, t });
  };

  const facts = post === "all" ? [] : [...calc.byPost[post]].sort((a, b) => b.quantity * b.unitPrice - a.quantity * a.unitPrice).slice(0, 7);

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="font-semibold">
          Étage{" "}
          <select className="rounded-lg border border-black/15 bg-white px-2 py-1 text-sm" value={floorId} onChange={(e) => setFloorId(e.target.value)}>
            <option value="all">Tous</option>
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <button className={btn} onClick={() => fit("iso")}>Vue 3/4</button>
        <button className={btn} onClick={() => fit("top")}>Vue de dessus</button>
        <button className={btn} onClick={() => setBig((v) => !v)}>{big ? "Réduire" : "Agrandir"}</button>
        <label className="flex items-center gap-1"><input type="checkbox" checked={ceilings} onChange={(e) => setCeilings(e.target.checked)} /> Plafonds</label>
        {(post === "all" || post === "placo") && (
          <label className="flex items-center gap-1"><input type="checkbox" checked={ossature} onChange={(e) => setOssature(e.target.checked)} /> Ossature</label>
        )}
        {(post === "all" || post === "carrelage") && (
          <label className="flex items-center gap-1"><input type="checkbox" checked={cuts} onChange={(e) => setCuts(e.target.checked)} /> Coupes du calepinage</label>
        )}
        {(post === "all" || post === "chauffage" || post === "isolation") && (
          <label className="flex items-center gap-1"><input type="checkbox" checked={xray} onChange={(e) => setXray(e.target.checked)} /> Sous le sol</label>
        )}
        <button className={placeMode ? btnOn : btn} onClick={() => { setPlaceMode((v) => !v); setMsg(""); }}>
          {placeMode ? "Terminer le placement" : "Placer portes et fenêtres"}
        </button>
      </div>

      {post === "all" && (
        <div className="flex flex-wrap gap-1.5">
          {POSTS.map((p) => (
            <button key={p.id} className={layers.has(p.id) ? btnOn : btn} onClick={() => toggleLayer(p.id)}>
              {p.short}
            </button>
          ))}
        </div>
      )}

      <div ref={host} className="w-full overflow-hidden rounded-xl border border-black/10 bg-[#eef0ea]" style={{ height: big ? "80vh" : 520 }} />
      {error && <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{error}</div>}
      <p className="text-[11px] text-black/50">Glisse pour tourner · molette ou pincement pour zoomer · clic droit ou deux doigts pour déplacer.</p>

      {placeMode && (
        <div className="rounded-xl border border-black/10 bg-white p-3 text-xs">
          <div className="mb-2 font-semibold">Placer une porte ou une fenêtre</div>
          <p className="mb-2 text-black/60">Choisis une ouverture dans la liste, puis clique sur un mur de sa pièce dans la vue 3D (la vue de dessus est pratique). Un cadre orange la repère.</p>
          {msg && <div className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-900">{msg}</div>}
          {openingsList.length === 0 && <p className="text-black/50">Aucune porte ni fenêtre déclarée : ajoute-les dans « Plans & pièces ».</p>}
          <div className="grid gap-1 sm:grid-cols-2">
            {openingsList.map(({ r, o }) => (
              <button
                key={o.id}
                onClick={() => { setSelected(o.id); setMsg(""); }}
                className={`rounded-lg border px-2 py-1 text-left ${selected === o.id ? "border-orange-500 bg-orange-50" : "border-black/10 hover:bg-black/5"}`}
              >
                <b>{r.name}</b> — {OPENING_LABEL[o.type]} {fmtD(o.width, 2)}×{fmtD(o.height, 2)} m {o.edge != null ? "· placée à la main" : "· position automatique"}
              </button>
            ))}
          </div>
          {sel && (
            <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-black/10 pt-3">
              <span className="font-semibold">{sel.r.name} — {OPENING_LABEL[sel.o.type]}</span>
              <button className={btn} onClick={() => nudge(-0.1)}>← 10 cm</button>
              <button className={btn} onClick={() => nudge(0.1)}>10 cm →</button>
              <label className="font-semibold">
                Allège (cm)
                <input
                  className={`${inp} ml-1`}
                  type="number"
                  min={0}
                  value={Math.round((sel.o.sill ?? (sel.o.type === "fenetre" ? (sel.o.height >= 1 ? 0.9 : 1.3) : 0)) * 100)}
                  onChange={(e) => patchOpening({ sill: Math.max(0, Number(e.target.value)) / 100 })}
                />
              </label>
              <button
                className={btn}
                onClick={() => updateRoom(sel.f.id, sel.r.id, { openings: sel.r.openings.map((o) => (o.id === sel.o.id ? { ...o, edge: undefined, t: undefined, sill: undefined } : o)) })}
              >
                Remettre en automatique
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-black/10 bg-white p-3 text-xs">
          <div className="mb-2 font-semibold">Légende</div>
          {info.legend.length === 0 && <p className="text-black/50">Rien à dessiner pour l'instant : ajoute des pièces dans « Plans & pièces ».</p>}
          <ul className="space-y-1">
            {info.legend.map((l) => (
              <li key={l.label} className="flex items-start gap-2">
                <span className="mt-0.5 h-3 w-3 shrink-0 rounded-sm border border-black/20" style={{ background: l.color }} />
                <span>{l.label}</span>
              </li>
            ))}
          </ul>
          {info.notes.map((n) => (
            <p key={n} className="mt-2 text-black/50">{n}</p>
          ))}
        </div>
        {facts.length > 0 && (
          <div className="rounded-xl border border-black/10 bg-white p-3 text-xs">
            <div className="mb-2 font-semibold">Ce qui est compté dans ce poste (plus gros montants)</div>
            <ul className="space-y-1">
              {facts.map((i) => (
                <li key={i.id} className="flex justify-between gap-2">
                  <span>{i.name}</span>
                  <span className="shrink-0 text-black/60">{fmtD(i.quantity, 1)} {i.unit} · {fmtD(i.quantity * i.unitPrice, 0)} €</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function edgeLength(project: { floors: { id: string; planScale: number; rooms: { id: string; points: { x: number; y: number }[]; x: number; y: number; length: number; width: number }[] }[] }, floorId: string, roomId: string, edge: number): number {
  const f = project.floors.find((x) => x.id === floorId);
  const r = f?.rooms.find((x) => x.id === roomId);
  if (!f || !r) return 3;
  const sc = f.planScale || 40;
  const pts = r.points.length >= 3 ? r.points : [{ x: r.x, y: r.y }, { x: r.x + r.length * sc, y: r.y }, { x: r.x + r.length * sc, y: r.y + r.width * sc }, { x: r.x, y: r.y + r.width * sc }];
  const a = pts[edge];
  const b = pts[(edge + 1) % pts.length];
  return a && b ? Math.hypot(b.x - a.x, b.y - a.y) / sc : 3;
}
