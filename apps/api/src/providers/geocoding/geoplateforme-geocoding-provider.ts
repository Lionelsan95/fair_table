import { z } from 'zod';
import { coordinateSchema } from '@fairtable/domain';
import type { GeocodingProvider } from './geocoding-provider.js';
import { fetchJson, Limiter, ProviderError } from '../http.js';
const responseSchema = z.object({ results: z.array(z.unknown()) });
const entrySchema = z.object({
  fulltext: z.string().min(1),
  x: z.number(),
  y: z.number(),
});
export class GeoPlatformGeocodingProvider implements GeocodingProvider {
  private limiter = new Limiter(150, 30);
  constructor(private baseUrl: string) {}
  async autocomplete(query: string, signal?: AbortSignal) {
    const url = new URL(this.baseUrl);
    url.search = new URLSearchParams({
      text: query,
      type: 'StreetAddress',
      maximumResponses: '5',
    }).toString();
    const parsed = responseSchema.safeParse(
      await fetchJson(url, { signal, limiter: this.limiter }),
    );
    if (!parsed.success) throw new ProviderError('invalid');
    return parsed.data.results
      .flatMap((raw) => {
        const e = entrySchema.safeParse(raw);
        if (!e.success) return [];
        const coordinate = coordinateSchema.safeParse({
          lat: e.data.y,
          lon: e.data.x,
        });
        return coordinate.success
          ? [{ label: e.data.fulltext, coordinate: coordinate.data }]
          : [];
      })
      .slice(0, 5);
  }
}
