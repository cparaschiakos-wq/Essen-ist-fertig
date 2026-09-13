import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStoreData } from '../data/useStore'
import { Empty } from '../components/ui'

type Filter = 'alle' | 'thermomix' | 'eigen' | 'cookidoo'

export function RecipesPage() {
  const data = useStoreData()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('alle')

  const recipes = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return data.recipes
      .filter((recipe) => {
        if (filter === 'thermomix' && !recipe.is_thermomix) return false
        if (filter === 'eigen' && recipe.source !== 'eigen') return false
        if (filter === 'cookidoo' && recipe.source !== 'cookidoo') return false
        if (!needle) return true
        return (
          recipe.title.toLowerCase().includes(needle) ||
          recipe.tags.some((tag) => tag.toLowerCase().includes(needle)) ||
          recipe.ingredients.some((ingredient) => ingredient.name.toLowerCase().includes(needle))
        )
      })
      .sort((a, b) => a.title.localeCompare(b.title, 'de'))
  }, [data.recipes, search, filter])

  const filters: Array<{ id: Filter; label: string }> = [
    { id: 'alle', label: `Alle (${data.recipes.length})` },
    { id: 'thermomix', label: 'Thermomix' },
    { id: 'eigen', label: 'Eigene' },
    { id: 'cookidoo', label: 'Cookidoo' },
  ]

  return (
    <div className="page">
      <div className="row row--between">
        <h1>Rezepte</h1>
        <button className="btn btn--primary btn--sm" onClick={() => navigate('/rezepte/neu')}>
          + Neu
        </button>
      </div>

      <input
        className="input"
        placeholder="Nach Titel, Zutat oder Schlagwort suchen…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <div className="chips">
        {filters.map((entry) => (
          <button
            key={entry.id}
            className={`chip ${filter === entry.id ? 'chip--active' : ''}`}
            onClick={() => setFilter(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {recipes.length === 0 ? (
        <Empty
          icon="📖"
          title={data.recipes.length === 0 ? 'Noch keine Rezepte' : 'Nichts gefunden'}
          hint={
            data.recipes.length === 0
              ? 'Lege euer erstes Rezept an oder füge einen Rezepttext ein.'
              : 'Andere Suche oder anderen Filter probieren.'
          }
        />
      ) : (
        <div className="card">
          {recipes.map((recipe) => (
            <Link key={recipe.id} className="recipe" to={`/rezepte/${recipe.id}`}>
              <span className="grow">
                <span className="truncate" style={{ fontWeight: 600, display: 'block' }}>
                  {recipe.title}
                </span>
                <span className="tiny">
                  {recipe.servings} Portionen · {recipe.ingredients.length} Zutaten
                  {recipe.total_minutes ? ` · ${recipe.total_minutes} Min.` : ''}
                </span>
              </span>
              {recipe.is_thermomix && <span className="badge badge--tm">TM</span>}
              <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>
                ›
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
