import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './supabase'
import { store } from './store'
import type { Household } from '../lib/types'

export type SessionPhase = 'laden' | 'anmelden' | 'haushalt-waehlen' | 'bereit'

export interface SessionState {
  phase: SessionPhase
  session: Session | null
  household: Household | null
  error: string | null
}

/**
 * Regelt Anmeldung und Haushaltszuordnung.
 *
 * Ohne konfiguriertes Supabase-Projekt wird beides übersprungen: die App läuft
 * dann rein lokal, damit man sie ausprobieren kann, bevor ein Backend steht.
 */
export function useSession() {
  const [state, setState] = useState<SessionState>({
    phase: 'laden',
    session: null,
    household: null,
    error: null,
  })

  const loadHousehold = useCallback(async (session: Session) => {
    if (!supabase) return
    const { data, error } = await supabase.rpc('my_households')
    if (error) {
      setState({ phase: 'haushalt-waehlen', session, household: null, error: error.message })
      return
    }

    const households = (data ?? []) as Household[]
    const stored = localStorage.getItem('household-id')
    const household = households.find((h) => h.id === stored) ?? households[0]

    if (!household) {
      setState({ phase: 'haushalt-waehlen', session, household: null, error: null })
      return
    }

    localStorage.setItem('household-id', household.id)
    await store.init(household.id)
    store.startRealtime()
    setState({ phase: 'bereit', session, household, error: null })
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      void store.init().then(() => {
        setState({ phase: 'bereit', session: null, household: null, error: null })
      })
      return
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void loadHousehold(data.session)
      else setState({ phase: 'anmelden', session: null, household: null, error: null })
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        store.stopRealtime()
        setState({ phase: 'anmelden', session: null, household: null, error: null })
      } else if (event === 'SIGNED_IN') {
        void loadHousehold(session)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [loadHousehold])

  const createHousehold = useCallback(
    async (name: string) => {
      if (!supabase || !state.session) return
      const { data, error } = await supabase.rpc('create_household', { household_name: name })
      if (error) {
        setState((prev) => ({ ...prev, error: error.message }))
        return
      }
      localStorage.setItem('household-id', (data as Household).id)
      await loadHousehold(state.session)
    },
    [state.session, loadHousehold],
  )

  const joinHousehold = useCallback(
    async (code: string) => {
      if (!supabase || !state.session) return
      const { data, error } = await supabase.rpc('join_household', { code })
      if (error) {
        setState((prev) => ({ ...prev, error: error.message }))
        return
      }
      localStorage.setItem('household-id', (data as Household).id)
      await loadHousehold(state.session)
    },
    [state.session, loadHousehold],
  )

  return { ...state, createHousehold, joinHousehold }
}
