import type { Coordinate, Restaurant, Suggestion } from '@fairtable/domain';
import { haversineDistance } from '@fairtable/domain';
import type { GeocodingProvider } from './geocoding/geocoding-provider.js';
import type { RestaurantProvider } from './restaurants/restaurant-provider.js';
import type { RoutingProvider } from './routing/routing-provider.js';
export const mockAddresses: Suggestion[] = [
  {
    label: 'Place de la République, Paris (synthetic)',
    coordinate: { lat: 48.8674, lon: 2.3638 },
  },
  {
    label: 'Place de la Bastille, Paris (synthetic)',
    coordinate: { lat: 48.853, lon: 2.369 },
  },
  {
    label: 'Place Saint-Michel, Paris (synthetic)',
    coordinate: { lat: 48.8531, lon: 2.3436 },
  },
];
export const mockRestaurants: Restaurant[] = [
  ['La Table des Amis', 'French;Bistro', 48.8606, 2.355],
  ['Sésame & Citron', 'Mediterranean;Vegetarian', 48.8585, 2.36],
  ['Osteria du Square', 'Italian', 48.863, 2.357],
  ['Le Petit Jardin', 'French', 48.856, 2.35],
  ['Comptoir du Midi', '', 48.864, 2.365],
].map(([name, cuisine, lat, lon], i) => ({
  id: `synthetic-${i}`,
  name: String(name),
  coordinate: { lat: Number(lat), lon: Number(lon) },
  cuisine: String(cuisine).split(';').filter(Boolean),
  address: i === 4 ? undefined : `${12 + i * 3} rue Exemple, Paris`,
  openingHours: i === 0 ? 'Mo-Sa 12:00-14:30,19:00-22:00' : undefined,
  website: i === 0 ? 'https://example.org' : undefined,
  wheelchair: i === 0 ? 'yes' : undefined,
  outdoorSeating: i < 2 ? 'yes' : undefined,
  dietaryOptions: i === 1 ? ['vegetarian', 'vegan'] : [],
  source: 'synthetic',
}));
export function mockProviders(): {
  geocoding: GeocodingProvider;
  restaurants: RestaurantProvider;
  routing: RoutingProvider;
} {
  return {
    geocoding: {
      async autocomplete(query) {
        const matches = mockAddresses.filter((a) =>
          a.label.toLowerCase().includes(query.toLowerCase()),
        );
        return matches.length ? matches : mockAddresses;
      },
    },
    restaurants: {
      async search() {
        return mockRestaurants;
      },
    },
    routing: {
      async route(from: Coordinate, to: Coordinate) {
        const i = mockRestaurants.findIndex(
          (r) => r.coordinate === to || r.coordinate.lon === to.lon,
        );
        const p = mockAddresses.findIndex(
          (a) =>
            Math.abs(a.coordinate.lat - from.lat) < 0.0001 &&
            Math.abs(a.coordinate.lon - from.lon) < 0.0001,
        );
        const minutes = [
          [18, 19, 20],
          [16, 20, 22],
          [14, 22, 25],
          [8, 24, 28],
          [25, 26, 27],
        ];
        return {
          distanceMeters: haversineDistance(from, to) * 1.45,
          durationSeconds:
            (minutes[i]?.[p] ?? 10 + haversineDistance(from, to) / 200) * 60,
        };
      },
    },
  };
}
