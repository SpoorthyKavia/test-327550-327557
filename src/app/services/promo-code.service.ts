import { Injectable } from '@angular/core';
import { CartLine } from './cart.service';

/**
 * Promo code domain types for local-only validation and discount computation.
 */
export type PromoDiscountType = 'percent' | 'amount';

/**
 * Represents the computed discount for a promo code.
 */
export interface PromoDiscountBreakdown {
  /** Discount amount applied to the order (in dollars). Always >= 0. */
  discountAmount: number;
  /** Optional human-friendly description to display in UI. */
  label: string;
}

/**
 * The result of attempting to validate/apply a promo code.
 */
export interface ApplyPromoResult {
  ok: boolean;
  /** Normalized promo code (uppercased/trimmed) when ok=true. */
  code?: string;
  /** Discount breakdown when ok=true. */
  breakdown?: PromoDiscountBreakdown;
  /** Error message when ok=false. */
  error?: string;
}

/**
 * Request object for applying a promo code to current cart.
 */
export interface ApplyPromoRequest {
  codeRaw: string;
  /**
   * Cart lines used to compute eligibility and subtotal.
   * Invariant: lines should be from a single restaurant (CartService enforces this).
   */
  lines: CartLine[];
  /** Delivery fee in dollars; generally excluded from discount. */
  deliveryFee: number;
  /** Order subtotal in dollars (sum of line totals). */
  subtotal: number;
}

/**
 * A promo rule (local-only) with eligibility and discount calculation.
 */
interface PromoRule {
  code: string;
  description: string;
  /**
   * If provided, subtotal must be >= minSubtotal to apply.
   */
  minSubtotal?: number;
  /**
   * If provided, the promo is valid only for the specified restaurant IDs.
   */
  eligibleRestaurantIds?: string[];
  discount:
    | { type: 'percent'; percentOff: number; maxDiscount?: number }
    | { type: 'amount'; amountOff: number };
}

/**
 * Central promo code registry for this demo app.
 * Add new promo codes here.
 */
const PROMO_RULES: PromoRule[] = [
  {
    code: 'SAVE10',
    description: '10% off (max $10)',
    discount: { type: 'percent', percentOff: 10, maxDiscount: 10 },
  },
  {
    code: 'FREESHIP',
    description: '$2.49 off (covers standard delivery fee)',
    discount: { type: 'amount', amountOff: 2.49 },
  },
  {
    code: 'WELCOME5',
    description: '$5 off orders $25+',
    minSubtotal: 25,
    discount: { type: 'amount', amountOff: 5 },
  },
];

/**
 * Ensures we never apply more discount than the amount we are discounting (subtotal+delivery).
 */
function clampDiscount(amount: number, max: number): number {
  return Math.max(0, Math.min(amount, max));
}

@Injectable({ providedIn: 'root' })
export class PromoCodeService {
  /**
   * PUBLIC_INTERFACE
   *
   * Flow name: ApplyPromoCodeFlow
   *
   * Contract:
   * - Inputs: request with raw code and cart pricing context.
   * - Output: ApplyPromoResult with ok/error and discount breakdown when ok.
   * - Errors: never throws (returns ok=false with a message).
   * - Side effects: none (pure computation over inputs).
   *
   * Validation rules:
   * - Code is required, trims whitespace, case-insensitive.
   * - Code must exist in PROMO_RULES.
   * - If minSubtotal exists, requires subtotal >= minSubtotal.
   * - If eligibleRestaurantIds exists, cart must match.
   *
   * Discount rules:
   * - Percent applies to subtotal only (delivery fee not discounted).
   * - Amount discount applies to total (subtotal + delivery), clamped to total.
   */
  applyPromoCode(request: ApplyPromoRequest): ApplyPromoResult {
    const normalized = request.codeRaw.trim().toUpperCase();
    if (!normalized) {
      return { ok: false, error: 'Enter a promo code.' };
    }

    const rule = PROMO_RULES.find((r) => r.code === normalized);
    if (!rule) {
      return { ok: false, error: 'Invalid promo code.' };
    }

    const firstRestaurantId = request.lines[0]?.restaurantId;
    if (rule.eligibleRestaurantIds && firstRestaurantId) {
      if (!rule.eligibleRestaurantIds.includes(firstRestaurantId)) {
        return { ok: false, error: 'Promo code not valid for this restaurant.' };
      }
    }

    if (typeof rule.minSubtotal === 'number' && request.subtotal < rule.minSubtotal) {
      return { ok: false, error: `Requires $${rule.minSubtotal.toFixed(2)}+ subtotal.` };
    }

    const subtotal = request.subtotal;
    const total = request.subtotal + request.deliveryFee;

    let discountAmount = 0;
    let label = rule.description;

    if (rule.discount.type === 'percent') {
      const raw = (subtotal * rule.discount.percentOff) / 100;
      const capped = typeof rule.discount.maxDiscount === 'number' ? Math.min(raw, rule.discount.maxDiscount) : raw;
      discountAmount = clampDiscount(capped, subtotal); // never exceeds subtotal
      label = `${rule.discount.percentOff}% off`;
      if (typeof rule.discount.maxDiscount === 'number') {
        label += ` (max $${rule.discount.maxDiscount.toFixed(2)})`;
      }
    } else {
      discountAmount = clampDiscount(rule.discount.amountOff, total);
      label = `$${rule.discount.amountOff.toFixed(2)} off`;
    }

    return {
      ok: true,
      code: normalized,
      breakdown: { discountAmount, label },
    };
  }

  /**
   * PUBLIC_INTERFACE
   *
   * Returns a display hint for the UI (optional helper).
   */
  getAvailablePromoCodes(): { code: string; description: string }[] {
    return PROMO_RULES.map((r) => ({ code: r.code, description: r.description }));
  }
}
