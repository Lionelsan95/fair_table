import { z } from 'zod';
import type { Coordinate, SearchRequest } from '@fairtable/domain';
import type { RoutingProvider } from './routing-provider.js';
import { fetchJson, Limiter, ProviderError } from '../http.js';
const responseSchema = z.object({
  distance: z.number().finite().nonnegative(),
  duration: z.number().finite().nonnegative(),
});
export class GeoPlatformRoutingProvider implements RoutingProvider {
  private limiter = new Limiter(300, 80);
  constructor(private baseUrl: string) {}
  async route(
    from: Coordinate,
    to: Coordinate,
    mode: SearchRequest['travelMode'],
    signal?: AbortSignal,
  ) {
    const url = new URL(this.baseUrl);
    url.search = new URLSearchParams({
      resource: 'bdtopo-osrm',
      start: `${from.lon},${from.lat}`,
      end: `${to.lon},${to.lat}`,
      profile: mode === 'driving' ? 'car' : 'pedestrian',
      optimization: 'fastest',
      distanceUnit: 'meter',
      timeUnit: 'second',
      getSteps: 'false',
      getGeometry: 'false',
    }).toString();
    const parsed = responseSchema.safeParse(
      await fetchJson(url, { signal, timeoutMs: 4500, limiter: this.limiter }),
    );
    if (!parsed.success) throw new ProviderError('invalid');
    return {
      distanceMeters: parsed.data.distance,
      durationSeconds: parsed.data.duration,
    };
  }
}
