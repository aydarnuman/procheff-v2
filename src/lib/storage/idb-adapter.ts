/**
 * IndexedDB Storage Adapter for Zustand
 * 
 * PROBLEM: localStorage + IndexedDB + Zustand çakışması
 * SOLUTION: Tek kalıcı katman (IDB) via idb-keyval + Zustand persist
 * 
 * Benefits:
 * - Unified storage layer (no localStorage conflicts)
 * - Quota-friendly (50MB+ storage)
 * - Async by default (no blocking)
 */

import { createStore, get, set, del, clear } from 'idb-keyval';

// Create dedicated store for Procheff
const procheffStore = createStore('procheff-v2', 'state-store');

/**
 * IDB Storage adapter compatible with Zustand persist
 */
export const idbStorage = {
  /**
   * Get item from IndexedDB
   */
  getItem: async (name: string): Promise<string | null> => {
    try {
      const value = await get<string>(name, procheffStore);
      return value ?? null;
    } catch (error) {
      console.error('[IDB Storage] Get error:', error);
      return null;
    }
  },

  /**
   * Set item in IndexedDB
   */
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await set(name, value, procheffStore);
    } catch (error) {
      console.error('[IDB Storage] Set error:', error);
      throw error;
    }
  },

  /**
   * Remove item from IndexedDB
   */
  removeItem: async (name: string): Promise<void> => {
    try {
      await del(name, procheffStore);
    } catch (error) {
      console.error('[IDB Storage] Remove error:', error);
      throw error;
    }
  },

  /**
   * Clear all items (careful!)
   */
  clearAll: async (): Promise<void> => {
    try {
      await clear(procheffStore);
    } catch (error) {
      console.error('[IDB Storage] Clear error:', error);
      throw error;
    }
  },
};

/**
 * Migration helper: Move data from localStorage to IndexedDB
 */
export async function migrateFromLocalStorage(key: string): Promise<void> {
  try {
    const localValue = localStorage.getItem(key);
    if (localValue) {
      await idbStorage.setItem(key, localValue);
      localStorage.removeItem(key);
      console.log(`[IDB Migration] Migrated ${key} from localStorage`);
    }
  } catch (error) {
    console.error('[IDB Migration] Migration failed:', error);
  }
}

/**
 * Check IndexedDB availability
 */
export function isIDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}
