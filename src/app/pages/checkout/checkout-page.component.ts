import { Component, computed, signal } from '@angular/core';
import { CurrencyPipe, NgIf, NgFor } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { OrderHistoryService } from '../../services/order-history.service';
import { PaymentMethod, TipSelection } from '../../models/order.models';
import { LocalStorageService } from '../../services/local-storage.service';
import { ToastService } from '../../services/toast.service';

interface CheckoutForm {
  name: string;
  phone: string;
  address: string;
  instructions: string;
  paymentMethod: PaymentMethod;
}

type TipPreset = { label: string; percent: number };

interface PersistedCheckoutFormV1 {
  version: 1;
  form: CheckoutForm;
}

@Component({
  selector: 'app-checkout-page',
  imports: [CurrencyPipe, NgIf, NgFor, RouterLink],
  templateUrl: './checkout-page.component.html',
  styleUrl: './checkout-page.component.css',
})
export class CheckoutPageComponent {
  private readonly checkoutFormStorageKey = 'fd.checkoutForm.v1';

  protected readonly form = signal<CheckoutForm>({
    name: '',
    phone: '',
    address: '',
    instructions: '',
    paymentMethod: 'card',
  });

  protected readonly promoCodeInput = signal<string>('');

  protected readonly error = signal<string | null>(null);

  protected readonly cartEmpty = computed(() => this.cart.items().length === 0);

  protected readonly tipPresets: TipPreset[] = [
    { label: '0%', percent: 0.0 },
    { label: '10%', percent: 0.1 },
    { label: '15%', percent: 0.15 },
    { label: '20%', percent: 0.2 },
  ];

  /** UI-only value; persisted source-of-truth is cart.tipSelection(). */
  protected readonly customTipInput = signal<string>('');

  constructor(
    protected readonly cart: CartService,
    private readonly history: OrderHistoryService,
    private readonly router: Router,
    private readonly storage: LocalStorageService,
    private readonly toasts: ToastService,
  ) {
    this.restoreFormFromStorage();
    // Pre-fill input from cart promo (if any)
    this.promoCodeInput.set(this.cart.promoCode() ?? '');

    // Initialize custom tip input if user previously selected custom amount.
    const ts = this.cart.tipSelection();
    if (ts.type === 'amount') {
      this.customTipInput.set((ts.amount ?? 0).toFixed(2));
    }
  }

  /**
   * Flow name: CheckoutFormPersistenceFlow
   *
   * Contract:
   * - Inputs: none (restores into the `form` signal).
   * - Output: void.
   * - Errors: never throws; keeps defaults on invalid/missing persisted data.
   * - Side effects: reads localStorage.
   */
  private restoreFormFromStorage(): void {
    const persisted = this.storage.readJson<PersistedCheckoutFormV1 | null>(
      this.checkoutFormStorageKey,
      null,
    );
    if (!persisted || persisted.version !== 1) return;

    const f = persisted.form as Partial<CheckoutForm> | undefined;
    if (!f || typeof f !== 'object') return;

    const paymentMethod: PaymentMethod = f.paymentMethod === 'cash' ? 'cash' : 'card';

    this.form.set({
      name: typeof f.name === 'string' ? f.name : '',
      phone: typeof f.phone === 'string' ? f.phone : '',
      address: typeof f.address === 'string' ? f.address : '',
      instructions: typeof f.instructions === 'string' ? f.instructions : '',
      paymentMethod,
    });
  }

  private persistFormToStorage(): void {
    const payload: PersistedCheckoutFormV1 = { version: 1, form: this.form() };
    this.storage.writeJson(this.checkoutFormStorageKey, payload);
  }

  private clearPersistedForm(): void {
    this.storage.remove(this.checkoutFormStorageKey);
  }

  protected update<K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]): void {
    this.form.set({ ...this.form(), [key]: value });
    this.persistFormToStorage();
  }

  protected updatePromoInput(value: string): void {
    this.promoCodeInput.set(value);
  }

  protected applyPromo(): void {
    const ok = this.cart.applyPromoCode(this.promoCodeInput());
    if (ok) {
      this.toasts.success('Promo applied!', 1500);
      // normalize input to stored value
      this.promoCodeInput.set(this.cart.promoCode() ?? this.promoCodeInput());
    } else {
      const message = this.cart.promoError() ?? 'Invalid promo code.';
      this.toasts.error(message, 2000);
    }
  }

  protected clearPromo(): void {
    this.cart.clearPromoCode();
    this.promoCodeInput.set('');
    this.toasts.success('Promo removed', 1200);
  }

  protected selectTipPercent(percent: number): void {
    const selection: TipSelection = { type: 'percent', percent };
    this.cart.setTipSelection(selection);
    // Clear custom input when switching to preset.
    this.customTipInput.set('');
  }

  protected updateCustomTipInput(value: string): void {
    this.customTipInput.set(value);
  }

  protected applyCustomTip(): void {
    const raw = this.customTipInput().trim();
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      this.toasts.error('Enter a valid non-negative tip amount.', 1800);
      return;
    }
    const rounded = Math.round(parsed * 100) / 100;
    this.cart.setTipSelection({ type: 'amount', amount: rounded });
    this.toasts.success('Custom tip applied.', 1200);
  }

  protected tipIsPresetSelected(percent: number): boolean {
    const ts = this.cart.tipSelection();
    return ts.type === 'percent' && (ts.percent ?? 0) === percent;
  }

  protected placeOrder(): void {
    this.error.set(null);

    try {
      const f = this.form();
      const { order } = this.history.placeOrder(
        {
          customer: {
            name: f.name,
            phone: f.phone,
            address: f.address,
            instructions: f.instructions,
          },
          paymentMethod: f.paymentMethod,
        },
        this.cart,
      );

      // Order placed successfully: cart is cleared by OrderHistoryService.placeOrder(...)
      // so we should also clear persisted checkout form to avoid stale restoration.
      this.clearPersistedForm();

      this.toasts.success('Order placed!', 2000);

      // Navigate to confirmation and pass the order snapshot in navigation state.
      // The confirmation page also supports refresh by falling back to the latest stored order.
      this.router.navigateByUrl('/order-confirmation', { state: { order } });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to place order.';
      this.error.set(message);
      this.toasts.error(message);
    }
  }
}
