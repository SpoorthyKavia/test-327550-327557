import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FoodDataService } from '../../services/food-data.service';
import { Restaurant } from '../../models/food.models';

@Component({
  selector: 'app-restaurants-page',
  imports: [RouterLink],
  templateUrl: './restaurants-page.component.html',
  styleUrl: './restaurants-page.component.css',
})
export class RestaurantsPageComponent {
  protected readonly query = signal('');
  protected readonly restaurants = signal<Restaurant[]>(this.foodData.getRestaurants());

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.restaurants();

    return this.restaurants().filter((r) => {
      const hay = `${r.name} ${r.cuisine.join(' ')} ${r.heroNote}`.toLowerCase();
      return hay.includes(q);
    });
  });

  constructor(private readonly foodData: FoodDataService) {}

  protected setQuery(value: string): void {
    this.query.set(value);
  }

  protected cuisineLabel(r: Restaurant): string {
    return r.cuisine.join(' • ');
  }
}
