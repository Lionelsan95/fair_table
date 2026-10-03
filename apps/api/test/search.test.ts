import { describe, it, expect, vi } from 'vitest';
import { searchMeeting } from '../src/search';
import {
  mockProviders,
  mockAddresses,
  mockRestaurants,
} from '../src/providers/mock';
import { buildApp } from '../src/app';
const request = {
  participants: mockAddresses.map((a, i) => ({
    id: `p${i}`,
    label: `Person ${i}`,
    coordinate: a.coordinate,
  })),
  travelMode: 'driving' as const,
};
const settings = {
  radii: [2000, 5000, 10000],
  minimumCandidates: 3,
  shortlistSize: 3,
  resultLimit: 5,
  synthetic: true,
};
describe('search orchestration', () => {
  it('shortlists before routing and stops radius expansion when enough candidates exist', async () => {
    const p = mockProviders();
    const search = vi.spyOn(p.restaurants, 'search'),
      route = vi.spyOn(p.routing, 'route');
    const result = await searchMeeting(request, p, undefined, settings);
    expect(search).toHaveBeenCalledTimes(1);
    expect(route).toHaveBeenCalledTimes(9);
    expect(result.metricSource).toBe('routing');
    expect(result.restaurants).toHaveLength(3);
    expect(result.restaurants[0].rank).toBe(1);
  });
  it('expands adaptively and returns even one restaurant', async () => {
    const p = mockProviders();
    p.restaurants.search = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValue([mockRestaurants[0]]);
    const result = await searchMeeting(request, p, undefined, settings);
    expect(result.radiusMeters).toBe(10000);
    expect(result.restaurants).toHaveLength(1);
  });
  it('handles an empty search without routing', async () => {
    const p = mockProviders();
    p.restaurants.search = async () => [];
    const route = vi.spyOn(p.routing, 'route');
    const result = await searchMeeting(request, p, undefined, settings);
    expect(result.restaurants).toEqual([]);
    expect(route).not.toHaveBeenCalled();
  });
  it('falls back consistently on partial routing failure without invented times', async () => {
    const p = mockProviders();
    p.routing.route = vi
      .fn()
      .mockResolvedValueOnce({ distanceMeters: 1200, durationSeconds: 80 })
      .mockRejectedValue(new Error('429'));
    const result = await searchMeeting(request, p, undefined, settings);
    expect(result.metricSource).toBe('geodesic');
    expect(result.warning).toContain('straight-line');
    for (const r of result.restaurants)
      for (const j of r.journeys) expect(j.durationSeconds).toBeUndefined();
  });
});
describe('REST API', () => {
  it('serves health, autocomplete and search with no-store privacy headers', async () => {
    const app = buildApp(mockProviders());
    const health = await app.inject('/api/health');
    expect(health.statusCode).toBe(200);
    expect(health.headers['cache-control']).toBe('no-store');
    expect(
      (await app.inject('/api/autocomplete?q=Paris')).json().suggestions,
    ).toHaveLength(3);
    const result = await app.inject({
      method: 'POST',
      url: '/api/meetings/search',
      payload: request,
    });
    expect(result.statusCode).toBe(200);
    expect(result.json().restaurants).toHaveLength(5);
    await app.close();
  });
  it('rejects invalid input before providers', async () => {
    const p = mockProviders(),
      spy = vi.spyOn(p.restaurants, 'search'),
      app = buildApp(p);
    for (const participants of [
      [],
      [request.participants[0]],
      Array(6).fill(request.participants[0]),
      [request.participants[0], request.participants[0]],
    ])
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/meetings/search',
            payload: { participants },
          })
        ).statusCode,
      ).toBe(400);
    const invalid = await app.inject('/api/autocomplete?q=ab');
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().code).toBe('invalid_request');
    expect(spy).not.toHaveBeenCalled();
    await app.close();
  });
  it('sanitizes upstream errors', async () => {
    const p = mockProviders();
    p.restaurants.search = async () => {
      throw new Error('secret upstream coordinates');
    };
    const app = buildApp(p);
    const response = await app.inject({
      method: 'POST',
      url: '/api/meetings/search',
      payload: request,
    });
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain('secret');
    expect(response.json().code).toBe('restaurants_unavailable');
    await app.close();
  });
});
