import type { RealtimeChannel } from '@supabase/supabase-js'
import { idbGetAll, idbPutMany, metaGet, metaSet, type StoreName } from './idb'
import { isSupabaseConfigured, supabase } from './supabase'
import type { ConnectionState, Household, PantryItem, PlanEntry, Recipe, ShoppingItem, SyncedRecord } from '../lib/types'
import { DEFAULT_CATEGORY_ORDER } from '../lib/taxonomy'

/** Tabellen, die zeilenweise synchronisiert werden. */
export const SYNCED_TABLES = ['recipes', 'plan_entries', 'pantry_items', 'shopping_items'] as const
export type SyncedTable = (typeof SYNCED_TABLES)[number]

export interface StoreData {
  recipes: Recipe[]
  plan_entries: PlanEntry[]
  pantry_items: PantryItem[]
  shopping_items: ShoppingItem[]
  household: Household | null
  connection: ConnectionState
  pendingWrites: number
  lastError: string | null
}

type TableMap = { [K in SyncedTable]: Map<string, SyncedRecord> }

const LOCAL_HOUSEHOLD_ID = '00000000-0000-4000-8000-000000000001'
const DIRTY_KEY = 'dirty'
const CURSOR_KEY = 'sync-cursor'

export function newId(): string {
  return crypto.randomUUID()
}

export function nowIso(): string {
  return new Date().toISOString()
}

/**
 * Lokal-zuerst-Store. Jede Änderung landet sofort in IndexedDB und im UI;
 * der Abgleich mit Supabase passiert im Hintergrund und darf jederzeit
 * fehlschlagen, ohne dass die App stehen bleibt.
 *
 * Konfliktregel: Bei zwei Änderungen derselben Zeile gewinnt der spätere
 * updated_at-Zeitstempel. Für zwei Geräte in einem Haushalt ist das
 * ausreichend - Zeilen sind fein genug geschnitten, dass sich gleichzeitiges
 * Abhaken verschiedener Posten nie in die Quere kommt.
 */
class Store {
  private tables: TableMap = {
    recipes: new Map(),
    plan_entries: new Map(),
    pantry_items: new Map(),
    shopping_items: new Map(),
  }

  private household: Household | null = null
  private dirty = new Set<string>() // "tabelle:id"
  private listeners = new Set<() => void>()
  private snapshot: StoreData = emptySnapshot()
  private channel: RealtimeChannel | null = null
  private connection: ConnectionState = isSupabaseConfigured ? 'sync' : 'lokal'
  private lastError: string | null = null
  private pushTimer: ReturnType<typeof setTimeout> | null = null
  private ready = false

  householdId: string = LOCAL_HOUSEHOLD_ID

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): StoreData => this.snapshot

  isReady(): boolean {
    return this.ready
  }

  /** Lädt den lokalen Cache und startet danach den Abgleich. */
  async init(householdId?: string): Promise<void> {
    if (householdId) this.householdId = householdId

    for (const table of SYNCED_TABLES) {
      const rows = await idbGetAll<SyncedRecord>(table as StoreName)
      const map = this.tables[table]
      map.clear()
      for (const row of rows) map.set(row.id, row)
    }

    const households = await idbGetAll<Household>('households')
    this.household =
      households.find((h) => h.id === this.householdId) ?? households[0] ?? this.defaultHousehold()

    this.dirty = new Set((await metaGet<string[]>(DIRTY_KEY)) ?? [])
    this.ready = true
    this.emit()

    if (supabase) void this.sync()
  }

  private defaultHousehold(): Household {
    return {
      id: this.householdId,
      name: 'Unser Haushalt',
      category_order: DEFAULT_CATEGORY_ORDER,
      updated_at: nowIso(),
    }
  }

  // ---------------------------------------------------------------- Lesen

  list<T extends SyncedRecord>(table: SyncedTable): T[] {
    return [...this.tables[table].values()].filter((row) => !row.deleted_at) as T[]
  }

  get<T extends SyncedRecord>(table: SyncedTable, id: string): T | null {
    const row = this.tables[table].get(id)
    return row && !row.deleted_at ? (row as T) : null
  }

  // -------------------------------------------------------------- Schreiben

  /** Legt an oder aktualisiert. Fehlende Pflichtfelder werden ergänzt. */
  async put<T extends SyncedRecord>(
    table: SyncedTable,
    record: Omit<T, 'household_id' | 'updated_at' | 'deleted_at'> &
      Partial<Pick<T, 'deleted_at'>>,
  ): Promise<T> {
    const row = {
      ...record,
      household_id: this.householdId,
      updated_at: nowIso(),
      deleted_at: record.deleted_at ?? null,
    } as unknown as T

    this.tables[table].set(row.id, row)
    this.markDirty(table, row.id)
    await idbPutMany(table as StoreName, [row])
    this.emit()
    this.schedulePush()
    return row
  }

  async putMany<T extends SyncedRecord>(
    table: SyncedTable,
    records: Array<Omit<T, 'household_id' | 'updated_at' | 'deleted_at'>>,
  ): Promise<void> {
    const stamp = nowIso()
    const rows = records.map(
      (record) =>
        ({
          ...record,
          household_id: this.householdId,
          updated_at: stamp,
          deleted_at: null,
        }) as unknown as T,
    )
    for (const row of rows) {
      this.tables[table].set(row.id, row)
      this.markDirty(table, row.id)
    }
    await idbPutMany(table as StoreName, rows)
    this.emit()
    this.schedulePush()
  }

  /** Soft Delete - sonst käme die Zeile beim nächsten Abgleich zurück. */
  async remove(table: SyncedTable, id: string): Promise<void> {
    const existing = this.tables[table].get(id)
    if (!existing) return
    const row = { ...existing, deleted_at: nowIso(), updated_at: nowIso() }
    this.tables[table].set(id, row)
    this.markDirty(table, id)
    await idbPutMany(table as StoreName, [row])
    this.emit()
    this.schedulePush()
  }

  async removeMany(table: SyncedTable, ids: string[]): Promise<void> {
    const stamp = nowIso()
    const rows: SyncedRecord[] = []
    for (const id of ids) {
      const existing = this.tables[table].get(id)
      if (!existing) continue
      const row = { ...existing, deleted_at: stamp, updated_at: stamp }
      this.tables[table].set(id, row)
      this.markDirty(table, id)
      rows.push(row)
    }
    if (rows.length === 0) return
    await idbPutMany(table as StoreName, rows)
    this.emit()
    this.schedulePush()
  }

  async saveHousehold(patch: Partial<Omit<Household, 'id'>>): Promise<void> {
    const next: Household = {
      ...(this.household ?? this.defaultHousehold()),
      ...patch,
      id: this.householdId,
      updated_at: nowIso(),
    }
    this.household = next
    await idbPutMany('households', [next])
    this.emit()

    if (supabase) {
      const { error } = await supabase
        .from('households')
        .update({ name: next.name, category_order: next.category_order })
        .eq('id', next.id)
      if (error) this.setError(error.message)
    }
  }

  private markDirty(table: SyncedTable, id: string) {
    this.dirty.add(`${table}:${id}`)
    void metaSet(DIRTY_KEY, [...this.dirty])
  }

  // ------------------------------------------------------------ Abgleich

  private schedulePush() {
    if (!supabase) return
    if (this.pushTimer) clearTimeout(this.pushTimer)
    // Kurz sammeln, damit schnelles Abhaken mehrerer Posten eine Anfrage wird.
    this.pushTimer = setTimeout(() => void this.push(), 400)
  }

  async sync(): Promise<void> {
    if (!supabase) return
    if (!navigator.onLine) {
      this.setConnection('offline')
      return
    }
    this.setConnection('sync')
    await this.push()
    await this.pull()
    if (this.connection !== 'fehler') this.setConnection('synchronisiert')
  }

  private async push(): Promise<void> {
    if (!supabase || this.dirty.size === 0) return
    if (!navigator.onLine) {
      this.setConnection('offline')
      return
    }

    const byTable = new Map<SyncedTable, SyncedRecord[]>()
    for (const key of this.dirty) {
      const [table, id] = splitKey(key)
      const row = this.tables[table]?.get(id)
      if (!row) continue
      const bucket = byTable.get(table) ?? []
      bucket.push(row)
      byTable.set(table, bucket)
    }

    for (const [table, rows] of byTable) {
      const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' })
      if (error) {
        this.setError(error.message)
        return
      }
      for (const row of rows) {
        // Nur abhaken, wenn zwischenzeitlich nichts Neueres geschrieben wurde.
        const current = this.tables[table].get(row.id)
        if (current && current.updated_at === row.updated_at) {
          this.dirty.delete(`${table}:${row.id}`)
        }
      }
    }

    await metaSet(DIRTY_KEY, [...this.dirty])
    this.lastError = null
    this.emit()
  }

  private async pull(): Promise<void> {
    if (!supabase) return
    const stored = (await metaGet<string>(CURSOR_KEY)) ?? '1970-01-01T00:00:00.000Z'
    // Die Zeitstempel kommen von den Geräten, deren Uhren minimal auseinander
    // laufen können. Ein Fenster von zwei Minuten holt lieber ein paar Zeilen
    // doppelt, als eine Änderung des anderen Handys zu verpassen.
    const cursor = new Date(Date.parse(stored) - 120_000).toISOString()
    let newest = stored

    for (const table of SYNCED_TABLES) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('household_id', this.householdId)
        .gt('updated_at', cursor)
        .order('updated_at', { ascending: true })

      if (error) {
        this.setError(error.message)
        return
      }
      for (const row of (data ?? []) as SyncedRecord[]) {
        this.mergeRemote(table, row)
        if (row.updated_at > newest) newest = row.updated_at
      }
      await idbPutMany(table as StoreName, (data ?? []) as SyncedRecord[])
    }

    const { data: households } = await supabase
      .from('households')
      .select('*')
      .eq('id', this.householdId)
      .maybeSingle()
    if (households) {
      this.household = households as Household
      await idbPutMany('households', [this.household])
    }

    await metaSet(CURSOR_KEY, newest)
    this.lastError = null
    this.emit()
  }

  /** Späterer Zeitstempel gewinnt. Eigene, noch nicht gepushte Änderungen bleiben. */
  private mergeRemote(table: SyncedTable, remote: SyncedRecord) {
    const local = this.tables[table].get(remote.id)
    if (local && this.dirty.has(`${table}:${remote.id}`) && local.updated_at >= remote.updated_at) {
      return
    }
    if (local && local.updated_at > remote.updated_at) return
    this.tables[table].set(remote.id, remote)
  }

  /** Live-Updates, damit ein Haken auf dem anderen Handy sofort ankommt. */
  startRealtime(): void {
    if (!supabase || this.channel) return

    this.channel = supabase.channel(`haushalt:${this.householdId}`)
    for (const table of SYNCED_TABLES) {
      this.channel = this.channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `household_id=eq.${this.householdId}`,
        },
        (payload) => {
          const row = payload.new as SyncedRecord | null
          if (!row?.id) return
          this.mergeRemote(table, row)
          void idbPutMany(table as StoreName, [row])
          this.emit()
        },
      )
    }
    this.channel.subscribe()
  }

  stopRealtime(): void {
    if (this.channel && supabase) void supabase.removeChannel(this.channel)
    this.channel = null
  }

  private setConnection(state: ConnectionState) {
    if (this.connection === state) return
    this.connection = state
    this.emit()
  }

  private setError(message: string) {
    this.lastError = message
    this.connection = 'fehler'
    this.emit()
  }

  private emit() {
    this.snapshot = {
      recipes: this.list<Recipe>('recipes'),
      plan_entries: this.list<PlanEntry>('plan_entries'),
      pantry_items: this.list<PantryItem>('pantry_items'),
      shopping_items: this.list<ShoppingItem>('shopping_items'),
      household: this.household,
      connection: this.connection,
      pendingWrites: this.dirty.size,
      lastError: this.lastError,
    }
    for (const listener of this.listeners) listener()
  }
}

function splitKey(key: string): [SyncedTable, string] {
  const index = key.indexOf(':')
  return [key.slice(0, index) as SyncedTable, key.slice(index + 1)]
}

function emptySnapshot(): StoreData {
  return {
    recipes: [],
    plan_entries: [],
    pantry_items: [],
    shopping_items: [],
    household: null,
    connection: isSupabaseConfigured ? 'sync' : 'lokal',
    pendingWrites: 0,
    lastError: null,
  }
}

export const store = new Store()

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void store.sync())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void store.sync()
  })
}
