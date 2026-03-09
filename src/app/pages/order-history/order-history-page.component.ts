import { Component, computed, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { OrderHistoryService } from '../../services/order-history.service';
import { OrderSnapshot } from '../../models/order.models';
import { CartService } from '../../services/cart.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-order-history-page',
  imports: [NgIf, NgFor, RouterLink, CurrencyPipe, DatePipe],
  templateUrl: './order-history-page.component.html',
  styleUrl: './order-history-page.component.css',
})
export class OrderHistoryPageComponent {
  private readonly refreshTick = signal(0);

  protected readonly orders = computed<OrderSnapshot[]>(() => {
    // signal dependency to refresh after clear
    this.refreshTick();
    return this.history.getOrders();
  });

  constructor(
    private readonly history: OrderHistoryService,
    private readonly cart: CartService,
    private readonly router: Router,
    private readonly toasts: ToastService,
  ) {}

  protected clear(): void {
    this.history.clearOrders();
    this.refreshTick.update((v) => v + 1);
  }

  /**
   * PUBLIC_INTERFACE
   *
   * Entry layer for triggering reorder from the Order History page.
   * Delegates to CartService.restoreFromOrder (canonical flow).
   */
  protected reorder(order: OrderSnapshot): void {
    const result = this.cart.restoreFromOrder(order);
    if (!result.ok) {
      this.toasts.error(result.error ?? 'Failed to reorder.');
      return;
    }

    if (result.notice) {
      this.toasts.warning(result.notice, 2500);
    } else {
      this.toasts.success('Cart restored from past order.', 1800);
    }

    this.router.navigateByUrl(result.continueUrl ?? '/checkout');
  }

  protected trackById(_index: number, o: OrderSnapshot): string {
    return o.id;
  }
}
