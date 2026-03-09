import { Injectable, computed, signal } from '@angular/core';
import { LocalStorageService } from './local-storage.service';
import { PromoCodeService, PromoDiscountBreakdown } from './promo-code.service';
import { FoodDataService } from './food-data.service';
import { OrderSnapshot } from '../models/order.models';

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
  promoCode?: string | null;
}

/**
 * Result object for rebuilding the cart from a past order.
 */
export interface RestoreCartFromOrderResult {
  ok: boolean;
  /** Router link to continue ordering (restaurant page) when ok=true. */
  continueUrl?: string;
  /** Human-friendly notice for the UI (e.g., promo not re-applied). */
  notice?: string;
  /** Error message when ok=false. */
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly storageKey = 'fd.cart.v1';

  private readonly _items = signal<CartLine[]>([]);
  private readonly _deliveryFee = signal<number>(2.49);

  // Promo code state lives with the cart so it can affect totals and persist locally.
  private readonly _promoCode = signal<string | null>(null);
  private readonly _promoError = signal<string | null>(null);

  constructor(
    private readonly storage: LocalStorageService,
    private readonly promos: PromoCodeService,
    private readonly foodData: FoodDataService,
  ) {
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

    const promoCode =
      typeof persisted.promoCode === 'string'
        ? persisted.promoCode.trim().toUpperCase()
        : persisted.promoCode === null
          ? null
          : null;

    this._items.set(items);
    this._deliveryFee.set(deliveryFee);
    this._promoCode.set(promoCode || null);
  }

  private persistToStorage(): void {
    const payload: PersistedCartV1 = {
      version: 1,
      deliveryFee: this._deliveryFee(),
      items: this._items(),
      promoCode: this._promoCode(),
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
   * Current promo code applied to cart (normalized uppercase), or null.
   */
  promoCode(): string | null {
    return this._promoCode();
  }

  // PUBLIC_INTERFACE
  /**
   * Last promo validation error message (if any).
   */
  promoError(): string | null {
    return this._promoError();
  }

  // PUBLIC_INTERFACE
  /**
   * Apply a promo code to the cart.
   *
   * Flow name: CartApplyPromoFlow
   *
   * Contract:
   * - Inputs: raw promo code string.
   * - Output: boolean success.
   * - Errors: never throws; on invalid code sets promoError() with message.
   * - Side effects: updates cart promo state + persists to localStorage.
   */
  applyPromoCode(codeRaw: string): boolean {
    this._promoError.set(null);

    const subtotal = this.subtotal();
    const deliveryFee = this.deliveryFee();
    const result = this.promos.applyPromoCode({
      codeRaw,
      lines: this._items(),
      subtotal,
      deliveryFee,
    });

    if (!result.ok || !result.code) {
      this._promoCode.set(null);
      this._promoError.set(result.error ?? 'Invalid promo code.');
      this.persistToStorage();
      return false;
    }

    this._promoCode.set(result.code);
    this._promoError.set(null);
    this.persistToStorage();
    return true;
  }

  // PUBLIC_INTERFACE
  /**
   * Remove promo code from cart.
   */
  clearPromoCode(): void {
    this._promoCode.set(null);
    this._promoError.set(null);
    this.persistToStorage();
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
      // Promo codes should not carry across restaurants.
      this._promoCode.set(null);
      this._promoError.set(null);
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
    this._promoCode.set(null);
    this._promoError.set(null);
    // Clearing cart should also clear persisted cart to avoid stale re-hydration.
    this.storage.remove(this.storageKey);
  }

  // PUBLIC_INTERFACE
  /**
   * Restore the cart from a past order snapshot and return a navigation target.
   *
   * Flow name: RestoreCartFromOrderFlow
   *
   * Contract:
   * - Inputs:
   *   - order: OrderSnapshot (must have restaurantId, lines with menuItemId/name/price/quantity)
   * - Output: RestoreCartFromOrderResult
   *   - ok=true => cart state updated, continueUrl indicates where to route next
   *   - ok=false => cart not modified
   * - Errors:
   *   - never throws (returns ok=false with error message)
   * - Side effects:
   *   - overwrites cart items/delivery fee/promo state
   *   - persists to localStorage
   *
   * Invariants enforced:
   * - All restored cart lines belong to the order's restaurant.
   * - Quantity is preserved from the order.
   *
   * Promo handling:
   * - Attempts to re-apply order.promoCode against the restored cart context.
   * - If promo is no longer eligible/valid, it is not applied and a notice is returned.
   */
  restoreFromOrder(order: OrderSnapshot): RestoreCartFromOrderResult {
    try {
      if (!order || typeof order !== 'object') {
        return { ok: false, error: 'Invalid order.' };
      }
      if (!order.restaurantId || !Array.isArray(order.lines) || order.lines.length === 0) {
        return { ok: false, error: 'Order has no items to reorder.' };
      }

      const restaurant = this.foodData.getRestaurantById(order.restaurantId);
      if (!restaurant) {
        // In demo app, restaurants are static. If missing, we cannot determine delivery fee.
        return { ok: false, error: 'Restaurant for this order is no longer available.' };
      }

      const deliveryFee = restaurant.deliveryFeeCents / 100;

      // Build new cart lines from order snapshot.
      const restoredLines: CartLine[] = order.lines
        .filter((l) => l && typeof l.menuItemId === 'string' && typeof l.quantity === 'number')
        .map((l) => {
          const menuItemId = l.menuItemId;
          const key = `${order.restaurantId}:${menuItemId}`;
          const quantity = Math.max(1, Math.floor(l.quantity));
          return {
            key,
            restaurantId: order.restaurantId,
            restaurantName: order.restaurantName,
            menuItemId,
            name: l.name,
            price: l.price,
            quantity,
          };
        });

      if (restoredLines.length === 0) {
        return { ok: false, error: 'Order has no valid items to reorder.' };
      }

      // Overwrite cart state (reorder should be deterministic).
      this._items.set(restoredLines);
      this._deliveryFee.set(deliveryFee);
      this._promoCode.set(null);
      this._promoError.set(null);

      let notice: string | undefined;

      // Attempt to re-apply promo if present on the order.
      if (order.promoCode) {
        const promoOk = this.applyPromoCode(order.promoCode);
        if (!promoOk) {
          notice = 'Items restored, but the promo code could not be re-applied.';
        }
      }

      this.persistToStorage();

      return {
        ok: true,
        continueUrl: `/restaurants/${order.restaurantId}`,
        notice,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to restore cart from order.';
      return { ok: false, error: message };
    }
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

  /**
   * Internal helper to compute discount breakdown (or null) for current promo.
   * Kept centralized so UI and totals always agree.
   */
  private computePromoBreakdown(): PromoDiscountBreakdown | null {
    const code = this._promoCode();
    if (!code) return null;

    const subtotal = this.subtotal();
    const deliveryFee = this.deliveryFee();
    const result = this.promos.applyPromoCode({
      codeRaw: code,
      lines: this._items(),
      subtotal,
      deliveryFee,
    });

    if (!result.ok || !result.breakdown) return null;
    return result.breakdown;
  }

  // PUBLIC_INTERFACE
  /**
   * Promo discount amount (dollars). Returns 0 if no promo is applied/valid.
   */
  promoDiscount = computed(() => this.computePromoBreakdown()?.discountAmount ?? 0);

  // PUBLIC_INTERFACE
  /**
   * Promo discount label for UI. Returns null if none.
   */
  promoLabel = computed(() => this.computePromoBreakdown()?.label ?? null);

  // PUBLIC_INTERFACE
  /**
   * Total after discounts (dollars).
   *
   * Invariant: never negative.
   */
  totalAfterDiscount = computed(() => {
    if (this._items().length === 0) return 0;
    const gross = this.subtotal() + this.deliveryFee();
    const discounted = gross - this.promoDiscount();
    return Math.max(0, discounted);
  });

  // PUBLIC_INTERFACE
  /**
   * Cart total in dollars (subtotal + delivery fee if cart not empty).
   * (Kept for backwards compatibility with existing UI; does not include promo.)
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
