import { CartLine } from '../services/cart.service';

export type PaymentMethod = 'card' | 'cash';

export interface CustomerInfo {
  name: string;
  phone: string;
  address: string;
  instructions: string;
}

export interface OrderTotals {
  subtotal: number; // dollars
  deliveryFee: number; // dollars

  /**
   * Promo discount amount (dollars). 0 if none.
   */
  discount: number;

  /**
   * Total after discounts (dollars).
   */
  total: number; // dollars
}

/**
 * Immutable snapshot of the cart line stored with an order.
 * We intentionally copy only required fields to keep order history stable
 * even if CartLine changes in the future.
 */
export interface OrderLineSnapshot {
  menuItemId: string;
  name: string;
  price: number; // dollars
  quantity: number;
}

export interface OrderSnapshot {
  id: string;
  placedAtIso: string;

  restaurantId: string;
  restaurantName: string;

  customer: CustomerInfo;
  paymentMethod: PaymentMethod;

  lines: OrderLineSnapshot[];
  totals: OrderTotals;

  /**
   * Promo code used for the order (normalized, uppercase). Null if none.
   */
  promoCode: string | null;
}

// PUBLIC_INTERFACE
/**
 * Builds an order line snapshot from a cart line.
 */
export function toOrderLineSnapshot(line: CartLine): OrderLineSnapshot {
  return {
    menuItemId: line.menuItemId,
    name: line.name,
    price: line.price,
    quantity: line.quantity,
  };
}
