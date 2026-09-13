import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useSession } from './data/useSession'
import { useStoreData } from './data/useStore'
import { AuthPage, HouseholdPage } from './pages/AuthPage'
import { PlanPage } from './pages/PlanPage'
import { RecipesPage } from './pages/RecipesPage'
import { RecipeEditorPage } from './pages/RecipeEditorPage'
import { ListPage } from './pages/ListPage'
import { GeneratePage } from './pages/GeneratePage'
import { SettingsPage } from './pages/SettingsPage'
import { ConnectionBadge } from './components/ui'

export function App() {
  const session = useSession()

  if (session.phase === 'laden') {
    return (
      <div className="empty" style={{ paddingTop: 120 }}>
        <span className="empty__icon" aria-hidden="true">
          🍲
        </span>
        <p className="muted">Einen Moment…</p>
      </div>
    )
  }

  if (session.phase === 'anmelden') return <AuthPage />

  if (session.phase === 'haushalt-waehlen') {
    return (
      <HouseholdPage
        onCreate={session.createHousehold}
        onJoin={session.joinHousehold}
        error={session.error}
      />
    )
  }

  return (
    <div className="app">
      <TopBar />
      <Routes>
        <Route path="/" element={<Navigate to="/plan" replace />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/rezepte" element={<RecipesPage />} />
        <Route path="/rezepte/:id" element={<RecipeEditorPage />} />
        <Route path="/liste" element={<ListPage />} />
        <Route path="/liste/erzeugen" element={<GeneratePage />} />
        <Route path="/einstellungen" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/plan" replace />} />
      </Routes>
      <BottomNav />
    </div>
  )
}

function TopBar() {
  const data = useStoreData()
  return (
    <header className="topbar">
      <span aria-hidden="true" style={{ fontSize: '1.4rem' }}>
        🍲
      </span>
      <div className="topbar__titles">
        <strong>{data.household?.name ?? 'Essen ist fertig'}</strong>
        <div className="topbar__sub">
          <ConnectionBadge state={data.connection} pending={data.pendingWrites} />
        </div>
      </div>
    </header>
  )
}

function BottomNav() {
  const data = useStoreData()
  const open = data.shopping_items.filter((item) => !item.is_checked).length

  const links = [
    { to: '/plan', icon: '🗓️', label: 'Woche' },
    { to: '/rezepte', icon: '📖', label: 'Rezepte' },
    { to: '/liste', icon: '🛒', label: 'Liste', badge: open },
    { to: '/einstellungen', icon: '⚙️', label: 'Mehr' },
  ]

  return (
    <nav className="nav">
      {links.map((link) => (
        <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav__icon" aria-hidden="true">
            {link.icon}
            {link.badge ? <span className="nav__badge">{link.badge > 99 ? '99+' : link.badge}</span> : null}
          </span>
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}
