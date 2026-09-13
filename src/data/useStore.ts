import { useSyncExternalStore } from 'react'
import { store, type StoreData } from './store'

export function useStoreData(): StoreData {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

export { store }
