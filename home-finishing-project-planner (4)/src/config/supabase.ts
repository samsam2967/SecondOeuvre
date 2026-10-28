/**
 * Connexion Supabase publique du site.
 *
 * La clé anon / publishable est conçue pour être distribuée dans le frontend.
 * La sécurité repose sur Supabase Auth et les policies RLS de `projects`.
 * Ne mettez JAMAIS la clé service_role ici.
 */
export const SUPABASE_CONFIG = {
  // Project Settings -> Data API -> Project URL, sans /rest/v1
  url: "https://uexupltptkaaxvizzzmo.supabase.co",

  // Project Settings -> API Keys -> Publishable key / anon public
  anonKey: "sb_publishable_fgZibXQSHh0TTjuBxLHHpg_IvIM5jCX",
} as const;
