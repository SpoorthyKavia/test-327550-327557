import { Injectable } from '@angular/core';
import { MenuItem, Restaurant } from '../models/food.models';
import { DEMO_MENU, DEMO_RESTAURANTS } from '../data/demo-data';

@Injectable({ providedIn: 'root' })
export class FoodDataService {
  // PUBLIC_INTERFACE
  /**
   * Returns all restaurants (demo data).
   */
  getRestaurants(): Restaurant[] {
    return DEMO_RESTAURANTS.slice();
  }

  // PUBLIC_INTERFACE
  /**
   * Returns a restaurant by id (demo data), or undefined if not found.
   */
  getRestaurantById(id: string): Restaurant | undefined {
    return DEMO_RESTAURANTS.find((r) => r.id === id);
  }

  // PUBLIC_INTERFACE
  /**
   * Returns menu items for a restaurant (demo data).
   */
  getMenuByRestaurant(restaurantId: string): MenuItem[] {
    return DEMO_MENU.filter((m) => m.restaurantId === restaurantId);
  }
}
