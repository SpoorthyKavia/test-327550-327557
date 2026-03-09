import { CurrencyPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { OrderSnapshot } from '../../models/order.models';
import { OrderHistoryService } from '../../services/order-history.service';

@Component({
  selector: 'app-order-confirmation-page',
  imports: [NgIf, NgFor, RouterLink, CurrencyPipe, DatePipe],
  templateUrl: './order-confirmation-page.component.html',
  styleUrl: './order-confirmation-page.component.css',
})
export class OrderConfirmationPageComponent {
  /**
   * The order is passed via router navigation state when coming from checkout.
   * If user refreshes, we fall back to the most recent order in history.
   */
  private readonly orderFromNav = (
    this.router.getCurrentNavigation()?.extras?.state as any
  )?.order as OrderSnapshot | undefined;

  protected readonly order = computed<OrderSnapshot | null>(() => {
    if (this.orderFromNav) return this.orderFromNav;
    const latest = this.history.getOrders()[0];
    return latest ?? null;
  });

  constructor(
    private readonly router: Router,
    private readonly history: OrderHistoryService,
  ) {}
}
