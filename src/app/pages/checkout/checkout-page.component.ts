import { Component, computed, signal } from '@angular/core';
import { CurrencyPipe, NgIf } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { OrderHistoryService } from '../../services/order-history.service';
import { PaymentMethod } from '../../models/order.models';

interface CheckoutForm {
  name: string;
  phone: string;
  address: string;
  instructions: string;
  paymentMethod: PaymentMethod;
}

@Component({
  selector: 'app-checkout-page',
  imports: [CurrencyPipe, NgIf, RouterLink],
  templateUrl: './checkout-page.component.html',
  styleUrl: './checkout-page.component.css',
})
export class CheckoutPageComponent {
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
  ) {}

  protected update<K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]): void {
    this.form.set({ ...this.form(), [key]: value });
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

      // Navigate to confirmation and pass the order snapshot in navigation state.
      // The confirmation page also supports refresh by falling back to the latest stored order.
      this.router.navigateByUrl('/order-confirmation', { state: { order } });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to place order.';
      this.error.set(message);
    }
  }
}
