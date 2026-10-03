import type { Coordinate, Restaurant } from '@fairtable/domain';
export interface RestaurantProvider {
  search(
    center: Coordinate,
    radiusMeters: number,
    signal?: AbortSignal,
  ): Promise<Restaurant[]>;
}
