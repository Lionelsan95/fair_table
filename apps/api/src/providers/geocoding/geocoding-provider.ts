import type { Suggestion } from '@fairtable/domain';
export interface GeocodingProvider {
  autocomplete(query: string, signal?: AbortSignal): Promise<Suggestion[]>;
}
