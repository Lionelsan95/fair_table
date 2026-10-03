import {
  haversineDistance,
  meetingCenter,
  rankCandidates,
} from '@fairtable/domain';
import type {
  Journey,
  Restaurant,
  SearchRequest,
  SearchResponse,
} from '@fairtable/domain';
import type { RestaurantProvider } from './providers/restaurants/restaurant-provider.js';
import type { RoutingProvider } from './providers/routing/routing-provider.js';
import { config } from './config.js';
export async function searchMeeting(
  request: SearchRequest,
  providers: { restaurants: RestaurantProvider; routing: RoutingProvider },
  signal?: AbortSignal,
  settings = {
    radii: config.radii,
    minimumCandidates: config.minimumCandidates,
    shortlistSize: config.SHORTLIST_SIZE,
    resultLimit: config.resultLimit,
    synthetic: false,
  },
): Promise<SearchResponse> {
  const searchCenter = meetingCenter(
    request.participants.map((p) => p.coordinate),
  );
  let radiusMeters = settings.radii[0];
  const all = new Map<string, Restaurant>();
  for (const radius of settings.radii) {
    signal?.throwIfAborted();
    radiusMeters = radius;
    const found = await providers.restaurants.search(
      searchCenter,
      radius,
      signal,
    );
    for (const r of found) all.set(r.id, r);
    if (all.size >= settings.minimumCandidates) break;
  }
  const candidates = [...all.values()];
  const short = rankCandidates(
    candidates.map((item) => ({
      item,
      values: request.participants.map((p) =>
        haversineDistance(p.coordinate, item.coordinate),
      ),
    })),
  ).slice(0, settings.shortlistSize);
  const geometry = new Map<string, Journey[]>(
    short.map((r) => [
      r.item.id,
      request.participants.map((p) => ({
        participantId: p.id,
        distanceMeters: haversineDistance(p.coordinate, r.item.coordinate),
      })),
    ]),
  );
  const routed = new Map<string, Journey[]>();
  let failed = false;
  // Two workers bound memory and avoid filling the global provider queue. Stop
  // scheduling after a failure; compare ALL candidates using the same fallback.
  let cursor = 0;
  const deadline = AbortSignal.timeout(30000);
  const routeSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  async function worker() {
    while (cursor < short.length && !failed) {
      const item = short[cursor++].item;
      try {
        const journeys: Journey[] = [];
        for (const p of request.participants) {
          if (failed) return;
          const metric = await providers.routing.route(
            p.coordinate,
            item.coordinate,
            request.travelMode,
            routeSignal,
          );
          journeys.push({ participantId: p.id, ...metric });
        }
        routed.set(item.id, journeys);
      } catch {
        if (signal?.aborted) throw signal.reason;
        failed = true;
      }
    }
  }
  await Promise.all([worker(), worker()]);
  const metricSource = failed ? 'geodesic' : 'routing';
  const journeys = failed ? geometry : routed;
  const ranked = rankCandidates(
    short.map((r) => ({
      item: r.item,
      values: (journeys.get(r.item.id) ?? []).map((j) =>
        metricSource === 'routing'
          ? 'durationSeconds' in j
            ? (j.durationSeconds ?? 0)
            : 0
          : j.distanceMeters,
      ),
    })),
  );
  return {
    searchCenter,
    metricSource,
    radiusMeters,
    candidateCount: candidates.length,
    synthetic: settings.synthetic,
    warning: failed
      ? 'Road journeys are unavailable. All comparisons use straight-line distance.'
      : undefined,
    restaurants: ranked.slice(0, settings.resultLimit).map((r, i) => ({
      rank: i + 1,
      restaurant: r.item,
      fairnessScore: r.fairnessScore,
      statistics: r.statistics,
      journeys: journeys.get(r.item.id) ?? [],
    })),
  };
}
