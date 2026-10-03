import { z } from 'zod';
import {
  searchResponseSchema,
  suggestionSchema,
  apiErrorCodeSchema,
} from '@fairtable/domain';
import type { SearchRequest, ApiErrorCode } from '@fairtable/domain';
import { webConfig } from './config';
export class ApiError extends Error {
  constructor(public readonly code: ApiErrorCode) {
    super(code);
    this.name = 'ApiError';
  }
}
async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${webConfig.apiBase}${path}`, {
    ...init,
    cache: 'no-store',
  });
  if (!response.ok) {
    const fallback: ApiErrorCode =
      response.status === 429
        ? 'rate_limited'
        : response.status === 400
          ? 'invalid_request'
          : 'service_unavailable';
    const body = z
      .object({ code: apiErrorCodeSchema })
      .safeParse(await response.json().catch(() => null));
    throw new ApiError(body.success ? body.data.code : fallback);
  }
  return response.json();
}
export async function autocomplete(q: string, signal: AbortSignal) {
  return z
    .object({ suggestions: z.array(suggestionSchema) })
    .parse(
      await request(`/api/autocomplete?q=${encodeURIComponent(q)}`, { signal }),
    ).suggestions;
}
export async function searchMeeting(body: SearchRequest, signal?: AbortSignal) {
  return searchResponseSchema.parse(
    await request('/api/meetings/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    }),
  );
}
export async function health() {
  return z
    .object({ status: z.string(), synthetic: z.boolean() })
    .parse(await request('/api/health'));
}
