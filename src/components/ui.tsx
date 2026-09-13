import { useEffect, type ReactNode } from 'react'
import type { ConnectionState } from '../lib/types'

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  // Hintergrund nicht mitscrollen lassen, solange das Sheet offen ist.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="sheet-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="sheet">
        <div className="sheet__grip" />
        <div className="row row--between" style={{ marginBottom: 14 }}>
          <h2>{title}</h2>
          <button className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Schließen">
            Fertig
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Empty({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="empty">
      <span className="empty__icon" aria-hidden="true">
        {icon}
      </span>
      <p style={{ fontWeight: 600, color: 'var(--text)' }}>{title}</p>
      {hint && <p className="muted" style={{ marginTop: 6 }}>{hint}</p>}
    </div>
  )
}

const CONNECTION_LABEL: Record<ConnectionState, { text: string; variant: string }> = {
  lokal: { text: 'Nur auf diesem Gerät', variant: 'warn' },
  offline: { text: 'Offline', variant: 'warn' },
  sync: { text: 'Synchronisiere…', variant: '' },
  synchronisiert: { text: 'Synchron', variant: 'ok' },
  fehler: { text: 'Sync-Fehler', variant: 'error' },
}

export function ConnectionBadge({
  state,
  pending,
}: {
  state: ConnectionState
  pending: number
}) {
  const def = CONNECTION_LABEL[state]
  // Im Lokalmodus gibt es nichts zu synchronisieren - die Zahl wäre irreführend.
  const showPending = pending > 0 && (state === 'offline' || state === 'fehler' || state === 'sync')
  const label = showPending ? `${def.text} · ${pending} offen` : def.text
  return (
    <span className={`status ${def.variant ? `status--${def.variant}` : ''}`}>
      <span className="status__dot" />
      {label}
    </span>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}
