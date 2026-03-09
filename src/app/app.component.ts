import { Component, computed, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { CartService, CartLine } from './services/cart.service';
import { CurrencyPipe } from '@angular/common';
import { ToastHostComponent } from './components/toast-host/toast-host.component';
import { ToastService } from './services/toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, CurrencyPipe, ToastHostComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  protected readonly cartOpen = signal(false);

  protected readonly cartCount = computed(() => this.cartService.totalItems());
  protected readonly cartTotal = computed(() => this.cartService.subtotal());

  constructor(
    protected readonly cartService: CartService,
    private readonly toasts: ToastService,
  ) {}

  protected openCart(): void {
    this.cartOpen.set(true);
  }

  protected closeCart(): void {
    this.cartOpen.set(false);
  }

  protected onClearCart(): void {
    if (this.cartService.items().length === 0) return;
    this.cartService.clear();
    this.toasts.info('Cart cleared.');
  }

  protected onIncrement(item: CartLine): void {
    this.cartService.increment(item.key);
    this.toasts.info(`Updated "${item.name}".`, 1400);
  }

  protected onDecrement(item: CartLine): void {
    const beforeQty = item.quantity;
    this.cartService.decrement(item.key);

    // If quantity was 1, decrement removes the item line.
    if (beforeQty <= 1) {
      this.toasts.info(`Removed "${item.name}".`, 1400);
    } else {
      this.toasts.info(`Updated "${item.name}".`, 1400);
    }
  }

  protected onRemove(item: CartLine): void {
    this.cartService.remove(item.key);
    this.toasts.info(`Removed "${item.name}".`, 1400);
  }
}
