import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FoodDataService } from '../../services/food-data.service';
import { RestaurantFavoritesService } from '../../services/restaurant-favorites.service';
import { Restaurant } from '../../models/food.models';

type SortKey = 'recommended' | 'rating_desc' | 'eta_asc' | 'delivery_asc' | 'name_asc';

@Component({
  selector: 'app-restaurants-page',
  imports: [RouterLink],
  templateUrl: './restaurants-page.component.html',
  styleUrl: './restaurants-page.component.css',
})
export class RestaurantsPageComponent {
  protected readonly query = signal('');
  protected readonly restaurants = signal<Restaurant[]>(this.foodData.getRestaurants());

  /**
   * "Cuisine/category" filter uses Restaurant.cuisine[] (demo data already includes values like
   * Indian, Bowls, Pizza, Italian, Healthy, Salads, etc.). We treat these as tags.
   */
  protected readonly selectedCuisine = signal<string>('All');

  protected readonly sortKey = signal<SortKey>('recommended');

  /** If true, show only restaurants favorited by the user. */
  protected readonly favoritesOnly = signal(false);

  protected readonly cuisines = computed(() => {
    const set = new Set<string>();
    for (const r of this.restaurants()) {
      for (const c of r.cuisine) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  });

  protected readonly favoritesCount = computed(() => this.favorites.getFavorites().length);

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const selected = this.selectedCuisine();
    const favOnly = this.favoritesOnly();

    // 1) Filter
    let list = this.restaurants().filter((r) => {
      const matchesQuery = !q
        ? true
        : `${r.name} ${r.cuisine.join(' ')} ${r.heroNote}`.toLowerCase().includes(q);

      const matchesCuisine = selected === 'All' ? true : r.cuisine.includes(selected);

      const matchesFavorite = favOnly ? this.favorites.isFavorite(r.id) : true;

      return matchesQuery && matchesCuisine && matchesFavorite;
    });

    // 2) Sort (non-mutating)
    const key = this.sortKey();
    list = list.slice().sort((a, b) => {
      switch (key) {
        case 'rating_desc':
          return b.rating - a.rating;
        case 'eta_asc':
          return a.etaMinutes - b.etaMinutes;
        case 'delivery_asc':
          return a.deliveryFeeCents - b.deliveryFeeCents;
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'recommended':
        default: {
          // Simple "recommended" score using existing demo fields (rating primary, then faster ETA)
          const score = (r: Restaurant) => r.rating * 10 - r.etaMinutes / 10;
          return score(b) - score(a);
        }
      }
    });

    return list;
  });

  constructor(
    private readonly foodData: FoodDataService,
    protected readonly favorites: RestaurantFavoritesService,
  ) {}

  protected setQuery(value: string): void {
    this.query.set(value);
  }

  protected setCuisine(value: string): void {
    this.selectedCuisine.set(value);
  }

  protected setSort(value: string): void {
    // Defensive cast: template passes string; constrain to known keys.
    const allowed: SortKey[] = ['recommended', 'rating_desc', 'eta_asc', 'delivery_asc', 'name_asc'];
    if (allowed.includes(value as SortKey)) {
      this.sortKey.set(value as SortKey);
    }
  }

  protected setFavoritesOnly(value: boolean): void {
    this.favoritesOnly.set(value);
  }

  protected resetFilters(): void {
    this.selectedCuisine.set('All');
    this.sortKey.set('recommended');
    this.query.set('');
    this.favoritesOnly.set(false);
  }

  protected cuisineLabel(r: Restaurant): string {
    return r.cuisine.join(' • ');
  }

  protected toggleFavoriteFromCard(event: Event, restaurantId: string): void {
    // Prevent navigating when clicking the favorite button inside an <a> card.
    event.preventDefault();
    event.stopPropagation();
    this.favorites.toggle(restaurantId);
  }
}
