import { Component, computed, signal } from '@angular/core';
import { CurrencyPipe, NgIf } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../services/cart.service';

interface CheckoutForm {
  name: string;
  phone: string;
  address: string;
  instructions: string;
  paymentMethod: 'card' | 'cash';
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
  protected readonly success = signal<string | null>(null);

  protected readonly cartEmpty = computed(() => this.cart.items().length === 0);

  constructor(
    protected readonly cart: CartService,
    private readonly router: Router,
  ) {}

  protected update<K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]): void {
    this.form.set({ ...this.form(), [key]: value });
  }

  protected placeOrder(): void {
    this.error.set(null);
    this.success.set(null);

    if (this.cart.items().length === 0) {
      this.error.set('Your cart is empty.');
      return;
    }

    const f = this.form();
    if (!f.name.trim() || !f.phone.trim() || !f.address.trim()) {
      this.error.set('Please fill in name, phone, and delivery address.');
      return;
    }

    // Demo behavior: "place order" locally and clear cart.
    this.cart.clear();
    this.success.set('Order placed! (Demo) Your food is on the way.');
    window.setTimeout(() => this.router.navigateByUrl('/'), 1800);
  }
}
