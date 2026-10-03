import { describe, it, expect } from 'vitest';
import {
  haversineDistance,
  mean,
  standardDeviation,
  travelSpread,
  meetingCenter,
  rankCandidates,
  searchRequestSchema,
  safeWebsite,
} from './index';
const rank = (values: number[][]) =>
  rankCandidates(
    values.map((values, i) => ({ item: { id: String(i) }, values })),
  );
describe('distance and statistics', () => {
  it('measures Paris–Lyon in metres and is symmetric', () => {
    const a = { lat: 48.8566, lon: 2.3522 },
      b = { lat: 45.764, lon: 4.8357 };
    expect(haversineDistance(a, b)).toBeCloseTo(391499, -2);
    expect(haversineDistance(a, b)).toEqual(haversineDistance(b, a));
    expect(haversineDistance(a, a)).toBe(0);
  });
  it('computes population statistics and rejects empty data', () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(standardDeviation([2, 4, 6])).toBeCloseTo(Math.sqrt(8 / 3));
    expect(travelSpread([2, 4, 6])).toBe(4);
    expect(() => mean([])).toThrow();
    expect(() => travelSpread([])).toThrow();
  });
});
describe('minimax meeting center', () => {
  it('finds midpoint for opposing participants', () => {
    expect(
      meetingCenter([
        { lat: 48, lon: 2 },
        { lat: 48, lon: 4 },
      ]),
    ).toEqual({ lat: 48, lon: 3 });
  });
  it('handles five points and duplicates', () => {
    const p = [
      { lat: 48, lon: 2 },
      { lat: 48, lon: 4 },
      { lat: 48, lon: 3 },
      { lat: 48, lon: 2 },
      { lat: 48, lon: 3 },
    ];
    expect(meetingCenter(p)).toEqual({ lat: 48, lon: 3 });
    expect(meetingCenter(Array(5).fill(p[0]))).toEqual(p[0]);
  });
  it('does not let a cluster hide a geographic outlier', () => {
    const p = [
      { lat: 48, lon: 2 },
      { lat: 48, lon: 2 },
      { lat: 48, lon: 2 },
      { lat: 48, lon: 2 },
      { lat: 48, lon: 8 },
    ];
    expect(meetingCenter(p).lon).toBeCloseTo(5);
    expect(mean(p.map((x) => x.lon))).toBeCloseTo(3.2);
  });
  it('uses three-point circumcircle for an acute triangle', () => {
    const c = meetingCenter([
      { lat: 0, lon: 0 },
      { lat: 0, lon: 2 },
      { lat: 1.73205, lon: 1 },
    ]);
    expect(c.lon).toBeCloseTo(1);
    expect(c.lat).toBeCloseTo(0.577, 2);
  });
  it('handles a date-line crossing', () => {
    expect(
      Math.abs(
        meetingCenter([
          { lat: 10, lon: 179 },
          { lat: 10, lon: -179 },
        ]).lon,
      ),
    ).toBeCloseTo(180);
  });
});
describe('fairness ranking', () => {
  it('prefers the midpoint', () =>
    expect(
      rank([
        [10, 10],
        [1, 15],
      ])[0].item.id,
    ).toBe('0'));
  it('prefers balanced 18/19/20 over a lower-average but unfair journey', () => {
    const results = rank([
      [18, 19, 20],
      [5, 14, 27],
    ]);
    expect(results[0].item.id).toBe('0');
    expect(mean([5, 14, 27])).toBeLessThan(mean([18, 19, 20]));
  });
  it('penalizes unnecessary travel among equally fair candidates', () =>
    expect(
      rank([
        [20, 20, 20],
        [90, 90, 90],
      ])[0].item.id,
    ).toBe('0'));
  it('works for five participants', () =>
    expect(
      rank([
        [10, 11, 10, 11, 10],
        [1, 4, 5, 7, 35],
      ])[0].item.id,
    ).toBe('0'));
  it('supports a single candidate and zero-length trips', () => {
    expect(rank([[18, 19, 20]])[0].fairnessScore).toBe(90);
    expect(rank([[0, 0]])[0].fairnessScore).toBe(100);
    expect(rank([])).toEqual([]);
  });
  it('is invariant to units and rejects non-finite data', () => {
    expect(
      rank([
        [18, 19, 20],
        [5, 14, 27],
      ]).map((x) => x.item.id),
    ).toEqual(
      rank([
        [1080, 1140, 1200],
        [300, 840, 1620],
      ]).map((x) => x.item.id),
    );
    expect(() => rank([[NaN, 1]])).toThrow();
  });
});
it('validates participant counts, coordinates and unique ids', () => {
  const p = { id: 'a', label: 'Alice', coordinate: { lat: 48, lon: 2 } };
  expect(searchRequestSchema.safeParse({ participants: [p, p] }).success).toBe(
    false,
  );
  expect(
    searchRequestSchema.safeParse({ participants: [p, { ...p, id: 'b' }] })
      .success,
  ).toBe(true);
  expect(
    searchRequestSchema.safeParse({
      participants: [p, { ...p, id: 'b', coordinate: { lat: 91, lon: 2 } }],
    }).success,
  ).toBe(false);
});
it('rejects unsafe website protocols', () => {
  expect(safeWebsite('javascript:alert(1)')).toBeUndefined();
  expect(safeWebsite('https://example.org')).toBe('https://example.org/');
});

it('does not sacrifice convenience for a negligible improvement in balance', () => {
  expect(
    rank([
      [18, 19, 20],
      [90, 90, 90],
    ])[0].item.id,
  ).toBe('0');
  expect(
    rank([
      [18, 19, 20],
      [5, 14, 27],
      [90, 90, 90],
    ])[0].item.id,
  ).toBe('0');
});
