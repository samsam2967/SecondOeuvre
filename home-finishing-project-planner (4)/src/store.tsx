import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createDemoProject, createEmptyProject, DEFAULT_SETTINGS } from "./data/defaults";
import { ISOLANTS } from "./data/catalogs";
import type { Expense, Floor, PageId, Partition, Project, Room, Settings, Task } from "./types";
import { compute, type CalcResult } from "./utils/calc";
import { rectPoints, syncFromPoints } from "./utils/geometry";
import { uid } from "./utils/id";
import { emptyElec } from "./utils/rooms";
import {
  fetchProject,
  getSession,
  getSupabaseConfig,
  listProjects,
  saveSession,
  signOut,
  upsertProject,
  validSession,
  type CloudProjectRow,
  type SupabaseConfig,
} from "./utils/supabase";

/** Copie locale (cache) du projet actif. */
export const CACHE_KEY = "atelier-second-oeuvre-v1";
/** Projet d'avant la connexion, conservé une seule fois pour pouvoir l'importer. */
export const LEGACY_KEY = "atelier-legacy-local-project";

export type CloudStatus = "pending" | "saving" | "saved" | "error";

export interface CloudInfo {
  email: string;
  projectId: string;
  status: CloudStatus;
  message: string;
  lastSavedAt: string | null;
  hasLegacy: boolean;
}

export interface StoreBoot {
  project: Project;
  projectId: string;
  email: string;
}

interface Store {
  project: Project;
  page: PageId;
  setPage: (p: PageId) => void;
  calc: CalcResult;
  setSettings: (s: Settings | ((s: Settings) => Settings)) => void;
  patchSettings: <K extends keyof Settings>(key: K, value: Settings[K] | ((v: Settings[K]) => Settings[K])) => void;
  addFloor: (f: Floor) => void;
  updateFloor: (id: string, patch: Partial<Floor> | ((f: Floor) => Floor)) => void;
  removeFloor: (id: string) => void;
  addRoom: (floorId: string, room: Room) => void;
  updateRoom: (floorId: string, roomId: string, patch: Partial<Room>) => void;
  removeRoom: (floorId: string, roomId: string) => void;
  addPartition: (floorId: string, p: Partition) => void;
  updatePartition: (floorId: string, id: string, patch: Partial<Partition>) => void;
  removePartition: (floorId: string, id: string) => void;
  addExpense: (e?: Partial<Expense>) => void;
  updateExpense: (id: string, patch: Partial<Expense>) => void;
  removeExpense: (id: string) => void;
  setTask: (id: string, patch: Partial<Task>) => void;
  resetTasks: () => void;
  replaceProject: (p: Project) => void;
  resetProject: () => void;
  loadDemo: () => void;
  cloud: CloudInfo;
  cloudProjects: CloudProjectRow[];
  refreshCloudProjects: () => Promise<void>;
  newCloudProject: () => Promise<void>;
  openCloudProject: (id: string) => Promise<void>;
  importLegacyProject: () => void;
  logout: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

function requireCloud(): SupabaseConfig {
  const c = getSupabaseConfig();
  if (!c) throw new Error("Supabase n'est pas configuré sur cet appareil.");
  return c;
}

function hasLegacyCopy(): boolean {
  try {
    return !!localStorage.getItem(LEGACY_KEY);
  } catch {
    return false;
  }
}

/** À appeler avant le premier chargement cloud : garde une copie du projet local existant. */
export function preserveLegacyCopy() {
  try {
    const cache = localStorage.getItem(CACHE_KEY);
    if (!cache || localStorage.getItem(LEGACY_KEY)) return;
    const p = JSON.parse(cache) as Project;
    if (p?.floors?.some((f) => f.rooms.length > 0)) localStorage.setItem(LEGACY_KEY, cache);
  } catch {
    /* ignore */
  }
}

/** Complète les projets anciens avec les champs ajoutés au fil du temps. */
export function migrate(p: Project): Project {
  const d = DEFAULT_SETTINGS;
  const merge = (a: Record<string, number>, b?: Record<string, number>) => ({ ...a, ...(b ?? {}) });
  const s = p.settings;
  const settings: Settings = {
    ...d,
    ...s,
    placo: {
      ...d.placo,
      ...s?.placo,
      plaqueSizes: { ...d.placo.plaqueSizes, ...(s?.placo?.plaqueSizes ?? {}) },
      prices: merge(d.placo.prices, s?.placo?.prices),
    },
    isolation: { ...d.isolation, ...s?.isolation, marginPct: s?.isolation?.marginPct ?? d.isolation.marginPct, prices: merge(d.isolation.prices, s?.isolation?.prices) },
    elec: { ...d.elec, ...s?.elec, marginPct: (s?.elec as { marginPct?: number })?.marginPct ?? d.elec.marginPct, prices: merge(d.elec.prices, s?.elec?.prices) },
    sanitaire: { ...d.sanitaire, ...s?.sanitaire, marginPct: (s?.sanitaire as { marginPct?: number })?.marginPct ?? d.sanitaire.marginPct, prices: merge(d.sanitaire.prices, s?.sanitaire?.prices) },
    vmc: { ...d.vmc, ...s?.vmc, wastePct: s?.vmc?.wastePct ?? d.vmc.wastePct, marginPct: (s?.vmc as { marginPct?: number })?.marginPct ?? d.vmc.marginPct, prices: merge(d.vmc.prices, s?.vmc?.prices) },
    chauffage: {
      ...d.chauffage,
      ...s?.chauffage,
      prices: {
        ...merge(d.chauffage.prices, s?.chauffage?.prices),
        pac_air_eau: s?.chauffage?.prices?.pac_air_eau ?? s?.chauffage?.pacPrix ?? d.chauffage.prices.pac_air_eau,
      },
    },
    peinture: { ...d.peinture, ...s?.peinture, marginPct: (s?.peinture as { marginPct?: number })?.marginPct ?? d.peinture.marginPct, paints: s?.peinture?.paints?.length ? s.peinture.paints : structuredClone(d.peinture.paints), prices: merge(d.peinture.prices, s?.peinture?.prices) },
    carrelage: { ...d.carrelage, ...s?.carrelage, marginPct: (s?.carrelage as { marginPct?: number })?.marginPct ?? d.carrelage.marginPct, tiles: s?.carrelage?.tiles?.length ? s.carrelage.tiles : structuredClone(d.carrelage.tiles), prices: merge(d.carrelage.prices, s?.carrelage?.prices) },
    quincaillerie: {
      ...d.quincaillerie,
      ...s?.quincaillerie,
      marginPct: (s?.quincaillerie as { marginPct?: number })?.marginPct ?? d.quincaillerie.marginPct,
      prices: merge(d.quincaillerie.prices, s?.quincaillerie?.prices),
    },
    isolants: s?.isolants?.length ? s.isolants : structuredClone(ISOLANTS),
    shoppingSelection: s?.shoppingSelection ?? {},
    productLinks: s?.productLinks ?? {},
    todoList: s?.todoList ?? [],
  };
  const floors = (p.floors ?? []).map((f) => {
    const scale = f.planScale || 40;
    const rooms = (f.rooms ?? []).map((r) => {
      const elec = { ...emptyElec(), ...r.elec };
      elec.prisesConnected = r.elec?.prisesConnected ?? !!r.elec?.connected;
      elec.interConnected = r.elec?.interConnected ?? !!r.elec?.connected;
      const room: Room = {
        ...r,
        elec,
        points: r.points ?? [],
        areaM2: r.areaM2 ?? 0,
        perimeterM: r.perimeterM ?? 0,
        exteriorEdges: r.exteriorEdges ?? [],
        wallTypes: r.wallTypes ?? {},
        prixCarrelageM2: r.prixCarrelageM2 ?? 0,
        prixFaienceM2: r.prixFaienceM2 ?? 0,
        carreauL: r.carreauL ?? 0,
        carreauW: r.carreauW ?? 0,
        faienceL: r.faienceL ?? 0,
        faienceW: r.faienceW ?? 0,
        prixPeintureMurPot: r.prixPeintureMurPot ?? 0,
        prixPeinturePlafondPot: r.prixPeinturePlafondPot ?? 0,
        tileSolId: (r as { tileSolId?: string }).tileSolId,
        tileMurId: (r as { tileMurId?: string }).tileMurId,
        paintWallId: (r as { paintWallId?: string }).paintWallId,
        paintCeilId: (r as { paintCeilId?: string }).paintCeilId,
      };
      const pts =
        room.points.length >= 3 ? room.points : rectPoints(room.x, room.y, room.length * scale, room.width * scale);
      return syncFromPoints(room, pts, scale);
    });
    return {
      ...f,
      planWidth: f.planWidth || 1000,
      planHeight: f.planHeight || 700,
      rooms,
      partitions: f.partitions ?? [],
    };
  });
  return { ...p, version: 2, settings, floors };
}

export function StoreProvider({
  children,
  boot,
  onLogout,
}: {
  children: ReactNode;
  boot: StoreBoot;
  onLogout: () => void;
}) {
  const [project, setProject] = useState<Project>(() => migrate(boot.project));
  const [page, setPage] = useState<PageId>("dashboard");
  const [projectId, setProjectId] = useState(boot.projectId);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>("saved");
  const [cloudMessage, setCloudMessage] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [cloudProjects, setCloudProjects] = useState<CloudProjectRow[]>([]);
  const [hasLegacy, setHasLegacy] = useState<boolean>(hasLegacyCopy);

  const projectRef = useRef(project);
  projectRef.current = project;
  const idRef = useRef(projectId);
  idRef.current = projectId;
  // JSON du dernier état connu côté cloud : sert à détecter les modifications non enregistrées.
  const savedRef = useRef(JSON.stringify(project));
  const remoteStampRef = useRef<string>("1970-01-01T00:00:00.000Z");
  const timerRef = useRef<number | null>(null);
  const chainRef = useRef<Promise<void>>(Promise.resolve());

  // Cache local (utile si la connexion coupe un instant)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(project));
      } catch {
        /* quota */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [project]);

  const doSave = async (p: Project, id: string) => {
    const json = JSON.stringify(p);
    if (json === savedRef.current) return;
    setCloudStatus("saving");
    try {
      const cfg = requireCloud();
      const s = await validSession(cfg);
      await upsertProject(cfg, s, { id, name: p.settings.projectName || "Mon chantier", payload: json });
      const now = new Date().toISOString();
      savedRef.current = json;
      remoteStampRef.current = now;
      setLastSavedAt(now);
      setCloudStatus("saved");
      setCloudMessage("");
    } catch (e) {
      setCloudStatus("error");
      setCloudMessage(e instanceof Error ? e.message : "Sauvegarde impossible.");
    }
  };

  // Les sauvegardes sont mises en file pour ne jamais s'écraser entre elles.
  const saveNow = (p: Project = projectRef.current, id: string = idRef.current) => {
    chainRef.current = chainRef.current.then(() => doSave(p, id));
    return chainRef.current;
  };

  const hasUnsaved = () => JSON.stringify(projectRef.current) !== savedRef.current;

  // Enregistrement automatique 1,5 s après la dernière modification
  useEffect(() => {
    if (JSON.stringify(project) === savedRef.current) return;
    setCloudStatus("pending");
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void saveNow();
    }, 1500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  // Quitter l'onglet / téléphone en veille : on enregistre tout de suite.
  // Retour à l'écran : on récupère une version plus récente venant d'un autre appareil.
  useEffect(() => {
    const pull = async () => {
      if (document.visibilityState !== "visible") return;
      if (timerRef.current !== null || hasUnsaved()) return;
      const cfg = getSupabaseConfig();
      if (!cfg || !getSession()) return;
      try {
        const s = await validSession(cfg);
        const row = await fetchProject(cfg, s, idRef.current);
        if (row.payload === savedRef.current) return;
        if (Date.parse(row.updatedAt) <= Date.parse(remoteStampRef.current) + 1000) return;
        const remote = migrate(JSON.parse(row.payload) as Project);
        projectRef.current = remote;
        savedRef.current = JSON.stringify(remote);
        remoteStampRef.current = row.updatedAt;
        setProject(remote);
        setLastSavedAt(row.updatedAt);
        setCloudStatus("saved");
      } catch {
        /* hors-ligne : on réessaiera */
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        void saveNow();
      } else {
        void pull();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    const interval = window.setInterval(() => void pull(), 45000);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const refreshCloudProjects = async () => {
    const cfg = requireCloud();
    const s = await validSession(cfg);
    setCloudProjects(await listProjects(cfg, s));
  };

  const newCloudProject = async () => {
    await saveNow();
    if (hasUnsaved()) throw new Error("Enregistrement en cours impossible : vérifiez la connexion puis réessayez.");
    const id = crypto.randomUUID();
    const blank = createEmptyProject();
    blank.settings.projectName = "Nouveau chantier";
    await saveNow(blank, id);
    idRef.current = id;
    setProjectId(id);
    projectRef.current = blank;
    setProject(blank);
    setPage("dashboard");
    await refreshCloudProjects();
  };

  const openCloudProject = async (id: string) => {
    await saveNow();
    if (hasUnsaved()) throw new Error("Enregistrement en cours impossible : vérifiez la connexion puis réessayez.");
    const cfg = requireCloud();
    const s = await validSession(cfg);
    const row = await fetchProject(cfg, s, id);
    const p = migrate(JSON.parse(row.payload) as Project);
    savedRef.current = JSON.stringify(p);
    remoteStampRef.current = row.updatedAt;
    idRef.current = id;
    setProjectId(id);
    projectRef.current = p;
    setProject(p);
    setLastSavedAt(row.updatedAt);
    setCloudStatus("saved");
    setCloudMessage("");
    setPage("dashboard");
  };

  const importLegacyProject = () => {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const p = migrate(JSON.parse(raw) as Project);
    projectRef.current = p;
    setProject(p);
    setPage("dashboard");
    setHasLegacy(false);
    try {
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* ignore */
    }
  };

  const logout = async () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await saveNow();
    if (hasUnsaved() && !window.confirm("Des modifications ne sont pas encore enregistrées. Se déconnecter quand même ?")) {
      return;
    }
    const cfg = getSupabaseConfig();
    const s = getSession();
    if (cfg && s) await signOut(cfg, s);
    else saveSession(null);
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      /* ignore */
    }
    onLogout();
  };

  const calc = useMemo(() => compute(project), [project]);

  const mutate = (fn: (p: Project) => Project) =>
    setProject((p) => ({ ...fn(p), updatedAt: new Date().toISOString() }));

  const store: Store = {
    project,
    page,
    setPage,
    calc,
    setSettings: (s) => mutate((p) => ({ ...p, settings: typeof s === "function" ? s(p.settings) : s })),
    patchSettings: (key, value) =>
      mutate((p) => {
        const current = p.settings[key];
        const next = typeof value === "function" ? (value as (v: typeof current) => typeof current)(current) : value;
        return { ...p, settings: { ...p.settings, [key]: next } };
      }),
    addFloor: (f) => mutate((p) => ({ ...p, floors: [...p.floors, f] })),
    updateFloor: (id, patch) =>
      mutate((p) => ({
        ...p,
        floors: p.floors.map((f) => (f.id === id ? (typeof patch === "function" ? patch(f) : { ...f, ...patch }) : f)),
      })),
    removeFloor: (id) => mutate((p) => ({ ...p, floors: p.floors.filter((f) => f.id !== id) })),
    addRoom: (floorId, room) =>
      mutate((p) => ({
        ...p,
        floors: p.floors.map((f) => (f.id === floorId ? { ...f, rooms: [...f.rooms, room] } : f)),
      })),
    updateRoom: (floorId, roomId, patch) =>
      mutate((p) => ({
        ...p,
        floors: p.floors.map((f) =>
          f.id === floorId ? { ...f, rooms: f.rooms.map((r) => (r.id === roomId ? { ...r, ...patch } : r)) } : f,
        ),
      })),
    removeRoom: (floorId, roomId) =>
      mutate((p) => ({
        ...p,
        floors: p.floors.map((f) => (f.id === floorId ? { ...f, rooms: f.rooms.filter((r) => r.id !== roomId) } : f)),
      })),
    addPartition: (floorId, part) =>
      mutate((p) => ({
        ...p,
        floors: p.floors.map((f) => (f.id === floorId ? { ...f, partitions: [...f.partitions, part] } : f)),
      })),
    updatePartition: (floorId, id, patch) =>
      mutate((p) => ({
        ...p,
        floors: p.floors.map((f) =>
          f.id === floorId ? { ...f, partitions: f.partitions.map((x) => (x.id === id ? { ...x, ...patch } : x)) } : f,
        ),
      })),
    removePartition: (floorId, id) =>
      mutate((p) => ({
        ...p,
        floors: p.floors.map((f) => (f.id === floorId ? { ...f, partitions: f.partitions.filter((x) => x.id !== id) } : f)),
      })),
    addExpense: (e) =>
      mutate((p) => ({
        ...p,
        expenses: [
          {
            id: uid(),
            date: new Date().toISOString().slice(0, 10),
            post: "divers",
            label: "Achat",
            amount: 0,
            status: "prevu",
            vendor: "",
            notes: "",
            ...e,
          },
          ...p.expenses,
        ],
      })),
    updateExpense: (id, patch) =>
      mutate((p) => ({ ...p, expenses: p.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
    removeExpense: (id) => mutate((p) => ({ ...p, expenses: p.expenses.filter((e) => e.id !== id) })),
    setTask: (id, patch) =>
      mutate((p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
    resetTasks: () => mutate((p) => ({ ...p, tasks: createEmptyProject().tasks })),
    replaceProject: (pr) => setProject(migrate({ ...pr, updatedAt: new Date().toISOString() })),
    resetProject: () => setProject(createEmptyProject()),
    loadDemo: () => setProject(createDemoProject()),
    cloud: {
      email: boot.email,
      projectId,
      status: cloudStatus,
      message: cloudMessage,
      lastSavedAt,
      hasLegacy,
    },
    cloudProjects,
    refreshCloudProjects,
    newCloudProject,
    openCloudProject,
    importLegacyProject,
    logout,
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("Store missing");
  return s;
}
