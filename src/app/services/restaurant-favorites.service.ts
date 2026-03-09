import { Injectable, computed, signal } from '@angular/core';
import { LocalStorageService } from './local-storage.service';

/**
 * Persisted favorites for restaurants.
 *
 * Reusable flow: a single canonical place to read/write favorite restaurant ids in localStorage.
 * UI code should never access localStorage directly; it should call this service.
 */
@Injectable({ providedIn: 'root' })
export class RestaurantFavoritesService {
  private static readonly STORAGE_KEY = 'restaurant_favorites_v1';

  /**
   * Invariant:
   * - favorites() always returns a de-duplicated array of restaurant ids.
   * - favoritesSet() is derived from favorites().
   */
  private readonly favorites = signal<string[]>(
    this.normalizeIds(this.storage.readJson<string[]>(RestaurantFavoritesService.STORAGE_KEY, [])),
  );

  protected readonly favoritesSet = computed(() => new Set(this.favorites()));

  constructor(private readonly storage: LocalStorageService) {}

  // PUBLIC_INTERFACE
  /**
   * Returns whether a restaurant is currently favorited.
   *
   * Contract:
   * - Inputs: restaurantId (string).
   * - Output: boolean.
   * - Errors: never throws; empty/unknown ids return false.
   * - Side effects: none.
   */
  isFavorite(restaurantId: string | null | undefined): boolean {
    if (!restaurantId) return false;
    return this.favoritesSet().has(restaurantId);
  }

  // PUBLIC_INTERFACE
  /**
   * Returns the current favorites list.
   *
   * Contract:
   * - Inputs: none.
   * - Output: string[] (restaurant ids), de-duplicated.
   * - Errors: never throws.
   * - Side effects: none.
   */
  getFavorites(): string[] {
    return this.favorites();
  }

  // PUBLIC_INTERFACE
  /**
   * Toggle favorite state for a restaurant id.
   *
   * Contract:
   * - Inputs: restaurantId (string).
   * - Output: new state (true if now favorited; false if removed).
   * - Errors: never throws.
   * - Side effects: writes localStorage.
   */
  toggle(restaurantId: string): boolean {
    const id = restaurantId?.trim();
    if (!id) return false;

    const set = new Set(this.favorites());
    let nowFavorite = false;

    if (set.has(id)) {
      set.delete(id);
      nowFavorite = false;
    } else {
      set.add(id);
      nowFavorite = true;
    }

    this.setFavorites(Array.from(set));
    return nowFavorite;
  }

  // PUBLIC_INTERFACE
  /**
   * Explicitly set favorite state for a restaurant id.
   *
   * Contract:
   * - Inputs: restaurantId (string), favorite (boolean).
   * - Output: void.
   * - Errors: never throws.
   * - Side effects: writes localStorage when a change occurs.
   */
  setFavorite(restaurantId: string, favorite: boolean): void {
    const id = restaurantId?.trim();
    if (!id) return;

    const set = new Set(this.favorites());
    const had = set.has(id);

    if (favorite) set.add(id);
    else set.delete(id);

    // Avoid unnecessary writes/signals if nothing changed.
    if (had === set.has(id)) return;

    this.setFavorites(Array.from(set));
  }

  private setFavorites(ids: string[]): void {
    const normalized = this.normalizeIds(ids);
    this.favorites.set(normalized);
    this.storage.writeJson(RestaurantFavoritesService.STORAGE_KEY, normalized);
  }

  private normalizeIds(ids: string[]): string[] {
    // Normalize: trim, remove empty, de-dup, stable sort for determinism/debuggability.
    const out = Array.from(
      new Set(
        (ids ?? [])
          .map((x) => (typeof x === 'string' ? x.trim() : ''))
          .filter((x) => x.length > 0),
      ),
    );
    out.sort((a, b) => a.localeCompare(b));
    return out;
  }
}
