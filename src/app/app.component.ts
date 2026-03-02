import { Component, computed, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { CartService } from './services/cart.service';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, CurrencyPipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  protected readonly cartOpen = signal(false);

  protected readonly cartCount = computed(() => this.cartService.totalItems());
  protected readonly cartTotal = computed(() => this.cartService.subtotal());

  constructor(protected readonly cartService: CartService) {}

  protected openCart(): void {
    this.cartOpen.set(true);
  }

  protected closeCart(): void {
    this.cartOpen.set(false);
  }
}
