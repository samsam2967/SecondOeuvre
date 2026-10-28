// Comptes et stockage cloud via l'API REST Supabase (aucun SDK à installer).
// Un compte = un identifiant (e-mail + mot de passe). Chaque compte ne voit que
// ses propres projets grâce aux règles RLS de la table public.projects.

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface SupabaseSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
  email: string;
}

export interface CloudProjectRow {
  id: string;
  name: string;
  updatedAt: string;
}

export interface CloudProjectFull extends CloudProjectRow {
  payload: string;
}

const SESSION_KEY = "cc-supabase-session";

import { SUPABASE_CONFIG } from "../config/supabase";

/** Ne garde que l'origine du projet : https://xxxx.supabase.co */
export function normalizeSupabaseUrl(input: string): string {
  let url = (input || "").trim();
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const dashboard = url.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (dashboard) return `https://${dashboard[1].toLowerCase()}.supabase.co`;
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return url.replace(/\/+$/, "").replace(/\/(rest|auth|storage|realtime)\/v1.*$/i, "");
  }
}

export function isValidSupabaseUrl(url: string): boolean {
  return /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url);
}

export function isValidSupabaseKey(key: string): boolean {
  const k = (key || "").trim();
  return /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(k) || /^sb_publishable_[A-Za-z0-9_-]+$/.test(k);
}

export function supabaseProjectRef(url: string): string | null {
  const m = normalizeSupabaseUrl(url).match(/^https:\/\/([a-z0-9-]+)\.supabase\.(co|in)$/i);
  return m ? m[1].toLowerCase() : null;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) return null;
  return {
    url: normalizeSupabaseUrl(SUPABASE_CONFIG.url),
    anonKey: SUPABASE_CONFIG.anonKey.trim(),
  };
}

export function getSession(): SupabaseSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SupabaseSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(s: SupabaseSession | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* stockage indisponible */
  }
}

/** Traduit les erreurs Supabase fréquentes en consignes actionnables. */
export function friendlySupabaseError(message: string): string {
  const m = (message || "").toLowerCase();
  if (m.includes("invalid path")) {
    return "URL incorrecte : utilisez uniquement https://xxxx.supabase.co (sans /rest/v1).";
  }
  if (m.includes("invalid api key") || m.includes("no api key") || m.includes("401")) {
    return "Clé refusée : recopiez la clé anon / publishable du projet (Project Settings → API).";
  }
  if (m.includes("email not confirmed")) {
    return "Votre e-mail n'est pas confirmé. Dans Supabase → Authentication → Users, validez le compte ; ou désactivez « Confirm email » (Authentication → Providers → Email) puis reconnectez-vous.";
  }
  if (m.includes("invalid login credentials")) {
    return "E-mail ou mot de passe incorrect. Le compte doit être créé au préalable dans Supabase → Authentication → Users.";
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "Un compte existe déjà avec cet e-mail : connectez-vous avec votre mot de passe.";
  }
  if (m.includes("password should be")) {
    return "Mot de passe trop court : 8 caractères minimum.";
  }
  if (m.includes("signups not allowed")) {
    return "Les inscriptions sont désactivées dans Supabase (Authentication → Sign In / Providers → Email).";
  }
  if (
    (m.includes("schema cache") && m.includes("could not find")) ||
    (m.includes("does not exist") && (m.includes("projects") || m.includes("relation"))) ||
    m.includes("relation \"public.projects\"")
  ) {
    return "La table projects n'existe pas encore dans ce projet Supabase.";
  }
  if (m.includes("row-level security") || m.includes("violates row-level")) {
    return "Accès refusé par la sécurité RLS : vérifiez le script SQL (policies insert / select / update sur auth.uid()).";
  }
  return message;
}

async function request<T>(
  cfg: SupabaseConfig,
  path: string,
  opts: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: string; headers?: Record<string, string> } = {},
  token?: string,
): Promise<T> {
  const base = normalizeSupabaseUrl(cfg.url);
  const headers: Record<string, string> = {
    apikey: cfg.anonKey,
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers ?? {}),
  };
  let r: Response;
  try {
    r = await fetch(`${base}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body,
      cache: "no-store",
    });
  } catch {
    throw new Error(
      `Impossible de joindre ${base}. Vérifiez l'URL du projet (Project Settings → API), que le projet n'est pas en pause, et votre connexion.`,
    );
  }
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    let msg = `Erreur ${r.status}`;
    try {
      const j = JSON.parse(text);
      msg = j.error_description || j.msg || j.message || j.error || msg;
    } catch {
      if (text) msg = text.slice(0, 160);
    }
    throw new Error(friendlySupabaseError(msg));
  }
  const text = await r.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

/** Vérifie l'URL et la clé avant d'enregistrer la configuration. */
export async function testSupabaseConnection(cfg: SupabaseConfig): Promise<void> {
  const url = normalizeSupabaseUrl(cfg.url);
  if (!isValidSupabaseUrl(url)) {
    throw new Error("L'URL doit ressembler à https://xxxx.supabase.co (sans /rest/v1).");
  }
  if (!isValidSupabaseKey(cfg.anonKey)) {
    throw new Error("La clé doit être la clé anon / publishable (pas service_role).");
  }
  let r: Response;
  try {
    r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: cfg.anonKey.trim() }, cache: "no-store" });
  } catch {
    const ref = supabaseProjectRef(url);
    throw new Error(
      `Impossible de joindre « ${url} ». ${ref && ref.length !== 20 ? `La référence ${ref} fait ${ref.length} caractères au lieu de 20 : elle est incomplète. ` : ""}Recopiez l'URL exacte depuis Supabase → Project Settings → Data API, et vérifiez que le projet n'est pas en pause.`,
    );
  }
  if (r.status === 401 || r.status === 403) throw new Error("Clé refusée par Supabase. Recopiez la clé anon / publishable.");
  if (r.status === 404) throw new Error("Projet introuvable à cette adresse. Vérifiez la référence dans l'URL.");
  if (!r.ok) throw new Error(`Supabase répond ${r.status}. Vérifiez le projet et l'URL.`);
}

interface AuthResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id: string; email?: string } | null;
}

function toSession(r: AuthResponse, fallbackEmail: string): SupabaseSession {
  if (!r.access_token || !r.refresh_token || !r.user) throw new Error("Réponse d'authentification incomplète.");
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000,
    userId: r.user.id,
    email: r.user.email ?? fallbackEmail,
  };
}

export async function signIn(cfg: SupabaseConfig, email: string, password: string): Promise<SupabaseSession> {
  const r = await request<AuthResponse>(cfg, "/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const s = toSession(r, email);
  saveSession(s);
  return s;
}

export async function signOut(cfg: SupabaseConfig, s: SupabaseSession): Promise<void> {
  try {
    await request(cfg, "/auth/v1/logout", { method: "POST", body: "{}" }, s.accessToken);
  } catch {
    /* on efface la session locale quoi qu'il arrive */
  }
  saveSession(null);
}

/** Renvoie une session valide, en la rafraîchissant si besoin. */
export async function validSession(cfg: SupabaseConfig): Promise<SupabaseSession> {
  const s = getSession();
  if (!s) throw new Error("Session expirée : reconnectez-vous.");
  if (s.expiresAt - Date.now() > 60_000) return s;
  try {
    const r = await request<AuthResponse>(cfg, "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: s.refreshToken }),
    });
    const fresh = toSession(r, s.email);
    saveSession(fresh);
    return fresh;
  } catch {
    saveSession(null);
    throw new Error("Session expirée : reconnectez-vous.");
  }
}

export async function listProjects(cfg: SupabaseConfig, s: SupabaseSession): Promise<CloudProjectRow[]> {
  const rows = await request<{ id: string; name: string; updated_at: string }[]>(
    cfg,
    "/rest/v1/projects?select=id,name,updated_at&order=updated_at.desc",
    {},
    s.accessToken,
  );
  return (rows ?? []).map((r) => ({ id: r.id, name: r.name, updatedAt: r.updated_at }));
}

export async function fetchProject(cfg: SupabaseConfig, s: SupabaseSession, id: string): Promise<CloudProjectFull> {
  const rows = await request<{ id: string; name: string; payload: string; updated_at: string }[]>(
    cfg,
    `/rest/v1/projects?id=eq.${encodeURIComponent(id)}&select=id,name,payload,updated_at`,
    {},
    s.accessToken,
  );
  const r = rows?.[0];
  if (!r) throw new Error("Projet introuvable dans votre compte.");
  return { id: r.id, name: r.name, payload: r.payload, updatedAt: r.updated_at };
}

/** Crée le projet ou met à jour la ligne existante (upsert sur l'id). */
export async function upsertProject(
  cfg: SupabaseConfig,
  s: SupabaseSession,
  p: { id: string; name: string; payload: string },
): Promise<void> {
  await request(
    cfg,
    "/rest/v1/projects?on_conflict=id",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        id: p.id,
        name: p.name,
        payload: p.payload,
        owner_id: s.userId,
        updated_at: new Date().toISOString(),
      }),
    },
    s.accessToken,
  );
}

export const SUPABASE_SQL = `-- Supabase > SQL Editor > coller puis Run (une seule fois)
create table if not exists public.projects (
  id         uuid primary key,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  name       text not null default 'Mon chantier',
  payload    text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists projects_owner_idx on public.projects (owner_id, updated_at desc);

alter table public.projects enable row level security;

drop policy if exists "insert own" on public.projects;
drop policy if exists "select own" on public.projects;
drop policy if exists "update own" on public.projects;
drop policy if exists "delete own" on public.projects;

create policy "insert own" on public.projects for insert with check (auth.uid() = owner_id);
create policy "select own" on public.projects for select using (auth.uid() = owner_id);
create policy "update own" on public.projects for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "delete own" on public.projects for delete using (auth.uid() = owner_id);`;
