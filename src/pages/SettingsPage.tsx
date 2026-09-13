import { useEffect, useState } from 'react'
import { newId, store } from '../data/store'
import { useStoreData } from '../data/useStore'
import { isSupabaseConfigured, supabase } from '../data/supabase'
import { CATEGORIES, CATEGORY_BY_ID, DEFAULT_CATEGORY_ORDER } from '../lib/taxonomy'
import { guessCategory } from '../lib/guessCategory'
import type { CategoryId, PantryItem } from '../lib/types'
import { ConnectionBadge, Empty, Field } from '../components/ui'

export function SettingsPage() {
  const data = useStoreData()
  const [pantryInput, setPantryInput] = useState('')
  const [inviteCode, setInviteCode] = useState<string | null>(null)

  const order: CategoryId[] = data.household?.category_order?.length
    ? data.household.category_order
    : DEFAULT_CATEGORY_ORDER

  useEffect(() => {
    if (!supabase || !data.household) return
    void supabase
      .from('households')
      .select('invite_code')
      .eq('id', data.household.id)
      .maybeSingle()
      .then(({ data: row }) => setInviteCode((row as { invite_code: string } | null)?.invite_code ?? null))
  }, [data.household])

  async function move(index: number, delta: number) {
    const next = [...order]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved!)
    await store.saveHousehold({ category_order: next })
  }

  async function addPantry() {
    const name = pantryInput.trim()
    if (!name) return
    await store.put<PantryItem>('pantry_items', {
      id: newId(),
      name,
      category: guessCategory(name),
    })
    setPantryInput('')
  }

  return (
    <div className="page">
      <h1>Einstellungen</h1>

      <div className="card card--pad stack">
        <div className="row row--between">
          <h2>Haushalt</h2>
          <ConnectionBadge state={data.connection} pending={data.pendingWrites} />
        </div>

        <Field label="Name">
          <input
            className="input"
            value={data.household?.name ?? ''}
            onChange={(event) => void store.saveHousehold({ name: event.target.value })}
          />
        </Field>

        {!isSupabaseConfigured && (
          <p className="banner">
            Kein Supabase-Projekt hinterlegt. Die App läuft nur auf diesem Gerät – nichts wird
            synchronisiert. Zum Verbinden die Werte aus <code>.env.example</code> setzen.
          </p>
        )}

        {inviteCode && (
          <Field label="Einladungscode">
            <div className="row">
              <input className="input grow" readOnly value={inviteCode} />
              <button
                className="btn"
                onClick={() => void navigator.clipboard?.writeText(inviteCode)}
              >
                Kopieren
              </button>
            </div>
          </Field>
        )}

        {data.lastError && <p className="banner">Letzter Fehler: {data.lastError}</p>}

        {supabase && (
          <button className="btn btn--block" onClick={() => void supabase?.auth.signOut()}>
            Abmelden
          </button>
        )}
      </div>

      <div className="card card--pad stack">
        <h2>Reihenfolge im Supermarkt</h2>
        <p className="muted">
          So läuft die Einkaufsliste durch den Laden, wenn nach Supermarkt-Reihenfolge sortiert wird.
          Passe die Reihenfolge an euren Stammladen an.
        </p>
        <div className="stack" style={{ gap: 6 }}>
          {order.map((categoryId, index) => {
            const category = CATEGORY_BY_ID[categoryId] ?? CATEGORIES[CATEGORIES.length - 1]!
            return (
              <div key={categoryId} className="row" style={{ gap: 8 }}>
                <span className="grow">
                  {category.icon} {category.label}
                </span>
                <button
                  className="btn btn--sm btn--icon"
                  aria-label={`${category.label} nach oben`}
                  disabled={index === 0}
                  onClick={() => void move(index, -1)}
                >
                  ↑
                </button>
                <button
                  className="btn btn--sm btn--icon"
                  aria-label={`${category.label} nach unten`}
                  disabled={index === order.length - 1}
                  onClick={() => void move(index, 1)}
                >
                  ↓
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card card--pad stack">
        <h2>Vorrat</h2>
        <p className="muted">
          Was hier steht, wird beim Erzeugen der Einkaufsliste vorab abgewählt – praktisch für Mehl,
          Salz und Öl, die immer da sind.
        </p>

        <div className="row" style={{ gap: 8 }}>
          <input
            className="input grow"
            placeholder="z.B. Olivenöl"
            value={pantryInput}
            onChange={(event) => setPantryInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void addPantry()
            }}
          />
          <button className="btn btn--primary btn--icon" onClick={addPantry} aria-label="Hinzufügen">
            +
          </button>
        </div>

        {data.pantry_items.length === 0 ? (
          <Empty icon="🥫" title="Vorrat ist leer" />
        ) : (
          <div className="row row--wrap" style={{ gap: 7 }}>
            {[...data.pantry_items]
              .sort((a, b) => a.name.localeCompare(b.name, 'de'))
              .map((item) => (
                <button
                  key={item.id}
                  className="chip"
                  onClick={() => void store.remove('pantry_items', item.id)}
                  title="Entfernen"
                >
                  {CATEGORY_BY_ID[item.category]?.icon ?? '🛒'} {item.name} ✕
                </button>
              ))}
          </div>
        )}
      </div>

      <p className="tiny" style={{ textAlign: 'center' }}>
        Essen ist fertig · {data.recipes.length} Rezepte · {data.shopping_items.length} Posten auf der
        Liste
      </p>
    </div>
  )
}
