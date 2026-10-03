import { z } from 'zod';
import {
  coordinateSchema,
  haversineDistance,
  safeWebsite,
} from '@fairtable/domain';
import type { Coordinate, Restaurant } from '@fairtable/domain';
import type { RestaurantProvider } from './restaurant-provider.js';
import { fetchJson, Limiter, ProviderError } from '../http.js';
const payloadSchema = z.object({
  elements: z.array(z.unknown()),
  remark: z.string().optional(),
});
const elementSchema = z.object({
  type: z.enum(['node', 'way', 'relation']),
  id: z.number(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  center: coordinateSchema.optional(),
  tags: z.record(z.string(), z.string()),
});
export function normalizeOverpass(payload: unknown): Restaurant[] {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success || parsed.data.remark) throw new ProviderError('invalid');
  const restaurants: Restaurant[] = [];
  for (const raw of parsed.data.elements) {
    const e = elementSchema.safeParse(raw);
    if (!e.success) continue;
    const { tags: t, ...v } = e.data;
    if (t.amenity !== 'restaurant') continue;
    const coord = coordinateSchema.safeParse(
      v.type === 'node' ? { lat: v.lat, lon: v.lon } : v.center,
    );
    if (!coord.success) continue;
    const name = t.name?.trim() || '';
    const id = `osm-${v.type}-${v.id}`;
    if (
      restaurants.some(
        (r) =>
          r.id === id ||
          (name !== '' &&
            r.name.toLocaleLowerCase() === name.toLocaleLowerCase() &&
            haversineDistance(r.coordinate, coord.data) < 30),
      )
    )
      continue;
    restaurants.push({
      id,
      name,
      coordinate: coord.data,
      cuisine:
        t.cuisine
          ?.split(';')
          .map((s) => s.replaceAll('_', ' ').trim())
          .filter(Boolean) ?? [],
      address:
        [
          t['addr:housenumber'],
          t['addr:street'],
          t['addr:postcode'],
          t['addr:city'],
        ]
          .filter(Boolean)
          .join(' ') || undefined,
      openingHours: t.opening_hours,
      phone: t['contact:phone'] || t.phone,
      website: safeWebsite(t['contact:website'] || t.website),
      wheelchair: t.wheelchair,
      outdoorSeating: t.outdoor_seating,
      reservation: t.reservation,
      dietaryOptions: ['vegetarian', 'vegan'].filter((d) =>
        ['yes', 'only'].includes(t[`diet:${d}`]),
      ),
      source: 'OpenStreetMap',
    });
  }
  return restaurants.sort(
    (a, b) =>
      Number(a.name === '') - Number(b.name === '') || a.id.localeCompare(b.id),
  );
}
export class OverpassRestaurantProvider implements RestaurantProvider {
  private limiter = new Limiter(1100, 6);
  constructor(private baseUrl: string) {}
  async search(center: Coordinate, radiusMeters: number, signal?: AbortSignal) {
    const query = `[out:json][timeout:20];nwr["amenity"="restaurant"](around:${radiusMeters},${center.lat},${center.lon});out center tags;`;
    const url = new URL(this.baseUrl);
    url.searchParams.set('data', query);
    return normalizeOverpass(
      await fetchJson(url, {
        signal,
        timeoutMs: 25000,
        limiter: this.limiter,
        init: {
          headers: {
            'User-Agent': 'FairTable/1.0 (open-data meeting planner)',
          },
        },
      }),
    );
  }
}
