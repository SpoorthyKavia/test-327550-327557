export type PriceCents = number;

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string[];
  rating: number; // 0..5
  etaMinutes: number;
  deliveryFeeCents: PriceCents;
  heroNote: string;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  priceCents: PriceCents;
  category: string;
  spicy?: boolean;
  vegetarian?: boolean;
}
