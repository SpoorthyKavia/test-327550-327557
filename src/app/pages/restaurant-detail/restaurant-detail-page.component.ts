import { Component, computed, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CurrencyPipe, NgIf } from '@angular/common';
import { FoodDataService } from '../../services/food-data.service';
import { CartService } from '../../services/cart.service';
import { ToastService } from '../../services/toast.service';
import { MenuItem, Restaurant } from '../../models/food.models';

@Component({
  selector: 'app-restaurant-detail-page',
  imports: [RouterLink, CurrencyPipe, NgIf],
  templateUrl: './restaurant-detail-page.component.html',
  styleUrl: './restaurant-detail-page.component.css',
})
export class RestaurantDetailPageComponent {
  protected readonly restaurant = signal<Restaurant | undefined>(undefined);
  protected readonly menu = signal<MenuItem[]>([]);
  protected readonly notice = signal<string | null>(null);

  protected readonly grouped = computed(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of this.menu()) {
      map.set(item.category, [...(map.get(item.category) ?? []), item]);
    }
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  });

  constructor(
    private readonly route: ActivatedRoute,
    private readonly foodData: FoodDataService,
    private readonly cart: CartService,
    private readonly toasts: ToastService,
  ) {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.restaurant.set(this.foodData.getRestaurantById(id));
    if (this.restaurant()) {
      this.menu.set(this.foodData.getMenuByRestaurant(id));
    }
  }

  protected add(item: MenuItem): void {
    const r = this.restaurant();
    if (!r) return;

    const result = this.cart.add({
      restaurantId: r.id,
      restaurantName: r.name,
      deliveryFee: r.deliveryFeeCents / 100,
      menuItemId: item.id,
      name: item.name,
      price: item.priceCents / 100,
    });

    if (result.resetOccurred) {
      this.toasts.warning('Cart cleared (different restaurant). Added item to new cart.');
    } else {
      this.toasts.success('Added to cart.', 1600);
    }
  }

  protected badges(item: MenuItem): string[] {
    const out: string[] = [];
    if (item.vegetarian) out.push('Vegetarian');
    if (item.spicy) out.push('Spicy');
    return out;
  }
}
