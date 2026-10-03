import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeOverpass } from '../src/providers/restaurants/overpass-restaurant-provider';
import { GeoPlatformGeocodingProvider } from '../src/providers/geocoding/geoplateforme-geocoding-provider';
import { GeoPlatformRoutingProvider } from '../src/providers/routing/geoplateforme-routing-provider';
import { fetchJson, Limiter } from '../src/providers/http';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const node = {
  type: 'node',
  id: 1,
  lat: 48.86,
  lon: 2.35,
  tags: {
    amenity: 'restaurant',
    name: 'Test',
    cuisine: 'french;vegetarian',
    website: 'https://example.org',
  },
};
describe('OSM normalization', () => {
  it('handles nodes, ways and relations with centers', () => {
    const r = normalizeOverpass({
      elements: [
        node,
        { ...node, id: 2, type: 'way', center: { lat: 48.87, lon: 2.35 } },
        { ...node, id: 3, type: 'relation', center: { lat: 48.88, lon: 2.35 } },
      ],
    });
    expect(r).toHaveLength(3);
    expect(r[0].cuisine).toEqual(['french', 'vegetarian']);
    expect(r[1].coordinate.lat).toBe(48.88);
  });
  it('handles missing name and optional fields honestly', () => {
    const r = normalizeOverpass({
      elements: [{ ...node, tags: { amenity: 'restaurant' } }],
    })[0];
    expect(r.name).toBe('');
    expect(r.cuisine).toEqual([]);
    expect(r.website).toBeUndefined();
  });
  it('deduplicates ids and nearby named node/way duplicates', () =>
    expect(
      normalizeOverpass({
        elements: [
          node,
          node,
          { ...node, type: 'way', id: 9, center: { lat: 48.86001, lon: 2.35 } },
        ],
      }),
    ).toHaveLength(1));
  it('ignores malformed coordinates, unsafe links and other amenities', () => {
    expect(
      normalizeOverpass({
        elements: [
          { ...node, lat: 999 },
          { ...node, type: 'way', center: undefined },
          { ...node, tags: { amenity: 'cafe' } },
        ],
      }),
    ).toEqual([]);
    expect(
      normalizeOverpass({
        elements: [
          { ...node, tags: { ...node.tags, website: 'javascript:alert(1)' } },
        ],
      })[0].website,
    ).toBeUndefined();
  });
  it('rejects upstream failure and partial timeout remarks', () => {
    expect(() => normalizeOverpass({ bad: true })).toThrow();
    expect(() =>
      normalizeOverpass({ elements: [], remark: 'runtime timeout' }),
    ).toThrow();
  });
});
describe('public service resilience', () => {
  it('retries 429 once then succeeds', async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetch);
    const promise = fetchJson('https://example.org');
    await vi.runAllTimersAsync();
    expect(await promise).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('bounds retries for 5xx', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
    vi.stubGlobal('fetch', fetch);
    const assertion = expect(fetchJson('https://example.org')).rejects.toThrow(
      'unavailable',
    );
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('respects a long Retry-After without immediately retrying', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response('', { status: 429, headers: { 'retry-after': '60' } }),
      );
    vi.stubGlobal('fetch', fetch);
    await expect(fetchJson('https://example.org')).rejects.toThrow('busy');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('reports timeouts', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('timeout', 'TimeoutError')),
    );
    const assertion = expect(fetchJson('https://example.org')).rejects.toThrow(
      'timeout',
    );
    await vi.runAllTimersAsync();
    await assertion;
  });
  it('supports cancellation before issuing a request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(
      fetchJson('https://example.org', { signal: AbortSignal.abort() }),
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('serializes and spaces all provider calls', async () => {
    const limiter = new Limiter(40);
    const times: number[] = [];
    await Promise.all(
      Array.from({ length: 3 }, () =>
        limiter.run(async () => {
          times.push(performance.now());
          return 1;
        }),
      ),
    );
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(35);
    expect(times[2] - times[1]).toBeGreaterThanOrEqual(35);
  });
  it('normalizes valid autocomplete entries and drops malformed ones', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          results: [
            { fulltext: 'Paris', x: 2.35, y: 48.86 },
            { fulltext: 'bad', x: 400, y: 50 },
          ],
        }),
      ),
    );
    expect(
      await new GeoPlatformGeocodingProvider(
        'https://example.org',
      ).autocomplete('Paris'),
    ).toEqual([{ label: 'Paris', coordinate: { lat: 48.86, lon: 2.35 } }]);
  });
  it('validates routing responses and requests explicit units', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ distance: 1000, duration: 120 }));
    vi.stubGlobal('fetch', fetch);
    expect(
      await new GeoPlatformRoutingProvider('https://example.org').route(
        { lat: 48, lon: 2 },
        { lat: 49, lon: 3 },
        'driving',
      ),
    ).toEqual({ distanceMeters: 1000, durationSeconds: 120 });
    expect(String(fetch.mock.calls[0][0])).toContain('timeUnit=second');
  });
  it('rejects malformed external responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => Response.json({ oops: true })),
    );
    await expect(
      new GeoPlatformRoutingProvider('https://example.org').route(
        { lat: 48, lon: 2 },
        { lat: 49, lon: 3 },
        'driving',
      ),
    ).rejects.toThrow('invalid');
    await expect(
      new GeoPlatformGeocodingProvider('https://example.org').autocomplete(
        'Paris',
      ),
    ).rejects.toThrow('invalid');
  });
});
