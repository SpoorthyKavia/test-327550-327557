import { Injectable } from '@angular/core';

/**
 * Lightweight localStorage adapter with safe JSON read/write.
 * Keeps localStorage access in one place to avoid scattered try/catch logic.
 */
@Injectable({ providedIn: 'root' })
export class LocalStorageService {
  // PUBLIC_INTERFACE
  /**
   * Read a JSON value from localStorage.
   *
   * Contract:
   * - Inputs: key and a fallback value.
   * - Output: parsed value if present and valid, otherwise fallback.
   * - Errors: never throws; returns fallback on any error (blocked storage, invalid JSON).
   * - Side effects: reads localStorage.
   */
  readJson<T>(key: string, fallback: T): T {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  // PUBLIC_INTERFACE
  /**
   * Write a JSON value to localStorage.
   *
   * Contract:
   * - Inputs: key and value.
   * - Output: void.
   * - Errors: never throws; silently no-ops if storage is unavailable.
   * - Side effects: writes localStorage.
   */
  writeJson<T>(key: string, value: T): void {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // localStorage may be blocked or full; app should remain usable
    }
  }

  // PUBLIC_INTERFACE
  /**
   * Remove a key from localStorage.
   *
   * Contract:
   * - Inputs: key.
   * - Output: void.
   * - Errors: never throws.
   * - Side effects: writes localStorage.
   */
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // no-op
    }
  }
}
