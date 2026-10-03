import { z } from 'zod';
export const coordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type Coordinate = z.infer<typeof coordinateSchema>;
export const participantSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().trim().min(1).max(60),
  coordinate: coordinateSchema,
});
export type Participant = z.infer<typeof participantSchema>;
export const searchRequestSchema = z.object({
  participants: z
    .array(participantSchema)
    .min(2)
    .max(5)
    .refine(
      (ps) => new Set(ps.map((p) => p.id)).size === ps.length,
      'Participant IDs must be unique',
    ),
  travelMode: z.enum(['driving', 'pedestrian']).default('driving'),
});
export type SearchRequest = z.infer<typeof searchRequestSchema>;
export const suggestionSchema = z.object({
  label: z.string(),
  coordinate: coordinateSchema,
});
export type Suggestion = z.infer<typeof suggestionSchema>;
export const restaurantSchema = z.object({
  id: z.string(),
  name: z.string(),
  coordinate: coordinateSchema,
  cuisine: z.array(z.string()),
  address: z.string().optional(),
  openingHours: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  wheelchair: z.string().optional(),
  outdoorSeating: z.string().optional(),
  reservation: z.string().optional(),
  dietaryOptions: z.array(z.string()),
  source: z.enum(['OpenStreetMap', 'synthetic']),
});
export type Restaurant = z.infer<typeof restaurantSchema>;
export const travelMetricSchema = z.object({
  distanceMeters: z.number().finite().nonnegative(),
  durationSeconds: z.number().finite().nonnegative(),
});
export type TravelMetric = z.infer<typeof travelMetricSchema>;
const journeySchema = z.object({
  participantId: z.string(),
  distanceMeters: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative().optional(),
});
export type Journey = z.infer<typeof journeySchema>;
export const statisticsSchema = z.object({
  min: z.number(),
  max: z.number(),
  mean: z.number(),
  spread: z.number(),
  standardDeviation: z.number(),
});
export const rankedRestaurantSchema = z.object({
  rank: z.number().int(),
  restaurant: restaurantSchema,
  fairnessScore: z.number().min(0).max(100),
  statistics: statisticsSchema,
  journeys: z.array(journeySchema),
});
export type RankedRestaurant = z.infer<typeof rankedRestaurantSchema>;
export const searchResponseSchema = z.object({
  searchCenter: coordinateSchema,
  metricSource: z.enum(['routing', 'geodesic']),
  restaurants: z.array(rankedRestaurantSchema),
  radiusMeters: z.number(),
  candidateCount: z.number(),
  synthetic: z.boolean(),
  warning: z.string().optional(),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;
const EARTH_RADIUS = 6371008.8;
const radians = (x: number) => (x * Math.PI) / 180;
export function haversineDistance(a: Coordinate, b: Coordinate): number {
  const dLat = radians(b.lat - a.lat),
    dLon = radians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.lat)) *
      Math.cos(radians(b.lat)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function mean(values: readonly number[]): number {
  if (!values.length) throw new Error('At least one value required');
  return values.reduce((a, b) => a + b, 0) / values.length;
}
export function standardDeviation(values: readonly number[]): number {
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}
export function travelSpread(values: readonly number[]): number {
  if (!values.length) throw new Error('At least one value required');
  return Math.max(...values) - Math.min(...values);
}
export function statistics(values: readonly number[]) {
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    mean: mean(values),
    spread: travelSpread(values),
    standardDeviation: standardDeviation(values),
  };
}
/** Enumerate circles defined by 1, 2 or 3 points in a local equirectangular
 * projection; the smallest enclosing circle minimizes the worst planar trip.
 * Intended for regional groups; not a road-network or global geodesic optimum. */
export function meetingCenter(coordinates: readonly Coordinate[]): Coordinate {
  if (!coordinates.length) throw new Error('At least one coordinate required');
  const origin = coordinates[0],
    lat0 = radians(mean(coordinates.map((p) => p.lat))),
    scale = Math.max(0.000001, Math.cos(lat0));
  const points = coordinates.map((p) => ({
    x: EARTH_RADIUS * radians(((p.lon - origin.lon + 540) % 360) - 180) * scale,
    y: EARTH_RADIUS * radians(p.lat - origin.lat),
  }));
  const centers = [...points];
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i],
        b = points[j];
      centers.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      for (let k = j + 1; k < points.length; k++) {
        const c = points[k],
          d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
        if (Math.abs(d) < 1e-6) continue;
        const aa = a.x * a.x + a.y * a.y,
          bb = b.x * b.x + b.y * b.y,
          cc = c.x * c.x + c.y * c.y;
        centers.push({
          x: (aa * (b.y - c.y) + bb * (c.y - a.y) + cc * (a.y - b.y)) / d,
          y: (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x)) / d,
        });
      }
    }
  const best = centers.reduce<{ x: number; y: number; radius: number }>(
    (best, c) => {
      const radius = Math.max(
        ...points.map((p) => Math.hypot(p.x - c.x, p.y - c.y)),
      );
      return radius < best.radius ? { ...c, radius } : best;
    },
    { ...points[0], radius: Infinity },
  );
  return {
    lat: origin.lat + ((best.y / EARTH_RADIUS) * 180) / Math.PI,
    lon:
      ((origin.lon +
        ((best.x / (EARTH_RADIUS * scale)) * 180) / Math.PI +
        540) %
        360) -
      180,
  };
}
export const FAIRNESS_WEIGHT = 0.7;
/** Relative ordering: 70% fairness (spread + population deviation), 30% worst
 * trip. Normalize all components by the same candidate-set worst trip.
 * Twice population deviation is bounded by spread. A common scale avoids
 * amplifying tiny imbalance and rewarding perfectly equal but very long trips.
 * Display score is separately 100 × (1 - spread / max trip), a balance indicator,
 * not a rating or a promise of accuracy. All candidates MUST share one unit. */
export function rankCandidates<T extends { id: string }>(
  candidates: readonly { item: T; values: number[] }[],
): {
  item: T;
  fairnessScore: number;
  statistics: ReturnType<typeof statistics>;
  cost: number;
}[] {
  const rows = candidates.map((c) => {
    if (!c.values.length || c.values.some((v) => !Number.isFinite(v) || v < 0))
      throw new Error('Invalid travel metrics');
    return { ...c, statistics: statistics(c.values) };
  });
  const maxScale = Math.max(0, ...rows.map((r) => r.statistics.max)) || 1;
  return rows
    .map((r) => ({
      ...r,
      fairnessScore: Math.round(
        100 * (1 - r.statistics.spread / (r.statistics.max || 1)),
      ),
      cost:
        (FAIRNESS_WEIGHT *
          (r.statistics.spread / maxScale +
            (2 * r.statistics.standardDeviation) / maxScale)) /
          2 +
        ((1 - FAIRNESS_WEIGHT) * r.statistics.max) / maxScale,
    }))
    .sort(
      (a, b) =>
        a.cost - b.cost ||
        a.statistics.max - b.statistics.max ||
        a.item.id.localeCompare(b.item.id),
    );
}
export function safeWebsite(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** Stable protocol codes; user-facing wording belongs to the client locale. */
export const apiErrorCodeSchema = z.enum([
  'invalid_request',
  'rate_limited',
  'service_busy',
  'geocoding_unavailable',
  'restaurants_unavailable',
  'service_unavailable',
]);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
