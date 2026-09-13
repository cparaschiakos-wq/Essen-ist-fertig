import { useState, type FormEvent } from 'react'
import { supabase } from '../data/supabase'
import { Field } from '../components/ui'

export function AuthPage() {
  const [mode, setMode] = useState<'anmelden' | 'registrieren'>('anmelden')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMessage(null)

    const { error } =
      mode === 'anmelden'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })

    setBusy(false)
    if (error) setMessage(error.message)
    else if (mode === 'registrieren') {
      setMessage(
        'Konto angelegt. Falls die Bestätigung per E-Mail aktiv ist, bitte zuerst den Link in der Mail anklicken.',
      )
    }
  }

  return (
    <div className="page" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 48px)' }}>
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: '2.6rem' }} aria-hidden="true">
          🍲
        </div>
        <h1>Essen ist fertig</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          Wochenplan, Rezepte und Einkaufsliste für die Familie
        </p>
      </div>

      <form className="card card--pad stack" onSubmit={onSubmit}>
        <Field label="E-Mail">
          <input
            className="input"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Passwort">
          <input
            className="input"
            type="password"
            autoComplete={mode === 'anmelden' ? 'current-password' : 'new-password'}
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
          {busy ? 'Einen Moment…' : mode === 'anmelden' ? 'Anmelden' : 'Konto anlegen'}
        </button>

        <button
          type="button"
          className="btn btn--ghost btn--block btn--sm"
          onClick={() => {
            setMode(mode === 'anmelden' ? 'registrieren' : 'anmelden')
            setMessage(null)
          }}
        >
          {mode === 'anmelden' ? 'Noch kein Konto? Registrieren' : 'Schon ein Konto? Anmelden'}
        </button>

        {message && <p className="banner">{message}</p>}
      </form>
    </div>
  )
}

export function HouseholdPage({
  onCreate,
  onJoin,
  error,
}: {
  onCreate: (name: string) => void
  onJoin: (code: string) => void
  error: string | null
}) {
  const [name, setName] = useState('Unser Haushalt')
  const [code, setCode] = useState('')

  return (
    <div className="page" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 40px)' }}>
      <h1>Haushalt einrichten</h1>
      <p className="muted">
        Ein Haushalt ist der gemeinsame Bereich: Rezepte, Wochenplan und Einkaufsliste gehören allen
        Mitgliedern. Einer legt ihn an, die anderen treten mit dem Code bei.
      </p>

      <div className="card card--pad stack">
        <Field label="Name des Haushalts">
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <button className="btn btn--primary btn--block" onClick={() => onCreate(name.trim() || 'Unser Haushalt')}>
          Neuen Haushalt anlegen
        </button>
      </div>

      <div className="row" style={{ gap: 12 }}>
        <div className="divider grow" />
        <span className="tiny">oder</span>
        <div className="divider grow" />
      </div>

      <div className="card card--pad stack">
        <Field label="Einladungscode">
          <input
            className="input"
            value={code}
            autoCapitalize="characters"
            placeholder="z.B. A1B2C3D4"
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
        </Field>
        <button className="btn btn--block" disabled={code.trim().length < 4} onClick={() => onJoin(code.trim())}>
          Bestehendem Haushalt beitreten
        </button>
      </div>

      {error && <p className="banner">{error}</p>}
    </div>
  )
}
