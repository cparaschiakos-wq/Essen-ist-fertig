import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Der Client erwartet die Basis-Adresse des Projekts und hängt Pfade wie
 * "rest/v1" selbst an. Im Supabase-Dashboard steht an mehreren Stellen aber
 * die fertige REST-Adresse mit Pfad - wer die einträgt, bekommt Anfragen auf
 * ".../rest/v1/rest/v1" und nur rätselhafte 404er. Deshalb hier abschneiden
 * statt scheitern lassen.
 */
function normalizeUrl(value: string | undefined): string | undefined {
  if (!value) return value
  const trimmed = value.trim().replace(/\/+$/, '')
  const cleaned = trimmed.replace(/\/(rest|auth|realtime|storage)\/v\d+$/i, '')
  if (cleaned !== trimmed) {
    console.warn(
      `[Supabase] VITE_SUPABASE_URL enthielt einen Pfad und wurde auf "${cleaned}" gekürzt. ` +
        'Trage dort nur die Basis-Adresse des Projekts ein.',
    )
  }
  return cleaned
}

const url = normalizeUrl(rawUrl)

/** Noch nicht ersetzte Platzhalter aus .env.example zählen nicht als Konfiguration. */
const isPlaceholder = (value: string | undefined) =>
  !value || /dein-projekt|dein-anon-key/i.test(value)

/**
 * Ohne konfiguriertes Supabase-Projekt läuft die App im reinen Lokalmodus
 * weiter - man kann sie ausprobieren, bevor man ein Backend anlegt.
 */
export const isSupabaseConfigured = !isPlaceholder(url) && !isPlaceholder(anonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null
