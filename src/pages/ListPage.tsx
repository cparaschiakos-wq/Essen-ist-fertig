import { useMemo, useState } from 'react'
import { newId, store } from '../data/store'
import { useStoreData } from '../data/useStore'
import { CATEGORIES, CATEGORY_BY_ID, STORE_TYPES, STORE_TYPE_BY_ID } from '../lib/taxonomy'
import { groupItems, type GroupMode } from '../lib/generateList'
import { formatAmount, parseQuickEntry, UNIT_OPTIONS } from '../lib/units'
import { defaultStoreFor, guessCategory } from '../lib/guessCategory'
import type { ShoppingItem } from '../lib/types'
import { Empty, Field, Sheet } from '../components/ui'

const MODES: Array<{ id: GroupMode; label: string }> = [
  { id: 'kategorie', label: '🏪 Supermarkt-Reihenfolge' },
  { id: 'laden', label: '📍 Nach Geschäft' },
  { id: 'rezept', label: '📖 Nach Rezept' },
]

export function ListPage() {
  const data = useStoreData()
  const [mode, setMode] = useState<GroupMode>(() => (localStorage.getItem('list-mode') as GroupMode) ?? 'kategorie')
  const [hideChecked, setHideChecked] = useState(false)
  const [quick, setQuick] = useState('')
  const [editing, setEditing] = useState<ShoppingItem | null>(null)

  const items = useMemo(
    () => (hideChecked ? data.shopping_items.filter((item) => !item.is_checked) : data.shopping_items),
    [data.shopping_items, hideChecked],
  )

  const groups = useMemo(
    () =>
      groupItems(items, mode, data.household?.category_order ?? CATEGORIES.map((c) => c.id), {
        category: (id) => CATEGORY_BY_ID[id],
        store: (id) => STORE_TYPE_BY_ID[id],
      }),
    [items, mode, data.household],
  )

  const openCount = data.shopping_items.filter((item) => !item.is_checked).length
  const checkedCount = data.shopping_items.length - openCount

  async function toggle(item: ShoppingItem) {
    const next = !item.is_checked
    await store.put<ShoppingItem>('shopping_items', {
      ...item,
      is_checked: next,
      checked_at: next ? new Date().toISOString() : null,
    })
  }

  async function addQuick() {
    const text = quick.trim()
    if (!text) return
    const parsed = parseQuickEntry(text)
    const category = guessCategory(parsed.name)

    await store.put<ShoppingItem>('shopping_items', {
      id: newId(),
      name: parsed.name,
      quantity: parsed.quantity,
      unit: parsed.unit,
      category,
      store_type: defaultStoreFor(category),
      is_checked: false,
      checked_at: null,
      source: 'manual',
      recipe_id: null,
      recipe_title: null,
      note: null,
    })
    setQuick('')
  }

  function selectMode(next: GroupMode) {
    setMode(next)
    localStorage.setItem('list-mode', next)
  }

  return (
    <div className="page">
      <div className="row row--between">
        <h1>Einkaufsliste</h1>
        <span className="muted">{openCount} offen</span>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <input
          className="input grow"
          placeholder="z.B. 2 kg Kartoffeln"
          value={quick}
          enterKeyHint="done"
          onChange={(event) => setQuick(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void addQuick()
          }}
        />
        <button className="btn btn--primary btn--icon" onClick={addQuick} aria-label="Hinzufügen">
          +
        </button>
      </div>

      <div className="chips">
        {MODES.map((entry) => (
          <button
            key={entry.id}
            className={`chip ${mode === entry.id ? 'chip--active' : ''}`}
            onClick={() => selectMode(entry.id)}
          >
            {entry.label}
          </button>
        ))}
        {checkedCount > 0 && (
          <button className={`chip ${hideChecked ? 'chip--active' : ''}`} onClick={() => setHideChecked(!hideChecked)}>
            ✓ {checkedCount} erledigt
          </button>
        )}
      </div>

      {data.shopping_items.length === 0 ? (
        <Empty
          icon="🛒"
          title="Die Liste ist leer"
          hint="Oben etwas eintippen, oder im Wochenplan eine Liste aus den Rezepten erzeugen."
        />
      ) : (
        <>
          {groups.map((group) => (
            <div key={group.key} className="group">
              <div className="group__head">
                <span aria-hidden="true">{group.icon}</span>
                <span>{group.label}</span>
                <span className="group__count">{group.items.filter((i) => !i.is_checked).length}</span>
              </div>
              <div className="card">
                {group.items.map((item) => (
                  <div key={item.id} className={`item ${item.is_checked ? 'item--checked' : ''}`}>
                    {/* Zwei getrennte Schaltflächen statt einer verschachtelten:
                        die große zum Abhaken, die kleine zum Bearbeiten. */}
                    <button
                      className="item__toggle"
                      aria-pressed={item.is_checked}
                      onClick={() => void toggle(item)}
                    >
                      <span className="item__box" aria-hidden="true">
                        ✓
                      </span>
                      <span className="grow">
                        <span className="item__name truncate" style={{ display: 'block' }}>
                          {item.name}
                        </span>
                        {(item.recipe_title || item.note) && mode !== 'rezept' && (
                          <span className="item__meta truncate" style={{ display: 'block' }}>
                            {[item.recipe_title, item.note].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </span>
                      {(item.quantity !== null || item.unit) && (
                        <span className="item__amount">{formatAmount(item.quantity, item.unit)}</span>
                      )}
                    </button>
                    <button
                      className="item__more"
                      aria-label={`${item.name} bearbeiten`}
                      onClick={() => setEditing(item)}
                    >
                      ⋯
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {checkedCount > 0 && (
            <button
              className="btn btn--block"
              onClick={async () => {
                const ids = data.shopping_items.filter((item) => item.is_checked).map((item) => item.id)
                if (!confirm(`${ids.length} erledigte Posten von der Liste nehmen?`)) return
                await store.removeMany('shopping_items', ids)
              }}
            >
              {checkedCount} erledigte Posten aufräumen
            </button>
          )}
        </>
      )}

      {editing && <ItemSheet item={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ItemSheet({ item, onClose }: { item: ShoppingItem; onClose: () => void }) {
  const [draft, setDraft] = useState(item)

  return (
    <Sheet title="Posten bearbeiten" onClose={onClose}>
      <div className="stack">
        <Field label="Bezeichnung">
          <input
            className="input"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </Field>

        <div className="row" style={{ gap: 10 }}>
          <Field label="Menge">
            <input
              className="input"
              type="number"
              inputMode="decimal"
              step="any"
              value={draft.quantity ?? ''}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  quantity: event.target.value === '' ? null : Number.parseFloat(event.target.value),
                })
              }
            />
          </Field>
          <Field label="Einheit">
            <select
              className="select"
              value={draft.unit ?? ''}
              onChange={(event) => setDraft({ ...draft, unit: event.target.value || null })}
            >
              <option value="">—</option>
              {UNIT_OPTIONS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Warengruppe">
          <select
            className="select"
            value={draft.category}
            onChange={(event) =>
              setDraft({
                ...draft,
                category: event.target.value as ShoppingItem['category'],
                store_type: defaultStoreFor(event.target.value as ShoppingItem['category']),
              })
            }
          >
            {CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>
                {category.icon} {category.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Geschäft">
          <select
            className="select"
            value={draft.store_type}
            onChange={(event) =>
              setDraft({ ...draft, store_type: event.target.value as ShoppingItem['store_type'] })
            }
          >
            {STORE_TYPES.map((storeType) => (
              <option key={storeType.id} value={storeType.id}>
                {storeType.icon} {storeType.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Notiz">
          <input
            className="input"
            placeholder="z.B. die große Packung"
            value={draft.note ?? ''}
            onChange={(event) => setDraft({ ...draft, note: event.target.value || null })}
          />
        </Field>

        <button
          className="btn btn--primary btn--block"
          onClick={async () => {
            await store.put<ShoppingItem>('shopping_items', draft)
            onClose()
          }}
        >
          Speichern
        </button>

        <button
          className="btn btn--danger btn--block"
          onClick={async () => {
            await store.remove('shopping_items', item.id)
            onClose()
          }}
        >
          Von der Liste nehmen
        </button>
      </div>
    </Sheet>
  )
}
