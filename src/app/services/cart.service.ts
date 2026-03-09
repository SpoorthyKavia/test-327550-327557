import { Injectable, computed, signal } from '@angular/core';
import { LocalStorageService } from './local-storage.service';

export interface CartLine {
  key: string;
  restaurantId: string;
  restaurantName: string;
  menuItemId: string;
  name: string;
  price: number; // dollars
  quantity: number;
}

interface PersistedCartV1 {
  version: 1;
  deliveryFee: number;
  items: CartLine[];
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly storageKey = 'fd.cart.v1';

  private readonly _items = signal<CartLine[]>([]);
  private readonly _deliveryFee = signal<number>(2.49);

  constructor(private readonly storage: LocalStorageService) {
    this.restoreFromStorage();
  }

  /**
   * Flow name: CartPersistenceFlow
   *
   * Centralizes all persistence behavior (restore + save + clear) so components
   * don't need to manage localStorage directly.
   */
  private restoreFromStorage(): void {
    const persisted = this.storage.readJson<PersistedCartV1 | null>(this.storageKey, null);
    if (!persisted || persisted.version !== 1) return;

    // Minimal shape validation to avoid template/runtime errors.
    const items = Array.isArray(persisted.items) ? persisted.items : [];
    const deliveryFee = typeof persisted.deliveryFee === 'number' ? persisted.deliveryFee : 2.49;

    this._items.set(items);
    this._deliveryFee.set(deliveryFee);
  }

  private persistToStorage(): void {
    const payload: PersistedCartV1 = {
      version: 1,
      deliveryFee: this._deliveryFee(),
      items: this._items(),
    };
    this.storage.writeJson(this.storageKey, payload);
  }

  // PUBLIC_INTERFACE
  /**
   * Current cart lines.
   */
  items(): CartLine[] {
    return this._items();
  }

  // PUBLIC_INTERFACE
  /**
   * Delivery fee (dollars). Updated when the first item of a restaurant is added.
   */
  deliveryFee(): number {
    return this._deliveryFee();
  }

  // PUBLIC_INTERFACE
  /**
   * Adds an item to cart. If cart contains items from a different restaurant, it resets cart first.
   */
  add(params: {
    restaurantId: string;
    restaurantName: string;
    deliveryFee: number;
    menuItemId: string;
    name: string;
    price: number;
  }): { resetOccurred: boolean } {
    const current = this._items();
    const hasDifferentRestaurant =
      current.length > 0 && current.some((l) => l.restaurantId !== params.restaurantId);

    if (hasDifferentRestaurant) {
      this._items.set([]);
    }

    // Update delivery fee based on restaurant
    this._deliveryFee.set(params.deliveryFee);

    const key = `${params.restaurantId}:${params.menuItemId}`;
    const existing = this._items().find((l) => l.key === key);

    if (existing) {
      this.increment(key);
    } else {
      this._items.set([
        ...this._items(),
        {
          key,
          restaurantId: params.restaurantId,
          restaurantName: params.restaurantName,
          menuItemId: params.menuItemId,
          name: params.name,
          price: params.price,
          quantity: 1,
        },
      ]);
      this.persistToStorage();
    }

    // increment() persists when called; but if we reset cart due to different restaurant
    // and then incremented existing (not possible after reset) OR added new line above,
    // we already persisted. Ensure reset-only scenario is persisted too.
    if (hasDifferentRestaurant && !existing) {
      // already persisted in add-new-line branch above
    } else if (hasDifferentRestaurant && existing) {
      // defensive: should never happen after reset, but keep state consistent
      this.persistToStorage();
    }

    return { resetOccurred: hasDifferentRestaurant };
  }

  // PUBLIC_INTERFACE
  /**
   * Increase quantity for a cart line.
   */
  increment(key: string): void {
    this._items.set(
      this._items().map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l)),
    );
    this.persistToStorage();
  }

  // PUBLIC_INTERFACE
  /**
   * Decrease quantity for a cart line (removes when hits zero).
   */
  decrement(key: string): void {
    const updated = this._items()
      .map((l) => (l.key === key ? { ...l, quantity: l.quantity - 1 } : l))
      .filter((l) => l.quantity > 0);
    this._items.set(updated);
    this.persistToStorage();
  }

  // PUBLIC_INTERFACE
  /**
   * Remove a cart line entirely.
   */
  remove(key: string): void {
    this._items.set(this._items().filter((l) => l.key !== key));
    this.persistToStorage();
  }

  // PUBLIC_INTERFACE
  /**
   * Clears the cart.
   */
  clear(): void {
    this._items.set([]);
    // Clearing cart should also clear persisted cart to avoid stale re-hydration.
    this.storage.remove(this.storageKey);
  }

  // PUBLIC_INTERFACE
  /**
   * Cart subtotal in dollars.
   */
  subtotal = computed(() => this._items().reduce((sum, l) => sum + l.price * l.quantity, 0));

  // PUBLIC_INTERFACE
  /**
   * Cart total items count.
   */
  totalItems = computed(() => this._items().reduce((sum, l) => sum + l.quantity, 0));

  // PUBLIC_INTERFACE
  /**
   * Cart total in dollars (subtotal + delivery fee if cart not empty).
   */
  total = computed(() => (this._items().length > 0 ? this.subtotal() + this.deliveryFee() : 0));

  // PUBLIC_INTERFACE
  /**
   * trackBy function for ngFor rendering.
   */
  trackByKey(_index: number, item: CartLine): string {
    return item.key;
  }
}
