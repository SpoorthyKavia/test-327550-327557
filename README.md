# Food Delivery Web UI (Angular)

A simple food delivery demo app:

- Browse restaurants
- View restaurant menu
- Add items to cart (cart resets if you add items from a different restaurant)
- Checkout form + demo “place order”

## Run locally

```bash
npm install
npm start
```

Then open `http://localhost:4200`.

## Notes

- This is a frontend-only demo using local in-memory data (`src/app/data/demo-data.ts`).
- You can later replace `FoodDataService` with an HTTP API client when the Backend API container is available.
