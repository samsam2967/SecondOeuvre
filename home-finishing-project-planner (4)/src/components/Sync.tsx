import { useEffect, useState } from "react";
import { Cloud, Download, LogOut, Plus, RefreshCw, Upload, FolderOpen, History, Database } from "lucide-react";
import { useStore } from "../store";
import { exportProjectJson } from "../utils/pdf";
import { SUPABASE_SQL } from "../utils/supabase";
import { Btn, Card, H } from "./ui";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function Sync() {
  const {
    cloud,
    cloudProjects,
    refreshCloudProjects,
    newCloudProject,
    openCloudProject,
    importLegacyProject,
    logout,
    replaceProject,
    project,
  } = useStore();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [showSql, setShowSql] = useState(false);

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      await fn();
      if (ok) setMsg(ok);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void run(() => refreshCloudProjects());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusLine =
    cloud.status === "error"
      ? cloud.message
      : cloud.status === "pending"
        ? "Modifications en attente d'enregistrement…"
        : cloud.status === "saving"
          ? "Enregistrement en cours…"
          : cloud.lastSavedAt
            ? `Dernier enregistrement : ${formatDate(cloud.lastSavedAt)}`
            : "Projet enregistré dans le cloud";

  return (
    <div>
      <H
        kicker="Compte & sauvegarde"
        title="Mon espace"
        sub="Vos données sont enregistrées automatiquement dans votre compte. Connectez-vous avec le même identifiant sur votre ordinateur ou votre téléphone pour retrouver exactement le même chantier."
      />

      {(msg || err) && (
        <div className={`mb-4 rounded-lg px-3 py-2 text-xs font-semibold ${err ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-900"}`}>
          {err || msg}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-t-[3px] border-t-forest">
          <div className="stamp mb-2">Mon compte</div>
          <h2 className="font-display text-xl uppercase">{cloud.email}</h2>
          <p className="mt-2 flex items-center gap-2 text-xs text-stone-600">
            <Cloud size={14} className={cloud.status === "error" ? "text-red-700" : "text-forest"} />
            {statusLine}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-stone-500">
            Projet actif : <strong>{project.settings.projectName}</strong>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Btn variant="ghost" disabled={busy} onClick={() => void run(() => refreshCloudProjects(), "Liste actualisée ✔")}>
              <RefreshCw size={14} /> Actualiser
            </Btn>
            <Btn
              variant="ghost"
              className="text-red-700"
              disabled={busy}
              onClick={() => void run(() => logout())}
            >
              <LogOut size={14} /> Se déconnecter
            </Btn>
          </div>
        </Card>

        <Card>
          <div className="stamp mb-2">Mes projets</div>
          <h2 className="font-display text-xl uppercase">Projets dans mon compte</h2>
          <p className="mt-1 text-xs text-stone-500">
            Un nouveau projet vierge est créé automatiquement à l'inscription. Vous pouvez en ajouter d'autres.
          </p>
          <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
            {cloudProjects.map((p) => {
              const active = p.id === cloud.projectId;
              return (
                <li
                  key={p.id}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${active ? "border-forest bg-emerald-50/50" : "border-rule bg-white"}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{p.name}</div>
                    <div className="text-[10px] text-stone-400">
                      Modifié le {formatDate(p.updatedAt)}
                      {active && " · projet ouvert"}
                    </div>
                  </div>
                  {!active && (
                    <Btn variant="ghost" disabled={busy} onClick={() => void run(() => openCloudProject(p.id), "Projet ouvert ✔")}>
                      <FolderOpen size={13} /> Ouvrir
                    </Btn>
                  )}
                </li>
              );
            })}
            {cloudProjects.length === 0 && <li className="text-xs text-stone-400">Aucun projet pour le moment.</li>}
          </ul>
          <div className="mt-4">
            <Btn
              variant="forest"
              disabled={busy}
              onClick={() => {
                if (!confirm("Créer un nouveau projet vierge et l'ouvrir ?")) return;
                void run(() => newCloudProject(), "Nouveau projet vierge créé ✔");
              }}
            >
              <Plus size={14} /> Nouveau projet vierge
            </Btn>
          </div>
        </Card>

        {cloud.hasLegacy && (
          <Card className="border-t-[3px] border-t-gold">
            <div className="stamp mb-2">Ancien projet de cet appareil</div>
            <h2 className="font-display text-xl uppercase">Récupérer mes données existantes</h2>
            <p className="mt-2 text-xs leading-relaxed text-stone-500">
              Un projet était enregistré sur cet appareil avant la connexion. Vous pouvez l'importer dans votre compte.
            </p>
            <div className="mt-3">
              <Btn
                variant="ghost"
                onClick={() => {
                  if (!confirm("Remplacer le projet affiché par l'ancien projet de cet appareil ?")) return;
                  void run(async () => importLegacyProject(), "Ancien projet importé ✔ — il sera enregistré dans votre compte.");
                }}
              >
                <History size={14} /> Importer l'ancien projet
              </Btn>
            </div>
          </Card>
        )}

        <Card>
          <div className="stamp mb-2">Sauvegarde fichier</div>
          <h2 className="font-display text-xl uppercase">Exporter / importer</h2>
          <p className="mt-1 text-xs text-stone-500">Une copie JSON de votre projet, à garder précieusement ou à transférer.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn variant="ink" onClick={() => exportProjectJson(project)}>
              <Download size={14} /> Exporter le projet
            </Btn>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white transition hover:bg-forest-2">
              <Upload size={14} /> Importer un fichier
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const r = new FileReader();
                  r.onload = () => {
                    try {
                      const p = JSON.parse(String(r.result));
                      if (p.floors && p.settings) {
                        replaceProject(p);
                        setMsg("Projet importé ✔ — il sera enregistré dans votre compte.");
                        setErr("");
                      } else setErr("Fichier JSON non reconnu.");
                    } catch {
                      setErr("JSON invalide.");
                    }
                  };
                  r.readAsText(f);
                }}
              />
            </label>
          </div>
        </Card>

        <Card>
          <div className="stamp mb-2">Base de données</div>
          <h2 className="font-display text-xl uppercase">Configuration Supabase</h2>
          <p className="mt-1 text-xs text-stone-500">
            Le script SQL ne sert qu'à la mise en place initiale (il est déjà exécuté si la connexion fonctionne).
          </p>
          <div className="mt-3">
            <Btn variant="ghost" onClick={() => setShowSql((v) => !v)}>
              <Database size={14} /> {showSql ? "Masquer le SQL" : "Afficher le SQL"}
            </Btn>
          </div>
          {showSql && (
            <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-ink p-3 font-mono text-[10px] leading-relaxed text-paper">
              {SUPABASE_SQL}
            </pre>
          )}
        </Card>
      </div>

      {busy && <p className="mt-4 text-xs text-stone-400">Opération en cours…</p>}
    </div>
  );
}
