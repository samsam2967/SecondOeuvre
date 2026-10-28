import { useEffect, useState } from "react";
import {
  BookOpen,
  BrickWall,
  ClipboardList,
  Droplets,
  Flame,
  Hammer,
  House,
  Layers,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Paintbrush,
  Plug,
  Scale,
  ShoppingCart,
  SquareStack,
  Boxes,
  Cloud,
  StickyNote,
  Wallet,
  Wind,
  X,
} from "lucide-react";
import { StoreProvider, preserveLegacyCopy, useStore, migrate, type CloudInfo, type StoreBoot } from "./store";
import type { PageId, Project } from "./types";
import { Dashboard } from "./components/Dashboard";
import { Plans } from "./components/Plans";
import { PostPage } from "./components/Posts";
import { Shopping } from "./components/Shopping";
import { Budget } from "./components/Budget";
import { Conductor } from "./components/Conductor";
import { Tutorials } from "./components/Tutorials";
import { Normes } from "./components/Normes";
import { Materiaux } from "./components/Materiaux";
import { Notes } from "./components/Notes";
import { Sync } from "./components/Sync";
import { AuthLayout, DbSetupScreen, LoginScreen } from "./components/Auth";
import { Btn } from "./components/ui";
import { cn } from "./utils/cn";
import { createEmptyProject } from "./data/defaults";
import {
  fetchProject,
  getSupabaseConfig,
  listProjects,
  saveSession,
  testSupabaseConnection,
  upsertProject,
  validSession,
  type SupabaseConfig,
  type SupabaseSession,
} from "./utils/supabase";

const NAV: { id: PageId; label: string; icon: typeof House; group: string }[] = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard, group: "Chantier" },
  { id: "plans", label: "Plans & pièces", icon: Map, group: "Chantier" },
  { id: "placo", label: "Placo & cloisons", icon: BrickWall, group: "Postes" },
  { id: "isolation", label: "Isolation", icon: Layers, group: "Postes" },
  { id: "electricite", label: "Électricité", icon: Plug, group: "Postes" },
  { id: "sanitaire", label: "Sanitaire", icon: Droplets, group: "Postes" },
  { id: "vmc", label: "VMC", icon: Wind, group: "Postes" },
  { id: "chauffage", label: "Chauffage", icon: Flame, group: "Postes" },
  { id: "peinture", label: "Peinture", icon: Paintbrush, group: "Postes" },
  { id: "carrelage", label: "Carrelage & sols", icon: SquareStack, group: "Postes" },
  { id: "quincaillerie", label: "Quincaillerie", icon: Hammer, group: "Postes" },
  { id: "courses", label: "Listes de courses", icon: ShoppingCart, group: "Pilotage" },
  { id: "budget", label: "Budget", icon: Wallet, group: "Pilotage" },
  { id: "conducteur", label: "Conducteur", icon: ClipboardList, group: "Pilotage" },
  { id: "tutoriels", label: "Tutoriels", icon: BookOpen, group: "Pilotage" },
  { id: "normes", label: "Normes", icon: Scale, group: "Pilotage" },
  { id: "materiaux", label: "Matériaux", icon: Boxes, group: "Pilotage" },
  { id: "notes", label: "Notes & liste", icon: StickyNote, group: "Pilotage" },
  { id: "sync", label: "Compte & sauvegarde", icon: Cloud, group: "Pilotage" },
];

type Phase =
  | { kind: "boot" }
  | { kind: "login"; cfg: SupabaseConfig }
  | { kind: "loading"; cfg: SupabaseConfig }
  | { kind: "error"; cfg: SupabaseConfig; message: string }
  | { kind: "dbsetup"; cfg: SupabaseConfig; message: string }
  | { kind: "ready"; cfg: SupabaseConfig; boot: StoreBoot };

/** Détecte l'absence de la table `projects` (script SQL non exécuté). */
function isTableMissing(message: string): boolean {
  const m = (message || "").toLowerCase();
  return (
    (m.includes("schema cache") && m.includes("could not find")) ||
    (m.includes("projects") && (m.includes("does not exist") || m.includes("could not find"))) ||
    m.includes("relation \"public.projects\"")
  );
}

/**
 * Ouvre l'espace du compte connecté.
 * - Compte avec un projet : on ouvre le plus récent.
 * - Nouveau compte : un projet vierge est créé automatiquement.
 */
async function loadAccount(cfg: SupabaseConfig, s: SupabaseSession): Promise<StoreBoot> {
  preserveLegacyCopy();
  const rows = await listProjects(cfg, s);
  if (rows.length > 0) {
    const full = await fetchProject(cfg, s, rows[0].id);
    return { project: migrate(JSON.parse(full.payload) as Project), projectId: full.id, email: s.email };
  }
  const id = crypto.randomUUID();
  const blank = createEmptyProject();
  blank.settings.projectName = "Mon chantier";
  await upsertProject(cfg, s, { id, name: blank.settings.projectName, payload: JSON.stringify(blank) });
  return { project: blank, projectId: id, email: s.email };
}

export default function App() {
  const [phase, setPhase] = useState<Phase>({ kind: "boot" });

  const enter = async (cfg: SupabaseConfig) => {
    setPhase({ kind: "loading", cfg });
    try {
      const s = await validSession(cfg);
      const boot = await loadAccount(cfg, s);
      setPhase({ kind: "ready", cfg, boot });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erreur inconnue.";
      if (isTableMissing(message)) setPhase({ kind: "dbsetup", cfg, message });
      else if (/Session expirée|reconnectez/i.test(message)) setPhase({ kind: "login", cfg });
      else setPhase({ kind: "error", cfg, message });
    }
  };

  useEffect(() => {
    const cfg = getSupabaseConfig();
    if (!cfg) {
      setPhase({
        kind: "error",
        cfg: { url: "", anonKey: "" },
        message:
          "Supabase n'est pas configuré dans src/config/supabase.ts. Renseignez l'URL du projet et la clé anon / publishable avant le déploiement.",
      });
      return;
    }
    // La configuration est figée dans le code : on la valide avant d'afficher
    // le formulaire afin d'éviter un obscur "Failed to fetch" à la connexion.
    testSupabaseConnection(cfg)
      .then(() => void enter(cfg))
      .catch((e) =>
        setPhase({
          kind: "error",
          cfg,
          message: e instanceof Error ? e.message : "Configuration Supabase invalide.",
        }),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  switch (phase.kind) {
    case "boot":
    case "loading":
      return (
        <div className="flex min-h-screen items-center justify-center bg-pine text-sm text-[#b9c0b4]">
          <div className="flex items-center gap-3">
            <span className="hero-dot" />
            {phase.kind === "boot" ? "Démarrage…" : "Ouverture de votre espace…"}
          </div>
        </div>
      );
    case "login": {
      const { cfg } = phase;
      return <LoginScreen cfg={cfg} onAuthed={() => void enter(cfg)} />;
    }
    case "dbsetup": {
      const { cfg, message } = phase;
      return (
        <DbSetupScreen
          cfg={cfg}
          message={message}
          onRetry={() => void enter(cfg)}
          onChangeAccount={() => {
            saveSession(null);
            setPhase({ kind: "login", cfg });
          }}
        />
      );
    }
    case "error": {
      const { cfg, message } = phase;
      return (
        <AuthLayout kicker="Connexion impossible" title="Un souci." sub={message}>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => void enter(cfg)}>Réessayer</Btn>
            <Btn
              variant="ghost"
              onClick={() => {
                saveSession(null);
                setPhase({ kind: "login", cfg });
              }}
            >
              Changer de compte
            </Btn>
          </div>
        </AuthLayout>
      );
    }
    case "ready": {
      const { cfg, boot } = phase;
      return (
        <StoreProvider boot={boot} onLogout={() => setPhase({ kind: "login", cfg })}>
          <Shell />
        </StoreProvider>
      );
    }
  }
}

function cloudLabel(c: CloudInfo): string {
  switch (c.status) {
    case "pending":
      return "Modifications en attente…";
    case "saving":
      return "Enregistrement…";
    case "saved":
      return c.lastSavedAt
        ? `Enregistré à ${new Date(c.lastSavedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
        : "Enregistré dans le cloud";
    case "error":
      return c.message || "Erreur de sauvegarde";
  }
}

function Shell() {
  const { page, setPage, project, cloud, logout } = useStore();
  const [open, setOpen] = useState(true);
  const [drawer, setDrawer] = useState(false);

  const navigate = (id: PageId) => {
    setPage(id);
    setDrawer(false);
  };

  const currentLabel = NAV.find((n) => n.id === page)?.label ?? "";
  const dot =
    cloud.status === "error" ? "bg-red-400" : cloud.status === "saved" ? "bg-emerald-400" : "bg-gold";

  return (
    <div className="flex min-h-screen">
      {/* Barre supérieure mobile */}
      <div className="no-print fixed inset-x-0 top-0 z-40 flex items-center gap-3 border-b border-white/10 bg-pine px-3 py-2.5 text-white lg:hidden">
        <button onClick={() => setDrawer(true)} aria-label="Ouvrir le menu" className="rounded-lg p-2 transition hover:bg-white/10">
          <Menu size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a7afa2]">Chantier Clair</div>
          <div className="truncate font-display text-sm uppercase leading-tight">{currentLabel}</div>
        </div>
        <span title={cloudLabel(cloud)} className={cn("h-2 w-2 rounded-full", dot)} />
        <button onClick={() => void logout()} aria-label="Se déconnecter" className="rounded-lg p-2 transition hover:bg-white/10">
          <LogOut size={17} />
        </button>
      </div>

      {drawer && <div className="no-print fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setDrawer(false)} />}

      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-50 flex h-screen w-[260px] flex-col bg-pine text-[#b9c0b4] transition-transform duration-200",
          "lg:sticky lg:top-0 lg:translate-x-0 lg:transition-all",
          drawer ? "translate-x-0" : "-translate-x-full",
          open ? "lg:w-[260px]" : "lg:w-[72px]",
        )}
      >
        <div className="flex items-center gap-1 px-2 py-4">
          <button onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1 text-left">
            <div className="grid h-10 w-10 shrink-0 -rotate-3 grid-cols-2 grid-rows-2 gap-[3px] border border-white/40 p-[7px]">
              <span className="bg-sage" />
              <span className="bg-sage opacity-60" />
              <span className="col-span-2 w-3/5 bg-sage opacity-85" />
            </div>
            {open && (
              <div className="min-w-0">
                <div className="text-[12px] font-bold uppercase leading-tight tracking-[0.16em] text-white">Chantier Clair</div>
                <div className="mt-1 text-[8px] uppercase tracking-[0.18em] text-[#a7afa2]">Le second œuvre, au juste</div>
              </div>
            )}
          </button>
          <button onClick={() => setDrawer(false)} aria-label="Fermer le menu" className="rounded-lg p-2 text-[#9aa396] transition hover:bg-white/10 hover:text-white lg:hidden">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-6">
          {["Chantier", "Postes", "Pilotage"].map((g) => (
            <div key={g} className="mb-3">
              {open && <div className="px-3 pb-1 pt-3 text-[9px] font-bold uppercase tracking-[0.18em] text-[#8d968b]">{g}</div>}
              {NAV.filter((n) => n.group === g).map((n) => {
                const Icon = n.icon;
                const active = page === n.id;
                return (
                  <button
                    key={n.id}
                    onClick={() => navigate(n.id)}
                    title={n.label}
                    className={cn(
                      "relative mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[12.5px] transition",
                      active ? "bg-sage/15 text-white" : "hover:bg-white/5 hover:text-white",
                    )}
                  >
                    {active && <span className="absolute -left-2 top-1.5 bottom-1.5 w-[3px] bg-sage" />}
                    <Icon size={16} className={cn("shrink-0", active ? "text-sage" : "text-[#98a294]")} />
                    {open && <span className="truncate">{n.label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4 text-[11px] leading-relaxed text-[#9aa396]">
          {open && (
            <>
              <div className="truncate text-[#d6dcd2]">{cloud.email}</div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
                <span className="truncate">{cloudLabel(cloud)}</span>
              </div>
              <div className="mt-1 truncate text-[10px] text-[#7f8a7d]">{project.settings.projectName}</div>
            </>
          )}
          <button
            onClick={() => void logout()}
            title="Se déconnecter"
            className={cn(
              "mt-3 inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-[11px] font-semibold text-[#b9c0b4] transition hover:border-sage/50 hover:text-white",
              !open && "justify-center px-2",
            )}
          >
            <LogOut size={13} />
            {open && "Se déconnecter"}
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-8 pt-[68px] md:px-6 lg:p-8">
        <Page />
      </main>
    </div>
  );
}

function Page() {
  const { page } = useStore();
  switch (page) {
    case "dashboard":
      return <Dashboard />;
    case "plans":
      return <Plans />;
    case "placo":
    case "isolation":
    case "electricite":
    case "sanitaire":
    case "vmc":
    case "chauffage":
    case "peinture":
    case "carrelage":
    case "quincaillerie":
      return <PostPage post={page} />;
    case "courses":
      return <Shopping />;
    case "budget":
      return <Budget />;
    case "conducteur":
      return <Conductor />;
    case "tutoriels":
      return <Tutorials />;
    case "normes":
      return <Normes />;
    case "materiaux":
      return <Materiaux />;
    case "notes":
      return <Notes />;
    case "sync":
      return <Sync />;
    default:
      return <Dashboard />;
  }
}
