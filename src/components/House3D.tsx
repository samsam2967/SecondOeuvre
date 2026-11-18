import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { POSTS } from "../data/catalogs";
import { useStore } from "../store";
import type { Fixture, FixtureKind, Opening, PostId, Room } from "../types";
import { uid } from "../utils/id";
import { buildScene, ELEC_FIXTURES, FIXTURE_SPEC, OPENING_LABEL, SANITARY_FIXTURES, type Built, type Scene3DOptions, type WallPick } from "../utils/scene3d";
import { fmtD } from "../utils/format";
import { floorElevations } from "../utils/elecPlan";

const btn = "rounded-lg border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-black/5 disabled:opacity-40";
const btnOn = "rounded-lg border border-black bg-black px-3 py-1.5 text-xs font-semibold text-white";

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

const OPENING_PRESET: Record<Opening["type"], { width: number; height: number; wall: Opening["wall"] }> = {
  porte: { width: 0.9, height: 2.04, wall: "cloison" },
  fenetre: { width: 1.2, height: 1.15, wall: "exterieur" },
  baie: { width: 2.4, height: 2.15, wall: "exterieur" },
  porte_fenetre: { width: 0.9, height: 2.15, wall: "exterieur" },
  porte_garage: { width: 2.4, height: 2.0, wall: "exterieur" },
  arche: { width: 1.2, height: 2.1, wall: "cloison" },
  trappe: { width: 0.6, height: 0.6, wall: "plafond" },
};
const OPENING_TYPES: Opening["type"][] = ["porte", "fenetre", "baie", "porte_fenetre", "porte_garage", "arche"];
const cm = (m: number) => Math.round(m * 100);

type Sel = { kind: "opening" | "fixture"; id: string } | null;

function Scene({ post }: { post: PostId | "all" }) {
  const { project, calc, updateRoom, updateFloor } = useStore();
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
  const [faithful, setFaithful] = useState(true);
  const [big, setBig] = useState(false);
  const [placeMode, setPlaceMode] = useState(false);
  const [selected, setSelected] = useState<Sel>(null);
  const [preview, setPreview] = useState<{ id: string; edge: number; u: number } | null>(null);
  const [snap, setSnap] = useState(true);
  const [tick, setTick] = useState(0);
  const [msg, setMsg] = useState("");
  const [info, setInfo] = useState<{ legend: Built["legend"]; notes: string[]; placements: Built["placements"]; fixtures: Built["fixtures"]; autoRooms: Built["autoRooms"]; walls: Built["walls"] }>({
    legend: [],
    notes: [],
    placements: new Map(),
    fixtures: new Map(),
    autoRooms: new Set(),
    walls: new Map(),
  });
  const [error, setError] = useState("");
  const [addRoomId, setAddRoomId] = useState("");
  const [addKind, setAddKind] = useState("fixture:prise");

  const opts: Scene3DOptions = useMemo(
    () => ({
      layers,
      floorId,
      ceilings,
      xray,
      ossature,
      cuts,
      faithful,
      selectedOpening: selected?.kind === "opening" ? selected.id : null,
      selectedFixture: selected?.kind === "fixture" ? selected.id : null,
      preview,
      fixturesAll: placeMode,
    }),
    [layers, floorId, ceilings, xray, ossature, cuts, faithful, selected, preview, placeMode],
  );
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const stateRef = useRef({ placeMode, selected, project, snap });
  stateRef.current = { placeMode, selected, project, snap };
  const drag = useRef<{ id: string; kind: "opening" | "fixture"; roomId: string; moved: boolean } | null>(null);
  const previewRef = useRef<{ id: string; edge: number; u: number } | null>(null);
  const commitRef = useRef<(id: string, kind: "opening" | "fixture", roomId: string, edge: number, u: number) => void>(() => undefined);

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

    const ray = new THREE.Raycaster();
    const ndcOf = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    const elementAt = (e: PointerEvent): { kind: "opening" | "fixture"; id: string; roomId?: string } | null => {
      if (!built.current) return null;
      ray.setFromCamera(ndcOf(e), camera);
      const hit = ray.intersectObjects(built.current.elements, true)[0];
      let o: THREE.Object3D | null = hit?.object ?? null;
      while (o && !o.userData?.element) o = o.parent;
      return o ? { kind: o.userData.element, id: o.userData.id, roomId: o.userData.roomId } : null;
    };
    const roomOfOpening = (id: string) => {
      for (const f of stateRef.current.project.floors) for (const rm of f.rooms) if (rm.openings.some((o) => o.id === id)) return rm.id;
      return "";
    };
    /** Paroi et position (m depuis le début de la paroi) sous le curseur, pour une pièce donnée. */
    const wallUnder = (e: PointerEvent, roomId: string): { edge: number; u: number } | null => {
      if (!built.current) return null;
      ray.setFromCamera(ndcOf(e), camera);
      const hits = ray.intersectObjects(built.current.pickables, false);
      const hit = hits.find((h) => (h.object.userData as WallPick).roomId === roomId);
      const pick = hit?.object.userData as WallPick | undefined;
      if (hit && pick) {
        const dx = pick.bx - pick.ax;
        const dy = pick.by - pick.ay;
        const l = Math.hypot(dx, dy);
        const t = ((hit.point.x - pick.ax) * dx + (hit.point.z - pick.ay) * dy) / (l * l);
        return { edge: pick.edge, u: Math.min(l - 0.05, Math.max(0.05, t * l)) };
      }
      // clic au sol (vue de dessus) : paroi de la pièce la plus proche
      const st = stateRef.current;
      const floor = st.project.floors.find((f) => f.rooms.some((r) => r.id === roomId));
      const room = floor?.rooms.find((r) => r.id === roomId);
      if (!floor || !room) return null;
      const sc = floor.planScale || 40;
      const fo = { x: floor.offsetX ?? 0, y: floor.offsetY ?? 0 };
      const pts = (room.points.length >= 3 ? room.points : [{ x: room.x, y: room.y }, { x: room.x + room.length * sc, y: room.y }, { x: room.x + room.length * sc, y: room.y + room.width * sc }, { x: room.x, y: room.y + room.width * sc }]).map((p) => ({ x: p.x / sc + fo.x, y: p.y / sc + fo.y }));
      const elevY = floorElevations(st.project.floors, st.project.settings.elec.slabM ?? 0.3).get(floor.id) ?? 0;
      const target = new THREE.Vector3();
      if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -elevY), target)) return null;
      let best = Infinity;
      let res: { edge: number; u: number } | null = null;
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
          res = { edge: i, u: u * Math.sqrt(l2) };
        }
      });
      return best > 1.5 ? null : res;
    };
    const snapU = (u: number) => (stateRef.current.snap ? Math.round(u / 0.05) * 0.05 : Math.round(u * 100) / 100);

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !stateRef.current.placeMode) return;
      const hit = elementAt(e);
      if (!hit) return;
      const roomId = hit.roomId ?? roomOfOpening(hit.id);
      setSelected({ kind: hit.kind, id: hit.id });
      drag.current = { id: hit.id, kind: hit.kind, roomId, moved: false };
      controls.enabled = false;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const w = wallUnder(e, d.roomId);
      if (!w) return;
      d.moved = true;
      const pv = { id: d.id, edge: w.edge, u: snapU(w.u) };
      previewRef.current = pv;
      setPreview(pv);
    };
    const onUp = (e: PointerEvent) => {
      const d = drag.current;
      if (d) {
        drag.current = null;
        controls.enabled = true;
        const pv = previewRef.current;
        previewRef.current = null;
        if (d.moved && pv) commitRef.current(d.id, d.kind, d.roomId, pv.edge, pv.u);
        setPreview(null);
        return;
      }
      // clic simple sur un mur : l'élément sélectionné vient s'y placer
      const st = stateRef.current;
      if (!st.placeMode || !st.selected || !built.current) return;
      if (Math.hypot(e.movementX, e.movementY) > 5) return;
      const roomId = st.selected.kind === "fixture" ? (Array.from(built.current.fixtures.entries()).find(([, l]) => l.some((f) => f.id === st.selected!.id))?.[0] ?? "") : roomOfOpening(st.selected.id);
      if (!roomId) return;
      const w = wallUnder(e, roomId);
      if (!w) {
        setMsg("Clique sur ou près d'un mur de la pièce de l'élément sélectionné pour l'y placer.");
        return;
      }
      commitRef.current(st.selected.id, st.selected.kind, roomId, w.edge, snapU(w.u));
      setMsg("");
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onUp);

    return () => {
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
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
      const next = buildScene(project, optsRef.current, { cache: texCache.current, redraw: t.render, rebuild: () => setTick((n) => n + 1) });
      if (built.current) {
        t.group.remove(built.current.root);
        built.current.dispose();
      }
      built.current = next;
      t.group.add(next.root);
      setInfo({ legend: next.legend, notes: next.notes, placements: next.placements, fixtures: next.fixtures, autoRooms: next.autoRooms, walls: next.walls });
      const key = `${floorId}`;
      if (fitted.current !== key) {
        fitted.current = key;
        fit("iso");
      } else t.render();
    };
    if (!built.current) run();
    // pendant un glissement, on reconstruit presque tout de suite pour que l'aperçu suive la souris
    const id = window.setTimeout(run, built.current ? (preview ? 30 : 140) : 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, opts, tick]);

  const toggleLayer = (id: PostId) =>
    setLayers((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const visibleFloors = floors.filter((f) => floorId === "all" || f.id === floorId);
  const roomsList = visibleFloors.flatMap((f) => f.rooms.map((r) => ({ f, r })));

  type Entry = { key: string; kind: "opening" | "fixture"; id: string; f: (typeof floors)[number]; r: Room; label: string; o?: Opening; fx?: Fixture; auto?: boolean };
  const entries: Entry[] = roomsList.flatMap(({ f, r }) => [
    ...r.openings
      .filter((o) => o.wall !== "plafond" && o.type !== "trappe")
      .map((o): Entry => ({ key: o.id, kind: "opening", id: o.id, f, r, o, label: `${OPENING_LABEL[o.type]} ${fmtD(o.width, 2)}×${fmtD(o.height, 2)} m` })),
    ...(info.fixtures.get(r.id) ?? []).map((fx): Entry => ({ key: fx.id, kind: "fixture", id: fx.id, f, r, fx, auto: info.autoRooms.has(r.id), label: fx.label ?? FIXTURE_SPEC[fx.kind]?.label ?? fx.kind })),
  ]);
  const sel = selected ? entries.find((x) => x.id === selected.id) : undefined;
  const lenOf = (roomId: string, edge: number) => info.walls.get(`${roomId}:${edge}`)?.len ?? 3;
  const selEdge = sel ? (sel.kind === "opening" ? info.placements.get(sel.id)?.edge : sel.fx?.edge) : undefined;
  const selU = sel && selEdge != null ? (sel.kind === "opening" ? (info.placements.get(sel.id)?.t ?? 0.5) * lenOf(sel.r.id, selEdge) : (sel.fx?.u ?? 0)) : 0;
  const selLen = sel && selEdge != null ? lenOf(sel.r.id, selEdge) : 0;
  const nEdges = sel ? Math.max(3, (sel.r.points.length >= 3 ? sel.r.points.length : 4)) : 4;

  /** Rend manuels les éléments d'une pièce encore répartis automatiquement (indispensable avant toute modification). */
  const materialize = (_f: { id: string }, r: Room): Fixture[] => r.fixtures ?? (info.fixtures.get(r.id) ?? []).map((x) => ({ ...x, id: uid() }));

  const patchOpening = (e: Entry, patch: Partial<Opening>) => updateRoom(e.f.id, e.r.id, { openings: e.r.openings.map((o) => (o.id === e.id ? { ...o, ...patch } : o)) });
  const patchFixture = (e: Entry, patch: Partial<Fixture>) => {
    if (!e.fx) return;
    if (e.auto) {
      // première modification : on fige la répartition automatique de la pièce, puis on modifie l'élément choisi
      const idx = (info.fixtures.get(e.r.id) ?? []).findIndex((x) => x.id === e.id);
      const frozen = materialize(e.f, e.r);
      const target = frozen[idx];
      if (!target) return;
      updateRoom(e.f.id, e.r.id, { fixtures: frozen.map((x) => (x.id === target.id ? { ...x, ...patch } : x)) });
      setSelected({ kind: "fixture", id: target.id });
      return;
    }
    updateRoom(e.f.id, e.r.id, { fixtures: (e.r.fixtures ?? []).map((x) => (x.id === e.id ? { ...x, ...patch } : x)) });
  };
  const setPosition = (e: Entry, edge: number, u: number) => {
    const len = lenOf(e.r.id, edge);
    const uu = Math.min(len - 0.02, Math.max(0.02, u));
    if (e.kind === "opening") patchOpening(e, { edge, t: Math.min(0.99, Math.max(0.01, uu / Math.max(0.1, len))) });
    else patchFixture(e, { edge, u: uu });
  };
  commitRef.current = (id, kind, roomId, edge, u) => {
    const e = entries.find((x) => x.id === id) ?? roomsList.flatMap(({ f, r }) => (kind === "opening" ? r.openings.filter((o) => o.id === id).map((o): Entry => ({ key: id, kind, id, f, r, o, label: "" })) : [])).find(Boolean);
    if (e && e.r.id === roomId) setPosition(e, edge, u);
  };
  const nudge = (dm: number) => sel && selEdge != null && setPosition(sel, selEdge, selU + dm);
  const removeEntry = (e: Entry) => {
    if (e.kind === "opening") updateRoom(e.f.id, e.r.id, { openings: e.r.openings.filter((o) => o.id !== e.id) });
    else {
      const idx = (info.fixtures.get(e.r.id) ?? []).findIndex((x) => x.id === e.id);
      const base = materialize(e.f, e.r);
      updateRoom(e.f.id, e.r.id, { fixtures: base.filter((_, i) => (e.auto ? i !== idx : base[i].id !== e.id)) });
    }
    setSelected(null);
  };
  const duplicateEntry = (e: Entry) => {
    if (e.kind === "opening" && e.o) {
      const n: Opening = { ...e.o, id: uid() };
      if (selEdge != null) {
        n.edge = selEdge;
        n.t = Math.min(0.97, (selU + e.o.width + 0.1) / Math.max(0.1, selLen));
      }
      updateRoom(e.f.id, e.r.id, { openings: [...e.r.openings, n] });
      setSelected({ kind: "opening", id: n.id });
    } else if (e.fx) {
      const base = materialize(e.f, e.r);
      const src = e.auto ? base[(info.fixtures.get(e.r.id) ?? []).findIndex((x) => x.id === e.id)] : base.find((x) => x.id === e.id);
      if (!src) return;
      const n: Fixture = { ...src, id: uid(), u: Math.min(lenOf(e.r.id, src.edge) - 0.05, src.u + src.w + 0.1) };
      updateRoom(e.f.id, e.r.id, { fixtures: [...base, n] });
      setSelected({ kind: "fixture", id: n.id });
    }
  };
  const addElement = () => {
    const rm = roomsList.find((x) => x.r.id === (addRoomId || roomsList[0]?.r.id));
    if (!rm) return;
    // paroi la plus longue qui n'est pas ouverte
    let best = -1;
    let bestLen = 0;
    const n = rm.r.points.length >= 3 ? rm.r.points.length : 4;
    for (let i = 0; i < n; i++) {
      const w = info.walls.get(`${rm.r.id}:${i}`);
      if (w && !w.open && w.len > bestLen) {
        best = i;
        bestLen = w.len;
      }
    }
    if (best < 0) {
      setMsg("Cette pièce n'a aucune paroi pleine (toutes ses parois sont ouvertes).");
      return;
    }
    const [kind, what] = addKind.split(":") as ["opening" | "fixture", string];
    if (kind === "opening") {
      const type = what as Opening["type"];
      const pre = OPENING_PRESET[type];
      const o: Opening = { id: uid(), type, width: pre.width, height: pre.height, wall: pre.wall, edge: best, t: 0.5 };
      updateRoom(rm.f.id, rm.r.id, { openings: [...rm.r.openings, o] });
      setSelected({ kind: "opening", id: o.id });
    } else {
      const sp = FIXTURE_SPEC[what as FixtureKind];
      const fx: Fixture = { id: uid(), kind: what as FixtureKind, edge: best, u: bestLen / 2, z: sp.z, w: sp.w, d: sp.d, h: sp.h };
      updateRoom(rm.f.id, rm.r.id, { fixtures: [...materialize(rm.f, rm.r), fx] });
      setSelected({ kind: "fixture", id: fx.id });
    }
    setMsg("");
  };
  const nudgeFloor = (fid: string, dx: number, dy: number) => {
    const f = floors.find((x) => x.id === fid);
    if (f) updateFloor(fid, { offsetX: Math.round(((f.offsetX ?? 0) + dx) * 100) / 100, offsetY: Math.round(((f.offsetY ?? 0) + dy) * 100) / 100 });
  };

  const facts = post === "all" ? [] : [...calc.byPost[post]].sort((a, b) => b.quantity * b.unitPrice - a.quantity * a.unitPrice).slice(0, 7);
  const numInp = "w-20 rounded-lg border border-black/15 bg-white px-2 py-1 text-sm";
  const lineBtn = (dm: number) => (
    <button key={dm} className={btn} onClick={() => nudge(dm)}>
      {dm < 0 ? "←" : ""} {Math.abs(dm * 100)} cm {dm > 0 ? "→" : ""}
    </button>
  );

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
        <label className="flex items-center gap-1" title="Couleurs et textures exactes du produit, sans ombrage"><input type="checkbox" checked={faithful} onChange={(e) => setFaithful(e.target.checked)} /> Couleurs fidèles</label>
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
          {placeMode ? "Terminer l'édition des éléments" : "Éditer les éléments de mur"}
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

      <div ref={host} className="w-full overflow-hidden rounded-xl border border-black/10 bg-[#eef0ea]" style={{ height: big ? "80vh" : 520, cursor: placeMode ? "crosshair" : "grab" }} />
      {error && <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{error}</div>}
      <p className="text-[11px] text-black/50">Glisse pour tourner · molette ou pincement pour zoomer · clic droit ou deux doigts pour déplacer.{placeMode ? " En mode édition : glisse un élément le long des murs pour le déplacer." : ""}</p>

      {floors.length > 1 && (
        <details className="rounded-xl border border-black/10 bg-white p-3 text-xs">
          <summary className="cursor-pointer font-semibold">Superposition des étages</summary>
          <p className="my-2 text-black/60">Si un étage n'est pas exactement au-dessus de l'autre, décale-le ici (même réglage que dans « Plans & pièces »). Le rez-de-chaussée sert de référence.</p>
          {[...floors].sort((a, b) => a.level - b.level).slice(1).map((f) => (
            <div key={f.id} className="mb-1 flex flex-wrap items-center gap-1.5">
              <b className="w-32">{f.name}</b>
              <span className="text-black/50">X {cm(f.offsetX ?? 0)} cm · Y {cm(f.offsetY ?? 0)} cm</span>
              {([[-0.1, 0, "← 10"], [0.1, 0, "10 →"], [0, -0.1, "↑ 10"], [0, 0.1, "↓ 10"], [-0.01, 0, "← 1"], [0.01, 0, "1 →"], [0, -0.01, "↑ 1"], [0, 0.01, "↓ 1"]] as [number, number, string][]).map(([dx, dy, l]) => (
                <button key={l} className={btn} onClick={() => nudgeFloor(f.id, dx, dy)}>{l} cm</button>
              ))}
              <button className={btn} onClick={() => updateFloor(f.id, { offsetX: 0, offsetY: 0 })}>Remettre à 0</button>
            </div>
          ))}
        </details>
      )}

      {placeMode && (
        <div className="rounded-xl border border-black/10 bg-white p-3 text-xs">
          <div className="mb-2 font-semibold">Éléments de mur : portes, fenêtres, prises, interrupteurs, sanitaire…</div>
          <p className="mb-2 text-black/60">
            Clique un élément dans la vue 3D (ou dans la liste), puis glisse-le le long des murs ou règle sa position au centimètre. Les changements sont enregistrés dans le projet : ils apparaissent dans tous les postes et dans « Plans & pièces ».
          </p>
          {msg && <div className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-900">{msg}</div>}

          <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg bg-black/[0.03] p-2">
            <label className="font-semibold">
              Ajouter dans
              <select className="ml-1 rounded-lg border border-black/15 bg-white px-2 py-1 text-sm" value={addRoomId || roomsList[0]?.r.id || ""} onChange={(e) => setAddRoomId(e.target.value)}>
                {roomsList.map(({ r }) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
            <label className="font-semibold">
              un(e)
              <select className="ml-1 rounded-lg border border-black/15 bg-white px-2 py-1 text-sm" value={addKind} onChange={(e) => setAddKind(e.target.value)}>
                <optgroup label="Ouvertures">
                  {OPENING_TYPES.map((t) => (
                    <option key={t} value={`opening:${t}`}>{OPENING_LABEL[t]}</option>
                  ))}
                </optgroup>
                <optgroup label="Électricité">
                  {ELEC_FIXTURES.map((k) => (
                    <option key={k} value={`fixture:${k}`}>{FIXTURE_SPEC[k].label}</option>
                  ))}
                </optgroup>
                <optgroup label="Sanitaire et équipements">
                  {SANITARY_FIXTURES.map((k) => (
                    <option key={k} value={`fixture:${k}`}>{FIXTURE_SPEC[k].label}</option>
                  ))}
                </optgroup>
              </select>
            </label>
            <button className={btnOn} onClick={addElement}>Ajouter</button>
            <label className="flex items-center gap-1"><input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} /> Aimanter à 5 cm en glissant</label>
          </div>

          {entries.length === 0 && <p className="text-black/50">Aucun élément : ajoute des pièces dans « Plans & pièces », ou ajoute un élément ci-dessus.</p>}
          <div className="grid gap-1 sm:grid-cols-2">
            {entries.map((e) => (
              <button
                key={e.key}
                onClick={() => { setSelected({ kind: e.kind, id: e.id }); setMsg(""); }}
                className={`rounded-lg border px-2 py-1 text-left ${selected?.id === e.id ? "border-orange-500 bg-orange-50" : "border-black/10 hover:bg-black/5"}`}
              >
                <b>{e.r.name}</b> — {e.label}
                {e.kind === "opening" ? (e.o?.edge != null ? " · placée à la main" : " · position automatique") : e.auto ? " · automatique" : ""}
              </button>
            ))}
          </div>

          {(() => {
            const rooms = roomsList.filter(({ r }) => info.autoRooms.has(r.id) && (info.fixtures.get(r.id) ?? []).length > 0);
            if (!rooms.length) return null;
            return (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-black/60">
                <span>Pièces dont prises, interrupteurs et sanitaire sont répartis automatiquement :</span>
                {rooms.map(({ f, r }) => (
                  <button key={r.id} className={btn} onClick={() => updateRoom(f.id, r.id, { fixtures: materialize(f, r) })}>
                    Personnaliser « {r.name} »
                  </button>
                ))}
              </div>
            );
          })()}

          {sel && (
            <div className="mt-3 space-y-2 border-t border-black/10 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{sel.r.name} — {sel.label}</span>
                <button className={btn} onClick={() => duplicateEntry(sel)}>Dupliquer</button>
                <button className={`${btn} text-red-700`} onClick={() => removeEntry(sel)}>Supprimer</button>
                {sel.kind === "opening" && (
                  <button className={btn} onClick={() => patchOpening(sel, { edge: undefined, t: undefined, sill: undefined })}>Remettre en automatique</button>
                )}
              </div>

              <div className="flex flex-wrap items-end gap-2">
                {sel.kind === "opening" && sel.o && (
                  <label className="font-semibold">
                    Type
                    <select
                      className="ml-1 rounded-lg border border-black/15 bg-white px-2 py-1 text-sm"
                      value={sel.o.type}
                      onChange={(e) => {
                        const type = e.target.value as Opening["type"];
                        const pre = OPENING_PRESET[type];
                        patchOpening(sel, { type, width: pre.width, height: pre.height, wall: pre.wall, sill: undefined });
                      }}
                    >
                      {OPENING_TYPES.map((t) => (
                        <option key={t} value={t}>{OPENING_LABEL[t]}</option>
                      ))}
                    </select>
                  </label>
                )}
                {sel.kind === "fixture" && sel.fx && (
                  <label className="font-semibold">
                    Type
                    <select className="ml-1 rounded-lg border border-black/15 bg-white px-2 py-1 text-sm" value={sel.fx.kind} onChange={(e) => {
                      const k = e.target.value as FixtureKind;
                      const sp = FIXTURE_SPEC[k];
                      patchFixture(sel, { kind: k, w: sp.w, d: sp.d, h: sp.h, z: sp.z, label: undefined });
                    }}>
                      <optgroup label="Électricité">{ELEC_FIXTURES.map((k) => <option key={k} value={k}>{FIXTURE_SPEC[k].label}</option>)}</optgroup>
                      <optgroup label="Sanitaire et équipements">{SANITARY_FIXTURES.map((k) => <option key={k} value={k}>{FIXTURE_SPEC[k].label}</option>)}</optgroup>
                    </select>
                  </label>
                )}
                <label className="font-semibold">
                  Paroi
                  <select className="ml-1 rounded-lg border border-black/15 bg-white px-2 py-1 text-sm" value={selEdge ?? 0} onChange={(e) => setPosition(sel, Number(e.target.value), Math.min(selU, lenOf(sel.r.id, Number(e.target.value)) - 0.05))}>
                    {Array.from({ length: nEdges }, (_, i) => (
                      <option key={i} value={i} disabled={info.walls.get(`${sel.r.id}:${i}`)?.open}>
                        Paroi {i + 1} ({fmtD(lenOf(sel.r.id, i), 2)} m){info.walls.get(`${sel.r.id}:${i}`)?.open ? " — ouverte" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="font-semibold">
                  Position du centre (cm depuis le début de la paroi)
                  <input className={`${numInp} ml-1`} type="number" step={1} value={cm(selU)} onChange={(e) => setPosition(sel, selEdge ?? 0, Number(e.target.value) / 100)} />
                </label>
              </div>
              {selEdge != null && (
                <p className="text-black/60">
                  À {cm(selU - (sel.kind === "opening" ? (sel.o?.width ?? 0) : (sel.fx?.w ?? 0)) / 2)} cm du début de la paroi · {cm(selLen - selU - (sel.kind === "opening" ? (sel.o?.width ?? 0) : (sel.fx?.w ?? 0)) / 2)} cm de la fin (paroi de {fmtD(selLen, 2)} m)
                </p>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold">Décaler :</span>
                {[-0.5, -0.1, -0.05, -0.01].map(lineBtn)}
                {[0.01, 0.05, 0.1, 0.5].map(lineBtn)}
                <button className={btn} onClick={() => selEdge != null && setPosition(sel, selEdge, selLen / 2)}>Centrer sur la paroi</button>
              </div>

              {sel.kind === "opening" && sel.o && (
                <div className="flex flex-wrap items-end gap-3">
                  <label className="font-semibold">Largeur (cm)
                    <input className={`${numInp} ml-1`} type="number" min={10} value={cm(sel.o.width)} onChange={(e) => patchOpening(sel, { width: Math.max(0.1, Number(e.target.value) / 100) })} />
                  </label>
                  <label className="font-semibold">Hauteur (cm)
                    <input className={`${numInp} ml-1`} type="number" min={10} value={cm(sel.o.height)} onChange={(e) => patchOpening(sel, { height: Math.max(0.1, Number(e.target.value) / 100) })} />
                  </label>
                  <label className="font-semibold">Allège (cm)
                    <input className={`${numInp} ml-1`} type="number" min={0} value={cm(sel.o.sill ?? (sel.o.type === "fenetre" ? (sel.o.height >= 1 ? 0.9 : 1.3) : 0))} onChange={(e) => patchOpening(sel, { sill: Math.max(0, Number(e.target.value)) / 100 })} />
                  </label>
                </div>
              )}
              {sel.kind === "fixture" && sel.fx && (
                <div className="flex flex-wrap items-end gap-3">
                  <label className="font-semibold">{FIXTURE_SPEC[sel.fx.kind]?.elec ? "Hauteur du centre (cm)" : "Hauteur du bas (cm)"}
                    <input className={`${numInp} ml-1`} type="number" min={0} value={cm(sel.fx.z)} onChange={(e) => patchFixture(sel, { z: Math.max(0, Number(e.target.value) / 100) })} />
                  </label>
                  <label className="font-semibold">Largeur (cm)
                    <input className={`${numInp} ml-1`} type="number" min={1} value={cm(sel.fx.w)} onChange={(e) => patchFixture(sel, { w: Math.max(0.01, Number(e.target.value) / 100) })} />
                  </label>
                  <label className="font-semibold">Profondeur (cm)
                    <input className={`${numInp} ml-1`} type="number" min={1} value={cm(sel.fx.d)} onChange={(e) => patchFixture(sel, { d: Math.max(0.01, Number(e.target.value) / 100) })} />
                  </label>
                  <label className="font-semibold">Hauteur de l'objet (cm)
                    <input className={`${numInp} ml-1`} type="number" min={1} value={cm(sel.fx.h)} onChange={(e) => patchFixture(sel, { h: Math.max(0.01, Number(e.target.value) / 100) })} />
                  </label>
                  <button className={btn} onClick={() => { const sp = FIXTURE_SPEC[sel.fx!.kind]; patchFixture(sel, { w: sp.w, d: sp.d, h: sp.h, z: sp.z }); }}>Dimensions usuelles</button>
                </div>
              )}
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
