import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { newId, store } from '../data/store'
import { useStoreData } from '../data/useStore'
import { MEAL_SLOTS, PRIMARY_SLOTS } from '../lib/taxonomy'
import type { MealSlot, PlanEntry, Recipe } from '../lib/types'
import {
  addDays,
  formatWeekRange,
  isToday,
  isoWeekNumber,
  startOfWeek,
  weekDates,
  weekdayShort,
  fromIsoDate,
} from '../lib/dates'
import { Empty, Field, Sheet } from '../components/ui'

export function PlanPage() {
  const data = useStoreData()
  const navigate = useNavigate()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [showAllSlots, setShowAllSlots] = useState(false)
  const [editing, setEditing] = useState<{ date: string; slot: MealSlot } | null>(null)

  const dates = useMemo(() => weekDates(weekStart), [weekStart])

  /** Nachschlagetabelle "datum|slot" -> Eintrag, damit das Raster O(1) rendert. */
  const entriesBySlot = useMemo(() => {
    const map = new Map<string, PlanEntry>()
    for (const entry of data.plan_entries) map.set(`${entry.date}|${entry.slot}`, entry)
    return map
  }, [data.plan_entries])

  const recipesById = useMemo(
    () => new Map(data.recipes.map((recipe) => [recipe.id, recipe])),
    [data.recipes],
  )

  const visibleSlots = showAllSlots ? MEAL_SLOTS.map((s) => s.id) : PRIMARY_SLOTS
  const plannedCount = dates.reduce(
    (total, date) =>
      total + visibleSlots.filter((slot) => entriesBySlot.has(`${date}|${slot}`)).length,
    0,
  )

  return (
    <div className="page">
      <div className="row row--between">
        <div className="row" style={{ gap: 4 }}>
          <button
            className="btn btn--ghost btn--icon"
            aria-label="Vorherige Woche"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
          >
            ‹
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            Heute
          </button>
          <button
            className="btn btn--ghost btn--icon"
            aria-label="Nächste Woche"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
            ›
          </button>
        </div>
        <button className="chip" onClick={() => setShowAllSlots(!showAllSlots)}>
          {showAllSlots ? 'Nur Mittag & Abend' : 'Alle Mahlzeiten'}
        </button>
      </div>

      <div>
        <h1>KW {isoWeekNumber(weekStart)}</h1>
        <p className="muted">{formatWeekRange(weekStart)}</p>
      </div>

      <div className="card">
        {dates.map((date) => (
          <div key={date} className={`day ${isToday(date) ? 'day--today' : ''}`}>
            <div className="day__date">
              <div className="day__weekday">{weekdayShort(date)}</div>
              <div className="day__number">{fromIsoDate(date).getDate()}</div>
            </div>
            <div className="day__slots">
              {visibleSlots.map((slot) => {
                const entry = entriesBySlot.get(`${date}|${slot}`)
                const recipe = entry?.recipe_id ? recipesById.get(entry.recipe_id) : undefined
                const title = recipe?.title ?? entry?.custom_title
                const slotDef = MEAL_SLOTS.find((s) => s.id === slot)!

                return (
                  <button
                    key={slot}
                    className={`slot ${entry ? 'slot--filled' : ''}`}
                    onClick={() => setEditing({ date, slot })}
                  >
                    <span className="slot__label" aria-hidden="true">
                      {slotDef.icon}
                    </span>
                    <span className="grow truncate">{title ?? slotDef.label}</span>
                    {entry && (
                      <span className="tiny" style={{ flex: 'none' }}>
                        {entry.servings} P.
                      </span>
                    )}
                    {recipe?.is_thermomix && (
                      <span className="badge badge--tm" style={{ flex: 'none' }}>
                        TM
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {plannedCount === 0 ? (
        <Empty
          icon="🗓️"
          title="Diese Woche ist noch nichts geplant"
          hint="Tippe auf eine Mahlzeit, um ein Rezept einzuplanen."
        />
      ) : (
        <button
          className="btn btn--primary btn--block"
          onClick={() =>
            navigate(`/liste/erzeugen?von=${dates[0]}&bis=${dates[6]}`)
          }
        >
          🛒 Einkaufsliste aus dieser Woche
        </button>
      )}

      {editing && (
        <SlotSheet
          date={editing.date}
          slot={editing.slot}
          entry={entriesBySlot.get(`${editing.date}|${editing.slot}`) ?? null}
          recipes={data.recipes}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function SlotSheet({
  date,
  slot,
  entry,
  recipes,
  onClose,
}: {
  date: string
  slot: MealSlot
  entry: PlanEntry | null
  recipes: Recipe[]
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [servings, setServings] = useState(entry?.servings ?? 4)
  const slotDef = MEAL_SLOTS.find((s) => s.id === slot)!

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const pool = needle
      ? recipes.filter(
          (recipe) =>
            recipe.title.toLowerCase().includes(needle) ||
            recipe.tags.some((tag) => tag.toLowerCase().includes(needle)),
        )
      : recipes
    return [...pool].sort((a, b) => a.title.localeCompare(b.title, 'de')).slice(0, 40)
  }, [recipes, search])

  async function assign(recipe: Recipe | null, customTitle: string | null) {
    await store.put<PlanEntry>('plan_entries', {
      id: entry?.id ?? newId(),
      date,
      slot,
      recipe_id: recipe?.id ?? null,
      custom_title: customTitle,
      // Voreinstellung ist die Portionszahl des Rezepts, nicht stur 4.
      servings: entry ? servings : (recipe?.servings ?? servings),
      note: entry?.note ?? null,
    })
    onClose()
  }

  return (
    <Sheet title={`${slotDef.label} am ${weekdayShort(date)}.`} onClose={onClose}>
      <div className="stack">
        {entry && (
          <div className="card card--pad stack">
            <Field label="Portionen">
              <div className="row">
                <button
                  className="btn btn--icon"
                  onClick={() => setServings(Math.max(1, servings - 1))}
                  aria-label="Weniger Portionen"
                >
                  −
                </button>
                <span className="grow" style={{ textAlign: 'center', fontWeight: 650 }}>
                  {servings}
                </span>
                <button
                  className="btn btn--icon"
                  onClick={() => setServings(servings + 1)}
                  aria-label="Mehr Portionen"
                >
                  +
                </button>
              </div>
            </Field>
            <div className="row">
              <button
                className="btn grow"
                onClick={async () => {
                  await store.put<PlanEntry>('plan_entries', { ...entry, servings })
                  onClose()
                }}
              >
                Portionen speichern
              </button>
              <button
                className="btn btn--danger"
                onClick={async () => {
                  await store.remove('plan_entries', entry.id)
                  onClose()
                }}
              >
                Entfernen
              </button>
            </div>
          </div>
        )}

        <input
          className="input"
          placeholder="Rezept suchen…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {matches.length > 0 ? (
          <div className="card">
            {matches.map((recipe) => (
              <button key={recipe.id} className="recipe" onClick={() => void assign(recipe, null)}>
                <span className="grow">
                  <span className="truncate" style={{ fontWeight: 600, display: 'block' }}>
                    {recipe.title}
                  </span>
                  <span className="tiny">
                    {recipe.servings} Portionen · {recipe.ingredients.length} Zutaten
                  </span>
                </span>
                {recipe.is_thermomix && <span className="badge badge--tm">TM</span>}
              </button>
            ))}
          </div>
        ) : (
          <Empty
            icon="📖"
            title={search ? 'Kein Rezept gefunden' : 'Noch keine Rezepte'}
            hint="Lege zuerst ein Rezept an, dann kannst du es hier einplanen."
          />
        )}

        <div className="row">
          <button
            className="btn grow"
            disabled={!search.trim()}
            onClick={() => void assign(null, search.trim())}
          >
            „{search.trim() || '…'}" als Freitext
          </button>
          <button className="btn" onClick={() => navigate('/rezepte/neu')}>
            Neues Rezept
          </button>
        </div>
      </div>
    </Sheet>
  )
}
