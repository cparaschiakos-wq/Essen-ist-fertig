import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Ohne konfiguriertes Supabase-Projekt läuft die App im reinen Lokalmodus
 * weiter - man kann sie ausprobieren, bevor man ein Backend anlegt.
 */
export const isSupabaseConfigured = Boolean(url && anonKey && !url.includes('dein-projekt'))

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null
