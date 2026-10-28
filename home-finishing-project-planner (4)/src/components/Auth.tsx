import { useState, type ReactNode } from "react";
import { Check, Copy, Database, Eye, EyeOff, LogIn, RefreshCw } from "lucide-react";
import { signIn, SUPABASE_SQL, type SupabaseConfig } from "../utils/supabase";
import { Btn, Field, Input } from "./ui";

/** Table `projects` absente : le script SQL n'a pas encore été exécuté. */
export function DbSetupScreen({
  cfg,
  message,
  onRetry,
  onChangeAccount,
}: {
  cfg: SupabaseConfig;
  message: string;
  onRetry: () => void;
  onChangeAccount: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copiez ce script SQL :", SUPABASE_SQL);
    }
  };

  const isTableMissing = /projects|schema cache/i.test(message);

  return (
    <AuthLayout
      kicker="Étape unique d'installation"
      title="Créer la table."
      sub="Votre connexion Supabase fonctionne, mais la table qui stocke les chantiers n'existe pas encore. Elle se crée en une seule opération dans Supabase."
    >
      <ol className="mb-4 list-decimal space-y-2 pl-5 text-[12px] leading-relaxed text-stone-600">
        <li>
          Ouvrez votre projet sur <strong>supabase.com</strong>, puis le menu{" "}
          <strong>SQL Editor</strong> dans la colonne de gauche.
        </li>
        <li>
          Cliquez sur <strong>New query</strong>.
        </li>
        <li>
          Cliquez sur <strong>Copier le script</strong> ci-dessous, collez-le dans la zone de texte.
        </li>
        <li>
          Cliquez sur <strong>Run</strong> (ou Ctrl / Cmd + Entrée). Le résultat doit indiquer{" "}
          <em>Success</em>.
        </li>
        <li>
          Revenez ici et cliquez sur <strong>Réessayer</strong>. Cette opération ne se fait qu'une seule fois.
        </li>
      </ol>

      <div className="rounded-lg border border-rule bg-paper p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-600">
            <Database size={13} /> Script SQL à exécuter
          </span>
          <Btn variant="ghost" onClick={() => void copy()} className="px-2 py-1 text-[11px]">
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copié" : "Copier le script"}
          </Btn>
        </div>
        <pre className="max-h-56 overflow-auto rounded-lg bg-ink p-3 font-mono text-[10px] leading-relaxed text-paper">
          {SUPABASE_SQL}
        </pre>
      </div>

      {!isTableMissing && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-900">{message}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Btn onClick={onRetry}>
          <RefreshCw size={14} /> Réessayer
        </Btn>
        <Btn variant="ghost" onClick={onChangeAccount}>
          Changer de compte
        </Btn>
      </div>

      <p className="mt-4 border-t border-rule pt-4 text-[11px] leading-relaxed text-stone-500">
        Projet concerné : <code className="font-mono">{cfg.url}</code>. Si le projet affiché ici n'est pas le vôtre,
        corrigez-le dans <code className="font-mono">src/config/supabase.ts</code> puis redéployez.
      </p>
    </AuthLayout>
  );
}

export function AuthLayout({
  kicker,
  title,
  sub,
  children,
}: {
  kicker: string;
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-pine p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(242,194,48,0.08),transparent_40%)]" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 -rotate-3 grid-cols-2 grid-rows-2 gap-[3px] border border-white/40 p-2">
            <span className="bg-sage" />
            <span className="bg-sage opacity-60" />
            <span className="col-span-2 w-3/5 bg-sage opacity-85" />
          </div>
          <div>
            <div className="text-[13px] font-bold uppercase tracking-[0.16em] text-white">Chantier Clair</div>
            <div className="mt-0.5 text-[9px] uppercase tracking-[0.18em] text-[#a7afa2]">Le second œuvre, au juste</div>
          </div>
        </div>
        <div className="rounded-xl border border-rule border-t-[3px] border-t-gold bg-white p-7 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)]">
          <div className="stamp mb-1">{kicker}</div>
          <h1 className="font-display text-4xl uppercase leading-none text-ink">{title}</h1>
          {sub && <p className="mt-2 text-[13px] leading-relaxed text-stone-500">{sub}</p>}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Connexion uniquement : les comptes sont créés au préalable dans Supabase. */
export function LoginScreen({ cfg, onAuthed }: { cfg: SupabaseConfig; onAuthed: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const canSubmit = email.includes("@") && password.length >= 8 && !busy;

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      await signIn(cfg, email.trim(), password);
      onAuthed();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      kicker="Connexion"
      title="Bon retour."
      sub="Connectez-vous avec le compte créé par l'administrateur dans Supabase. À sa première connexion, un projet vierge lui est attribué automatiquement."
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) void submit();
        }}
      >
        <Field label="Identifiant (e-mail)">
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.fr"
          />
        </Field>
        <Field label="Mot de passe">
          <div className="relative">
            <Input
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-stone-400 hover:text-ink"
              aria-label={show ? "Masquer" : "Afficher"}
            >
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </Field>

        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">{err}</p>}

        <Btn type="submit" disabled={!canSubmit} className="w-full justify-center">
          <LogIn size={15} /> {busy ? "Connexion…" : "Se connecter"}
        </Btn>
      </form>

      <p className="mt-4 border-t border-rule pt-4 text-[11px] leading-relaxed text-stone-500">
        Pas de compte ? L'administrateur doit le créer dans Supabase → Authentication → Users.
      </p>
    </AuthLayout>
  );
}