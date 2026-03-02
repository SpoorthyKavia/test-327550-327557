import { Routes } from '@angular/router';
import { RestaurantsPageComponent } from './pages/restaurants/restaurants-page.component';
import { RestaurantDetailPageComponent } from './pages/restaurant-detail/restaurant-detail-page.component';
import { CheckoutPageComponent } from './pages/checkout/checkout-page.component';

// PUBLIC_INTERFACE
/**
 * Application route definitions.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', component: RestaurantsPageComponent, title: 'Restaurants | Food Delivery' },
  {
    path: 'restaurants/:id',
    component: RestaurantDetailPageComponent,
    title: 'Restaurant | Food Delivery',
  },
  { path: 'checkout', component: CheckoutPageComponent, title: 'Checkout | Food Delivery' },
  { path: '**', redirectTo: '' },
];
