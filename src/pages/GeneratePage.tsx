import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { newId, store } from '../data/store'
import { useStoreData } from '../data/useStore'
import { generateShoppingItems, type GeneratedItem } from '../lib/generateList'
import { CATEGORY_BY_ID } from '../lib/taxonomy'
import { formatAmount, normalizeName } from '../lib/units'
import type { ShoppingItem } from '../lib/types'
import { Empty } from '../components/ui'

/**
 * Vorschau zwischen Wochenplan und Einkaufsliste.
 *
 * Bewusst ein eigener Schritt: Man will vor dem Übernehmen sehen, was
 * zusammengefasst wurde und was schon im Vorrat steht - sonst landen jedes Mal
 * Mehl und Salz auf der Liste.
 */
export function GeneratePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const data = useStoreData()

  const from = params.get('von') ?? ''
  const to = params.get('bis') ?? ''

  const recipesById = useMemo(
    () => new Map(data.recipes.map((recipe) => [recipe.id, recipe])),
    [data.recipes],
  )

  const entries = useMemo(
    () => data.plan_entries.filter((entry) => entry.date >= from && entry.date <= to),
    [data.plan_entries, from, to],
  )

  const result = useMemo(
    () => generateShoppingItems(entries, recipesById, data.pantry_items),
    [entries, recipesById, data.pantry_items],
  )

  /** Posten, die schon auf der Liste stehen - nicht doppelt vorschlagen. */
  const alreadyOnList = useMemo(
    () => new Set(data.shopping_items.map((item) => normalizeName(item.name))),
    [data.shopping_items],
  )

  /**
   * Nur die bewussten Klicks merken. Die Vorauswahl wird jedes Mal frisch aus
   * dem Ergebnis abgeleitet - sonst bliebe sie leer, wenn der Store beim
   * direkten Aufruf der Seite noch nicht geladen war.
   */
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})

  const isExcluded = (item: GeneratedItem) =>
    overrides[item.name] ?? (item.inPantry || alreadyOnList.has(normalizeName(item.name)))

  const selected = result.items.filter((item) => !isExcluded(item))

  async function apply() {
    await store.putMany<ShoppingItem>(
      'shopping_items',
      selected.map((item) => ({
        id: newId(),
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        store_type: item.store_type,
        is_checked: false,
        checked_at: null,
        source: 'plan' as const,
        // Bei mehreren Quellrezepten steht das erste stellvertretend in der
        // Gruppierung "nach Rezept"; alle Titel stehen in der Notiz.
        recipe_id: item.recipeIds[0] ?? null,
        recipe_title: item.recipeTitles.join(', ') || null,
        note: item.recipeTitles.length > 1 ? `aus ${item.recipeTitles.length} Rezepten` : null,
      })),
    )
    navigate('/liste')
  }

  return (
    <div className="page">
      <div className="row row--between">
        <h1>Liste erzeugen</h1>
        <button className="btn btn--ghost btn--sm" onClick={() => navigate(-1)}>
          Zurück
        </button>
      </div>

      <p className="muted">
        Aus {entries.filter((entry) => entry.recipe_id).length} geplanten Mahlzeiten. Mengen sind auf
        die geplanten Portionen hochgerechnet und gleiche Zutaten zusammengefasst.
      </p>

      {result.recipesWithoutIngredients.length > 0 && (
        <p className="banner">
          Ohne hinterlegte Zutaten und daher nicht berücksichtigt:{' '}
          {result.recipesWithoutIngredients.join(', ')}
        </p>
      )}

      {result.items.length === 0 ? (
        <Empty
          icon="🧾"
          title="Nichts zu übernehmen"
          hint="Die geplanten Rezepte haben keine Zutaten hinterlegt."
        />
      ) : (
        <>
          <div className="card">
            {result.items.map((item) => {
              const excluded = isExcluded(item)
              const known = alreadyOnList.has(normalizeName(item.name))
              return (
                <button
                  key={`${item.name}-${item.unit ?? ''}`}
                  aria-pressed={!excluded}
                  className={`item item__toggle ${excluded ? 'item--skip' : 'item--include'}`}
                  onClick={() => setOverrides((prev) => ({ ...prev, [item.name]: !excluded }))}
                >
                  <span className="item__box" aria-hidden="true">
                    ✓
                  </span>
                  <span className="grow">
                    <span className="item__name truncate" style={{ display: 'block' }}>
                      {item.name}
                    </span>
                    <span className="item__meta truncate" style={{ display: 'block' }}>
                      {CATEGORY_BY_ID[item.category].label}
                      {item.recipeTitles.length > 0 && ` · ${item.recipeTitles.join(', ')}`}
                    </span>
                  </span>
                  {item.inPantry && <span className="badge badge--ok">Vorrat</span>}
                  {known && !item.inPantry && <span className="badge">schon drauf</span>}
                  <span className="item__amount">{formatAmount(item.quantity, item.unit)}</span>
                </button>
              )
            })}
          </div>

          <p className="tiny">
            Angetippte Posten werden übersprungen. Vorbelegt sind Sachen aus dem Vorrat und solche,
            die schon auf der Liste stehen.
          </p>

          <button className="btn btn--primary btn--block" disabled={selected.length === 0} onClick={apply}>
            {selected.length} Posten auf die Einkaufsliste
          </button>
        </>
      )}
    </div>
  )
}
