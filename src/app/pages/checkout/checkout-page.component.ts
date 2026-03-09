import { Component, computed, signal } from '@angular/core';
import { CurrencyPipe, NgIf } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { OrderHistoryService } from '../../services/order-history.service';
import { PaymentMethod } from '../../models/order.models';
import { LocalStorageService } from '../../services/local-storage.service';

interface CheckoutForm {
  name: string;
  phone: string;
  address: string;
  instructions: string;
  paymentMethod: PaymentMethod;
}

interface PersistedCheckoutFormV1 {
  version: 1;
  form: CheckoutForm;
}

@Component({
  selector: 'app-checkout-page',
  imports: [CurrencyPipe, NgIf, RouterLink],
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

  protected readonly error = signal<string | null>(null);

  protected readonly cartEmpty = computed(() => this.cart.items().length === 0);

  constructor(
    protected readonly cart: CartService,
    private readonly history: OrderHistoryService,
    private readonly router: Router,
    private readonly storage: LocalStorageService,
  ) {
    this.restoreFormFromStorage();
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

      // Navigate to confirmation and pass the order snapshot in navigation state.
      // The confirmation page also supports refresh by falling back to the latest stored order.
      this.router.navigateByUrl('/order-confirmation', { state: { order } });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to place order.';
      this.error.set(message);
    }
  }
}
