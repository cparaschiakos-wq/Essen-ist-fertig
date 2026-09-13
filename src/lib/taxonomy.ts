import type { CategoryId, MealSlot, StoreTypeId } from './types'

export interface CategoryDef {
  id: CategoryId
  label: string
  icon: string
  /** Wo man das Zeug üblicherweise kauft - Vorbelegung beim Anlegen einer Zutat. */
  defaultStore: StoreTypeId
}

/**
 * Reihenfolge dieser Liste = Standard-Laufweg durch einen deutschen Supermarkt:
 * vorne Obst/Gemüse, dann Backwaren, Kühlregal, Trockenware, hinten Getränke,
 * Drogerie zum Schluss.
 */
export const CATEGORIES: CategoryDef[] = [
  { id: 'obst_gemuese', label: 'Obst & Gemüse', icon: '🥦', defaultStore: 'supermarkt' },
  { id: 'backwaren', label: 'Backwaren', icon: '🥖', defaultStore: 'baecker' },
  { id: 'molkerei', label: 'Kühlregal & Molkerei', icon: '🧀', defaultStore: 'supermarkt' },
  { id: 'fleisch_fisch', label: 'Fleisch & Fisch', icon: '🥩', defaultStore: 'fleischer' },
  { id: 'trocken', label: 'Trockenware & Backen', icon: '🌾', defaultStore: 'supermarkt' },
  { id: 'konserven', label: 'Konserven & Gläser', icon: '🥫', defaultStore: 'supermarkt' },
  { id: 'tiefkuehl', label: 'Tiefkühl', icon: '🧊', defaultStore: 'supermarkt' },
  { id: 'getraenke', label: 'Getränke', icon: '🧃', defaultStore: 'supermarkt' },
  { id: 'suesses', label: 'Süßes & Snacks', icon: '🍫', defaultStore: 'supermarkt' },
  { id: 'drogerie', label: 'Drogerie', icon: '🧴', defaultStore: 'drogerie' },
  { id: 'haushalt', label: 'Haushalt', icon: '🧽', defaultStore: 'drogerie' },
  { id: 'sonstiges', label: 'Sonstiges', icon: '🛒', defaultStore: 'sonstiges' },
]

export const CATEGORY_BY_ID: Record<CategoryId, CategoryDef> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, CategoryDef>

export const DEFAULT_CATEGORY_ORDER: CategoryId[] = CATEGORIES.map((c) => c.id)

export interface StoreTypeDef {
  id: StoreTypeId
  label: string
  icon: string
}

export const STORE_TYPES: StoreTypeDef[] = [
  { id: 'supermarkt', label: 'Supermarkt', icon: '🏪' },
  { id: 'drogerie', label: 'Drogeriemarkt', icon: '🧴' },
  { id: 'fleischer', label: 'Fleischer', icon: '🥩' },
  { id: 'baecker', label: 'Bäcker', icon: '🥖' },
  { id: 'markt', label: 'Wochenmarkt', icon: '🧺' },
  { id: 'sonstiges', label: 'Sonstiges', icon: '📦' },
]

export const STORE_TYPE_BY_ID: Record<StoreTypeId, StoreTypeDef> = Object.fromEntries(
  STORE_TYPES.map((s) => [s.id, s]),
) as Record<StoreTypeId, StoreTypeDef>

export interface MealSlotDef {
  id: MealSlot
  label: string
  icon: string
}

export const MEAL_SLOTS: MealSlotDef[] = [
  { id: 'fruehstueck', label: 'Frühstück', icon: '☕' },
  { id: 'mittag', label: 'Mittag', icon: '🍽️' },
  { id: 'abend', label: 'Abend', icon: '🌙' },
  { id: 'snack', label: 'Snack', icon: '🍎' },
]

export const MEAL_SLOT_BY_ID: Record<MealSlot, MealSlotDef> = Object.fromEntries(
  MEAL_SLOTS.map((s) => [s.id, s]),
) as Record<MealSlot, MealSlotDef>

/** Slots, die im Wochenplan standardmäßig angezeigt werden. */
export const PRIMARY_SLOTS: MealSlot[] = ['mittag', 'abend']
