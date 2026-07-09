/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Memory fallback store if localStorage is blocked by iframe browser policy
const memoryStore: Record<string, string> = {};

let canUseLocalStorage = false;
try {
  const testKey = '__storage_test__';
  window.localStorage.setItem(testKey, testKey);
  window.localStorage.removeItem(testKey);
  canUseLocalStorage = true;
} catch (e) {
  console.warn('localStorage is blocked or not accessible (embedded iframe sandbox). Falling back to memory-based state.', e);
}

export const safeStorage = {
  getItem(key: string): string | null {
    if (canUseLocalStorage) {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {
        console.error('Failed to getItem from localStorage:', e);
      }
    }
    return memoryStore[key] !== undefined ? memoryStore[key] : null;
  },

  setItem(key: string, value: string): void {
    if (canUseLocalStorage) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch (e) {
        console.error('Failed to setItem in localStorage:', e);
      }
    }
    memoryStore[key] = value;
  },

  removeItem(key: string): void {
    if (canUseLocalStorage) {
      try {
        window.localStorage.removeItem(key);
        return;
      } catch (e) {
        console.error('Failed to removeItem from localStorage:', e);
      }
    }
    delete memoryStore[key];
  },

  clear(): void {
    if (canUseLocalStorage) {
      try {
        window.localStorage.clear();
        return;
      } catch (e) {
        console.error('Failed to clear localStorage:', e);
      }
    }
    for (const key in memoryStore) {
      delete memoryStore[key];
    }
  }
};
