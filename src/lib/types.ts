/** Zentrale Datentypen. Spiegeln die Tabellen in supabase/migrations. */

export type CategoryId =
  | 'obst_gemuese'
  | 'backwaren'
  | 'molkerei'
  | 'fleisch_fisch'
  | 'trocken'
  | 'konserven'
  | 'tiefkuehl'
  | 'getraenke'
  | 'suesses'
  | 'drogerie'
  | 'haushalt'
  | 'sonstiges'

export type StoreTypeId = 'supermarkt' | 'drogerie' | 'fleischer' | 'baecker' | 'markt' | 'sonstiges'

export type MealSlot = 'fruehstueck' | 'mittag' | 'abend' | 'snack'

export type RecipeSource = 'eigen' | 'cookidoo' | 'web'

/** Gemeinsame Felder aller synchronisierten Zeilen. */
export interface SyncedRecord {
  id: string
  household_id: string
  /** ISO-Zeitstempel der letzten Änderung - entscheidet bei Konflikten. */
  updated_at: string
  /** Soft Delete: Löschungen müssen sich mitsynchronisieren lassen. */
  deleted_at: string | null
}

export interface RecipeIngredient {
  /** Nur lokal für stabile React-Keys; keine eigene Tabellenzeile. */
  id: string
  name: string
  /** null = "nach Bedarf" / "etwas". */
  quantity: number | null
  unit: string | null
  category: CategoryId
  store_type: StoreTypeId
  note: string | null
  /** Gehört zum Rezept, soll aber nie auf die Einkaufsliste (z.B. Wasser). */
  skip_shopping: boolean
}

export interface RecipeStep {
  id: string
  text: string
  /** Thermomix-Einstellungen; optional, da nicht jeder Schritt am TM passiert. */
  tm_seconds: number | null
  tm_temp: string | null
  tm_speed: string | null
  tm_reverse: boolean
  tm_varoma: boolean
}

/**
 * Ein Rezept wird als ein Dokument gespeichert - Zutaten und Schritte liegen
 * als JSONB in derselben Zeile. Zwei Leute bearbeiten praktisch nie gleichzeitig
 * dasselbe Rezept, dafür wird das Speichern und Synchronisieren trivial.
 */
export interface Recipe extends SyncedRecord {
  title: string
  description: string | null
  servings: number
  source: RecipeSource
  source_url: string | null
  prep_minutes: number | null
  total_minutes: number | null
  is_thermomix: boolean
  tags: string[]
  ingredients: RecipeIngredient[]
  steps: RecipeStep[]
}

export interface PlanEntry extends SyncedRecord {
  /** ISO-Datum, z.B. "2026-09-14". */
  date: string
  slot: MealSlot
  recipe_id: string | null
  /** Freitext statt Rezept, z.B. "Reste" oder "Essen gehen". */
  custom_title: string | null
  servings: number
  note: string | null
}

export interface PantryItem extends SyncedRecord {
  name: string
  category: CategoryId
}

export type ShoppingItemSource = 'manual' | 'plan'

export interface ShoppingItem extends SyncedRecord {
  name: string
  quantity: number | null
  unit: string | null
  category: CategoryId
  store_type: StoreTypeId
  is_checked: boolean
  checked_at: string | null
  source: ShoppingItemSource
  /** Woher der Posten stammt - für die Gruppierung "nach Rezept". */
  recipe_id: string | null
  recipe_title: string | null
  note: string | null
}

export interface Household {
  id: string
  name: string
  /** Reihenfolge der Kategorien, wie sie im Stammsupermarkt liegen. */
  category_order: CategoryId[]
  updated_at: string
}

export type ConnectionState = 'lokal' | 'offline' | 'synchronisiert' | 'sync' | 'fehler'
