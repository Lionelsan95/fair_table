import type {
  Coordinate,
  TravelMetric,
  SearchRequest,
} from '@fairtable/domain';
export interface RoutingProvider {
  route(
    from: Coordinate,
    to: Coordinate,
    mode: SearchRequest['travelMode'],
    signal?: AbortSignal,
  ): Promise<TravelMetric>;
}
