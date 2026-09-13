import type { CategoryId, PantryItem, PlanEntry, Recipe, ShoppingItem, StoreTypeId } from './types'
import { fromBaseAmount, normalizeName, toBaseAmount, unitFamilyKey } from './units'

export interface GeneratedItem {
  name: string
  quantity: number | null
  unit: string | null
  category: CategoryId
  store_type: StoreTypeId
  /** Alle Rezepte, aus denen dieser Posten stammt - für die Gruppierung. */
  recipeIds: string[]
  recipeTitles: string[]
  /** Steht im Vorrat und ist deshalb vorab abgehakt. */
  inPantry: boolean
}

export interface GenerateResult {
  items: GeneratedItem[]
  /** Rezepte im Plan, die keine Zutaten hinterlegt haben. */
  recipesWithoutIngredients: string[]
}

/**
 * Baut aus den Planeinträgen einer Woche die zusammengefasste Einkaufsliste.
 *
 * Mengen werden auf die geplante Portionszahl hochgerechnet, gleiche Zutaten
 * über Rezepte hinweg addiert und Posten, die im Vorrat stehen, markiert
 * (nicht weggelassen - man will sehen, dass sie gebraucht werden).
 */
export function generateShoppingItems(
  entries: PlanEntry[],
  recipesById: Map<string, Recipe>,
  pantry: PantryItem[],
): GenerateResult {
  const pantryKeys = new Set(pantry.map((p) => normalizeName(p.name)))
  const recipesWithoutIngredients = new Set<string>()

  /** Schlüssel: Zutatenname + Einheitenfamilie. */
  const buckets = new Map<
    string,
    {
      name: string
      baseAmount: number | null
      unit: string | null
      category: CategoryId
      store_type: StoreTypeId
      recipeIds: Set<string>
      recipeTitles: Set<string>
    }
  >()

  for (const entry of entries) {
    if (entry.deleted_at || !entry.recipe_id) continue
    const recipe = recipesById.get(entry.recipe_id)
    if (!recipe) continue

    const shoppable = recipe.ingredients.filter((ingredient) => !ingredient.skip_shopping)
    if (shoppable.length === 0) {
      recipesWithoutIngredients.add(recipe.title)
      continue
    }

    // Rezept ist für recipe.servings Portionen notiert, geplant sind entry.servings.
    const factor = recipe.servings > 0 ? entry.servings / recipe.servings : 1

    for (const ingredient of shoppable) {
      const key = `${normalizeName(ingredient.name)}|${unitFamilyKey(ingredient.unit)}`
      const existing = buckets.get(key)

      // quantity === null heißt "etwas davon" - dann bleibt der Posten mengenlos.
      const addition =
        ingredient.quantity === null
          ? null
          : toBaseAmount(ingredient.quantity * factor, ingredient.unit)

      if (existing) {
        existing.baseAmount =
          existing.baseAmount === null || addition === null
            ? null
            : existing.baseAmount + addition
        existing.recipeIds.add(recipe.id)
        existing.recipeTitles.add(recipe.title)
      } else {
        buckets.set(key, {
          name: ingredient.name.trim(),
          baseAmount: addition,
          unit: ingredient.unit,
          category: ingredient.category,
          store_type: ingredient.store_type,
          recipeIds: new Set([recipe.id]),
          recipeTitles: new Set([recipe.title]),
        })
      }
    }
  }

  const items: GeneratedItem[] = [...buckets.values()].map((bucket) => {
    const amount =
      bucket.baseAmount === null
        ? { quantity: null, unit: bucket.unit }
        : fromBaseAmount(bucket.baseAmount, bucket.unit)

    return {
      name: bucket.name,
      quantity: amount.quantity,
      unit: amount.unit,
      category: bucket.category,
      store_type: bucket.store_type,
      recipeIds: [...bucket.recipeIds],
      recipeTitles: [...bucket.recipeTitles],
      inPantry: pantryKeys.has(normalizeName(bucket.name)),
    }
  })

  items.sort((a, b) => a.name.localeCompare(b.name, 'de'))
  return { items, recipesWithoutIngredients: [...recipesWithoutIngredients] }
}

export type GroupMode = 'kategorie' | 'rezept' | 'laden'

export interface ItemGroup {
  key: string
  label: string
  icon: string
  items: ShoppingItem[]
}

/**
 * Dieselbe Liste, nur anders geschnitten. Die Sortiermodi sind reine Ansichten -
 * die Posten selbst bleiben unverändert, damit ein Haken in jeder Ansicht zählt.
 */
export function groupItems(
  items: ShoppingItem[],
  mode: GroupMode,
  categoryOrder: CategoryId[],
  labels: {
    category: (id: CategoryId) => { label: string; icon: string }
    store: (id: StoreTypeId) => { label: string; icon: string }
  },
): ItemGroup[] {
  const groups = new Map<string, ItemGroup>()
  const order: string[] = []

  const push = (key: string, label: string, icon: string, item: ShoppingItem) => {
    let group = groups.get(key)
    if (!group) {
      group = { key, label, icon, items: [] }
      groups.set(key, group)
      order.push(key)
    }
    group.items.push(item)
  }

  for (const item of items) {
    if (mode === 'kategorie') {
      const def = labels.category(item.category)
      push(item.category, def.label, def.icon, item)
    } else if (mode === 'laden') {
      const def = labels.store(item.store_type)
      push(item.store_type, def.label, def.icon, item)
    } else {
      const key = item.recipe_id ?? 'manuell'
      const label = item.recipe_title ?? 'Von Hand hinzugefügt'
      push(key, label, item.recipe_id ? '📖' : '✍️', item)
    }
  }

  const result = order.map((key) => groups.get(key)!)

  if (mode === 'kategorie') {
    // Laufweg durch den Supermarkt, wie im Haushalt hinterlegt.
    const rank = new Map(categoryOrder.map((id, index) => [id as string, index]))
    result.sort((a, b) => (rank.get(a.key) ?? 999) - (rank.get(b.key) ?? 999))
  } else if (mode === 'laden') {
    result.sort((a, b) => a.label.localeCompare(b.label, 'de'))
  } else {
    // Von Hand Hinzugefügtes ans Ende, der Rest alphabetisch.
    result.sort((a, b) => {
      if (a.key === 'manuell') return 1
      if (b.key === 'manuell') return -1
      return a.label.localeCompare(b.label, 'de')
    })
  }

  for (const group of result) {
    group.items.sort((a, b) => {
      // Abgehaktes rutscht innerhalb der Gruppe nach unten.
      if (a.is_checked !== b.is_checked) return a.is_checked ? 1 : -1
      return a.name.localeCompare(b.name, 'de')
    })
  }

  return result
}
