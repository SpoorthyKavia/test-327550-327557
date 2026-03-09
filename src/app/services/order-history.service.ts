import { Injectable } from '@angular/core';
import { CartService } from './cart.service';
import { CustomerInfo, OrderSnapshot, PaymentMethod, toOrderLineSnapshot } from '../models/order.models';

interface PlaceOrderRequest {
  customer: CustomerInfo;
  paymentMethod: PaymentMethod;
}

interface PlaceOrderResult {
  order: OrderSnapshot;
}

@Injectable({ providedIn: 'root' })
export class OrderHistoryService {
  private readonly storageKey = 'fd.orderHistory.v1';

  // PUBLIC_INTERFACE
  /**
   * Load order history from localStorage.
   *
   * Contract:
   * - Inputs: none
   * - Output: array of orders sorted newest-first.
   * - Errors: never throws; returns [] if localStorage is unavailable or data is invalid.
   * - Side effects: reads localStorage
   */
  getOrders(): OrderSnapshot[] {
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      // Minimal shape validation to avoid runtime errors in templates
      return parsed
        .filter((o) => o && typeof o === 'object' && typeof (o as any).id === 'string')
        .sort((a, b) => ((a as any).placedAtIso < (b as any).placedAtIso ? 1 : -1)) as OrderSnapshot[];
    } catch {
      return [];
    }
  }

  // PUBLIC_INTERFACE
  /**
   * Clear order history.
   *
   * Contract:
   * - Inputs: none
   * - Output: void
   * - Side effects: writes localStorage
   */
  clearOrders(): void {
    try {
      window.localStorage.removeItem(this.storageKey);
    } catch {
      // no-op: localStorage might be blocked; app should remain usable
    }
  }

  // PUBLIC_INTERFACE
  /**
   * Place an order using the current cart, persist it to localStorage,
   * and clear the cart.
   *
   * Flow name: PlaceOrderFlow
   *
   * Contract:
   * - Inputs:
   *   - request.customer: required name/phone/address (trimmed)
   *   - request.paymentMethod: 'card' | 'cash'
   * - Output:
   *   - result.order: the created order snapshot (also persisted)
   * - Errors:
   *   - throws Error if cart is empty or required fields missing
   * - Side effects:
   *   - reads cart
   *   - writes localStorage
   *   - clears cart on success
   */
  placeOrder(request: PlaceOrderRequest, cart: CartService): PlaceOrderResult {
    const items = cart.items();
    if (items.length === 0) {
      throw new Error('Your cart is empty.');
    }

    const customer: CustomerInfo = {
      name: request.customer.name.trim(),
      phone: request.customer.phone.trim(),
      address: request.customer.address.trim(),
      instructions: request.customer.instructions ?? '',
    };

    if (!customer.name || !customer.phone || !customer.address) {
      throw new Error('Please fill in name, phone, and delivery address.');
    }

    const first = items[0];
    const allSameRestaurant = items.every((l) => l.restaurantId === first.restaurantId);
    if (!allSameRestaurant) {
      // This should not happen because CartService resets on different restaurant,
      // but we keep the invariant explicit and defensive for future changes.
      throw new Error('Cart contains items from multiple restaurants. Please clear cart and try again.');
    }

    const subtotal = items.reduce((sum, l) => sum + l.price * l.quantity, 0);
    const deliveryFee = cart.deliveryFee();
    const discount = cart.promoDiscount();

    const baseAfterDiscount = Math.max(0, subtotal + deliveryFee - discount);
    const tip = cart.tipAmount();
    const total = Math.max(0, baseAfterDiscount + tip);

    const totals = {
      subtotal,
      deliveryFee,
      discount,
      tip,
      total,
    };

    const order: OrderSnapshot = {
      id: this.newOrderId(),
      placedAtIso: new Date().toISOString(),
      restaurantId: first.restaurantId,
      restaurantName: first.restaurantName,
      customer,
      paymentMethod: request.paymentMethod,
      lines: items.map(toOrderLineSnapshot),
      totals,
      promoCode: cart.promoCode(),
      tipSelection: cart.tipSelection(),
    };

    this.appendOrder(order);
    cart.clear();

    return { order };
  }

  private appendOrder(order: OrderSnapshot): void {
    try {
      const existing = this.getOrders();
      const next = [order, ...existing].slice(0, 50); // keep bounded history
      window.localStorage.setItem(this.storageKey, JSON.stringify(next));
    } catch {
      // If storage is blocked/full, we still allow checkout to proceed (demo app).
    }
  }

  private newOrderId(): string {
    // readable, unique enough for local demo usage
    return `ORD-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }
}
