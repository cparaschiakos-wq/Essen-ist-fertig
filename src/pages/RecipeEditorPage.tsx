import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { newId, store } from '../data/store'
import { useStoreData } from '../data/useStore'
import { CATEGORIES, STORE_TYPES } from '../lib/taxonomy'
import { UNIT_OPTIONS } from '../lib/units'
import { defaultStoreFor, guessCategory } from '../lib/guessCategory'
import {
  formatThermomixSettings,
  parseCookidooUrl,
  parseIngredientLine,
  parseRecipeText,
  parseThermomixSettings,
} from '../lib/importRecipe'
import type { Recipe, RecipeIngredient, RecipeSource, RecipeStep } from '../lib/types'
import { Field, Sheet } from '../components/ui'

interface Draft {
  title: string
  description: string
  servings: number
  source: RecipeSource
  source_url: string
  total_minutes: string
  is_thermomix: boolean
  tags: string
  ingredients: RecipeIngredient[]
  steps: RecipeStep[]
}

function emptyDraft(): Draft {
  return {
    title: '',
    description: '',
    servings: 4,
    source: 'eigen',
    source_url: '',
    total_minutes: '',
    is_thermomix: false,
    tags: '',
    ingredients: [],
    steps: [],
  }
}

function toDraft(recipe: Recipe): Draft {
  return {
    title: recipe.title,
    description: recipe.description ?? '',
    servings: recipe.servings,
    source: recipe.source,
    source_url: recipe.source_url ?? '',
    total_minutes: recipe.total_minutes ? String(recipe.total_minutes) : '',
    is_thermomix: recipe.is_thermomix,
    tags: recipe.tags.join(', '),
    ingredients: recipe.ingredients,
    steps: recipe.steps,
  }
}

export function RecipeEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const data = useStoreData()
  const isNew = id === 'neu'

  const existing = useMemo(
    () => (isNew ? null : (data.recipes.find((recipe) => recipe.id === id) ?? null)),
    [data.recipes, id, isNew],
  )

  // Die ID muss beim ersten Rendern feststehen: der Routenparameter ist bei
  // einem neuen Rezept "neu" und taugt nicht als Schlüssel.
  const [recipeId] = useState(() => (isNew ? newId() : (id ?? newId())))
  const [draft, setDraft] = useState<Draft>(() => (existing ? toDraft(existing) : emptyDraft()))
  const [loaded, setLoaded] = useState(isNew)
  const [showImport, setShowImport] = useState(false)

  // Beim Direktaufruf per URL ist der Store evtl. noch nicht geladen - dann
  // einmalig nachziehen, sobald das Rezept auftaucht.
  useEffect(() => {
    if (!loaded && existing) {
      setDraft(toDraft(existing))
      setLoaded(true)
    }
  }, [existing, loaded])

  const cookidoo = parseCookidooUrl(draft.source_url)

  function update(patch: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  function addIngredient(line = '') {
    const parsed = line ? parseIngredientLine(line) : null
    update({
      ingredients: [
        ...draft.ingredients,
        {
          id: newId(),
          name: parsed?.name ?? '',
          quantity: parsed?.quantity ?? null,
          unit: parsed?.unit ?? null,
          category: parsed?.category ?? 'sonstiges',
          store_type: parsed?.store_type ?? 'supermarkt',
          note: parsed?.note ?? null,
          skip_shopping: parsed?.skip_shopping ?? false,
        },
      ],
    })
  }

  function patchIngredient(ingredientId: string, patch: Partial<RecipeIngredient>) {
    update({
      ingredients: draft.ingredients.map((ingredient) =>
        ingredient.id === ingredientId ? { ...ingredient, ...patch } : ingredient,
      ),
    })
  }

  function addStep() {
    update({
      steps: [
        ...draft.steps,
        {
          id: newId(),
          text: '',
          tm_seconds: null,
          tm_temp: null,
          tm_speed: null,
          tm_reverse: false,
          tm_varoma: false,
        },
      ],
    })
  }

  function patchStep(stepId: string, patch: Partial<RecipeStep>) {
    update({
      steps: draft.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)),
    })
  }

  async function save() {
    const title = draft.title.trim()
    if (!title) return

    await store.put<Recipe>('recipes', {
      id: existing?.id ?? recipeId,
      title,
      description: draft.description.trim() || null,
      servings: Math.max(1, draft.servings),
      source: draft.source,
      source_url: draft.source_url.trim() || null,
      prep_minutes: null,
      total_minutes: draft.total_minutes ? Number.parseInt(draft.total_minutes, 10) : null,
      is_thermomix: draft.is_thermomix,
      tags: draft.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      ingredients: draft.ingredients.filter((ingredient) => ingredient.name.trim()),
      steps: draft.steps.filter((step) => step.text.trim()),
    })
    navigate('/rezepte')
  }

  return (
    <div className="page">
      <div className="row row--between">
        <h1>{isNew ? 'Neues Rezept' : 'Rezept bearbeiten'}</h1>
        <button className="btn btn--ghost btn--sm" onClick={() => navigate(-1)}>
          Abbrechen
        </button>
      </div>

      {isNew && (
        <button className="btn btn--block" onClick={() => setShowImport(true)}>
          📋 Rezepttext einfügen
        </button>
      )}

      <div className="card card--pad stack">
        <Field label="Titel">
          <input
            className="input"
            value={draft.title}
            placeholder="z.B. Linsensuppe"
            onChange={(event) => update({ title: event.target.value })}
          />
        </Field>

        <div className="row" style={{ gap: 10 }}>
          <Field label="Portionen">
            <input
              className="input"
              type="number"
              min={1}
              inputMode="numeric"
              value={draft.servings}
              onChange={(event) => update({ servings: Number.parseInt(event.target.value, 10) || 1 })}
            />
          </Field>
          <Field label="Dauer (Min.)">
            <input
              className="input"
              type="number"
              min={0}
              inputMode="numeric"
              value={draft.total_minutes}
              onChange={(event) => update({ total_minutes: event.target.value })}
            />
          </Field>
        </div>

        <Field label="Quelle">
          <select
            className="select"
            value={draft.source}
            onChange={(event) => update({ source: event.target.value as RecipeSource })}
          >
            <option value="eigen">Eigenes Rezept</option>
            <option value="cookidoo">Cookidoo</option>
            <option value="web">Website / Kochbuch</option>
          </select>
        </Field>

        {draft.source !== 'eigen' && (
          <Field label={draft.source === 'cookidoo' ? 'Cookidoo-Link' : 'Link'}>
            <input
              className="input"
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={draft.source_url}
              onChange={(event) => {
                const url = event.target.value
                // Ein Cookidoo-Link bedeutet praktisch immer Thermomix.
                const detected = parseCookidooUrl(url)
                update({
                  source_url: url,
                  is_thermomix: detected.isCookidoo ? true : draft.is_thermomix,
                  source: detected.isCookidoo ? 'cookidoo' : draft.source,
                })
              }}
            />
          </Field>
        )}

        {draft.source === 'cookidoo' && (
          <p className="banner">
            Cookidoo-Rezepte lassen sich nicht automatisch abrufen – die Inhalte sind lizenziert und
            haben keine offene Schnittstelle. Gespeichert wird der Link
            {cookidoo.recipeId ? ` (${cookidoo.recipeId})` : ''}; die Zutaten trägst du unten ein oder
            fügst sie als Text ein.
          </p>
        )}

        <label className="row" style={{ gap: 9 }}>
          <input
            type="checkbox"
            style={{ width: 22, height: 22 }}
            checked={draft.is_thermomix}
            onChange={(event) => update({ is_thermomix: event.target.checked })}
          />
          <span>Thermomix-Rezept (Schritte mit Zeit / Temperatur / Stufe)</span>
        </label>

        <Field label="Schlagwörter (mit Komma getrennt)">
          <input
            className="input"
            placeholder="schnell, vegetarisch, Kinder"
            value={draft.tags}
            onChange={(event) => update({ tags: event.target.value })}
          />
        </Field>
      </div>

      <div className="row row--between">
        <h2>Zutaten</h2>
        <button className="btn btn--sm" onClick={() => addIngredient()}>
          + Zutat
        </button>
      </div>

      <div className="stack">
        {draft.ingredients.map((ingredient) => (
          <div key={ingredient.id} className="card card--pad stack">
            <div className="row" style={{ gap: 8 }}>
              <input
                className="input"
                style={{ flex: '0 0 72px' }}
                type="number"
                inputMode="decimal"
                step="any"
                placeholder="Menge"
                value={ingredient.quantity ?? ''}
                onChange={(event) =>
                  patchIngredient(ingredient.id, {
                    quantity: event.target.value === '' ? null : Number.parseFloat(event.target.value),
                  })
                }
              />
              <select
                className="select"
                style={{ flex: '0 0 96px' }}
                value={ingredient.unit ?? ''}
                onChange={(event) =>
                  patchIngredient(ingredient.id, { unit: event.target.value || null })
                }
              >
                <option value="">—</option>
                {UNIT_OPTIONS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
              <input
                className="input grow"
                placeholder="Zutat"
                value={ingredient.name}
                onChange={(event) => patchIngredient(ingredient.id, { name: event.target.value })}
                onBlur={(event) => {
                  // Kategorie erst raten, wenn der Name fertig getippt ist.
                  const name = event.target.value.trim()
                  if (!name || ingredient.category !== 'sonstiges') return
                  const category = guessCategory(name)
                  patchIngredient(ingredient.id, { category, store_type: defaultStoreFor(category) })
                }}
              />
            </div>

            <div className="row" style={{ gap: 8 }}>
              <select
                className="select grow"
                value={ingredient.category}
                onChange={(event) =>
                  patchIngredient(ingredient.id, {
                    category: event.target.value as RecipeIngredient['category'],
                    store_type: defaultStoreFor(event.target.value as RecipeIngredient['category']),
                  })
                }
              >
                {CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.label}
                  </option>
                ))}
              </select>
              <select
                className="select grow"
                value={ingredient.store_type}
                onChange={(event) =>
                  patchIngredient(ingredient.id, {
                    store_type: event.target.value as RecipeIngredient['store_type'],
                  })
                }
              >
                {STORE_TYPES.map((storeType) => (
                  <option key={storeType.id} value={storeType.id}>
                    {storeType.icon} {storeType.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="row row--between">
              <label className="row tiny" style={{ gap: 7 }}>
                <input
                  type="checkbox"
                  style={{ width: 20, height: 20 }}
                  checked={ingredient.skip_shopping}
                  onChange={(event) =>
                    patchIngredient(ingredient.id, { skip_shopping: event.target.checked })
                  }
                />
                Nicht auf die Einkaufsliste
              </label>
              <button
                className="btn btn--ghost btn--sm btn--danger"
                onClick={() =>
                  update({
                    ingredients: draft.ingredients.filter((entry) => entry.id !== ingredient.id),
                  })
                }
              >
                Löschen
              </button>
            </div>
          </div>
        ))}

        {draft.ingredients.length === 0 && (
          <p className="muted">Noch keine Zutaten. Ohne Zutaten entsteht später keine Einkaufsliste.</p>
        )}
      </div>

      <div className="row row--between">
        <h2>Zubereitung</h2>
        <button className="btn btn--sm" onClick={addStep}>
          + Schritt
        </button>
      </div>

      <div className="stack">
        {draft.steps.map((step, index) => (
          <div key={step.id} className="card card--pad stack">
            <div className="row row--between">
              <span className="tiny" style={{ fontWeight: 700 }}>
                Schritt {index + 1}
              </span>
              <button
                className="btn btn--ghost btn--sm btn--danger"
                onClick={() => update({ steps: draft.steps.filter((entry) => entry.id !== step.id) })}
              >
                Löschen
              </button>
            </div>

            <textarea
              className="textarea"
              style={{ minHeight: 74 }}
              placeholder="Was passiert in diesem Schritt?"
              value={step.text}
              onChange={(event) => patchStep(step.id, { text: event.target.value })}
              onBlur={(event) => {
                // "3 Min./100°C/Stufe 2" aus dem Text übernehmen, sofern die
                // Felder noch leer sind - spart bei Thermomix-Rezepten viel Tipperei.
                if (!draft.is_thermomix) return
                if (step.tm_seconds !== null || step.tm_temp || step.tm_speed) return
                const parsed = parseThermomixSettings(event.target.value)
                if (parsed.tm_seconds !== null || parsed.tm_temp || parsed.tm_speed) {
                  patchStep(step.id, parsed)
                }
              }}
            />

            {draft.is_thermomix && (
              <>
                <div className="row" style={{ gap: 8 }}>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    placeholder="Sek."
                    value={step.tm_seconds ?? ''}
                    onChange={(event) =>
                      patchStep(step.id, {
                        tm_seconds:
                          event.target.value === '' ? null : Number.parseInt(event.target.value, 10),
                      })
                    }
                  />
                  <input
                    className="input"
                    placeholder="Temp."
                    value={step.tm_temp ?? ''}
                    onChange={(event) => patchStep(step.id, { tm_temp: event.target.value || null })}
                  />
                  <input
                    className="input"
                    placeholder="Stufe"
                    value={step.tm_speed ?? ''}
                    onChange={(event) => patchStep(step.id, { tm_speed: event.target.value || null })}
                  />
                </div>
                <div className="row row--wrap" style={{ gap: 14 }}>
                  <label className="row tiny" style={{ gap: 7 }}>
                    <input
                      type="checkbox"
                      style={{ width: 20, height: 20 }}
                      checked={step.tm_reverse}
                      onChange={(event) => patchStep(step.id, { tm_reverse: event.target.checked })}
                    />
                    Linkslauf
                  </label>
                  <label className="row tiny" style={{ gap: 7 }}>
                    <input
                      type="checkbox"
                      style={{ width: 20, height: 20 }}
                      checked={step.tm_varoma}
                      onChange={(event) => patchStep(step.id, { tm_varoma: event.target.checked })}
                    />
                    Varoma
                  </label>
                  {formatThermomixSettings(step) && (
                    <span className="badge badge--tm">{formatThermomixSettings(step)}</span>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <button className="btn btn--primary btn--block" disabled={!draft.title.trim()} onClick={save}>
        Rezept speichern
      </button>

      {existing && (
        <button
          className="btn btn--danger btn--block"
          onClick={async () => {
            if (!confirm(`„${existing.title}" wirklich löschen?`)) return
            await store.remove('recipes', existing.id)
            navigate('/rezepte')
          }}
        >
          Rezept löschen
        </button>
      )}

      {showImport && (
        <ImportSheet
          onClose={() => setShowImport(false)}
          onApply={(text) => {
            const parsed = parseRecipeText(text)
            update({
              title: draft.title || parsed.title,
              servings: parsed.servings ?? draft.servings,
              ingredients: [
                ...draft.ingredients,
                ...parsed.ingredients.map((ingredient) => ({ ...ingredient, id: newId() })),
              ],
              steps: [...draft.steps, ...parsed.steps.map((step) => ({ ...step, id: newId() }))],
              is_thermomix:
                draft.is_thermomix || parsed.steps.some((step) => step.tm_speed || step.tm_temp),
            })
            setShowImport(false)
          }}
        />
      )}
    </div>
  )
}

function ImportSheet({
  onClose,
  onApply,
}: {
  onClose: () => void
  onApply: (text: string) => void
}) {
  const [text, setText] = useState('')

  return (
    <Sheet title="Rezepttext einfügen" onClose={onClose}>
      <div className="stack">
        <p className="muted">
          Rezept aus einer anderen App teilen oder abtippen und hier einfügen. Zeilen wie „200 g
          Mehl" werden als Zutat erkannt, „3 Min./100°C/Stufe 2" als Thermomix-Einstellung.
          Überschriften wie „Zutaten" und „Zubereitung" helfen bei der Zuordnung.
        </p>
        <textarea
          className="textarea"
          style={{ minHeight: 220 }}
          placeholder={'Linsensuppe\n4 Portionen\n\nZutaten\n250 g rote Linsen\n1 Zwiebel\n2 Karotten\n\nZubereitung\nZwiebel 5 Sek./Stufe 5 zerkleinern.\n15 Min./100°C/Stufe 1 garen.'}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <button className="btn btn--primary btn--block" disabled={!text.trim()} onClick={() => onApply(text)}>
          Übernehmen
        </button>
      </div>
    </Sheet>
  )
}
