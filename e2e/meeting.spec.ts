import { expect, test } from '@playwright/test';
import { mockAddresses, mockRestaurants } from '../apps/api/src/providers/mock';
const results = mockRestaurants.map((restaurant, i) => ({
  restaurant,
  rank: i + 1,
  fairnessScore: 95 - i * 3,
  statistics: {
    min: 1080,
    max: 1200,
    mean: 1140,
    spread: 120,
    standardDeviation: 49,
  },
  journeys: mockAddresses.map((_, j) => ({
    participantId: `p${j + 1}`,
    distanceMeters: 2000 + j * 100,
    durationSeconds: 1080 + j * 60,
  })),
}));
test.beforeEach(async ({ page }) => {
  await page.route('https://tiles.openfreemap.org/**', (route) =>
    route.fulfill({
      json: {
        version: 8,
        sources: {},
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#e8ede6' },
          },
        ],
      },
    }),
  );
  await page.route('**/api/health', (route) =>
    route.fulfill({ json: { status: 'ok', synthetic: true } }),
  );
  await page.route('**/api/autocomplete?*', (route) =>
    route.fulfill({ json: { suggestions: mockAddresses } }),
  );
  await page.route('**/api/meetings/search', (route) =>
    route.fulfill({
      json: {
        searchCenter: { lat: 48.86, lon: 2.35 },
        metricSource: 'routing',
        restaurants: results,
        radiusMeters: 2000,
        candidateCount: 5,
        synthetic: true,
      },
    }),
  );
});
test('three friends find a fair table and map/list selection stays synchronized', async ({
  page,
}, testInfo) => {
  await page.goto('/?lang=en');
  await page.getByRole('button', { name: '3 people' }).click();
  for (let i = 0; i < 3; i++) {
    const field = page.getByRole('combobox', {
      name: `Address for person ${i + 1}`,
    });
    await field.fill('Paris');
    await page.getByRole('option').nth(i).click();
  }
  await expect(
    page.getByRole('button', { name: /Find a fair table/ }),
  ).toBeEnabled();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-ready.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /Find a fair table/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Your common ground.' }),
  ).toBeVisible();
  await expect(page.locator('.restaurant-card')).toHaveCount(5);
  await expect(page.locator('.map-marker.restaurant')).toHaveCount(5);
  await expect(page.locator('.map-error')).toHaveCount(0);
  await page.getByRole('button', { name: /Select restaurant 2/ }).click();
  await expect(page.locator('.map-marker.restaurant').nth(1)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.restaurant-card').nth(1)).toHaveAttribute(
    'data-selected',
    'true',
  );
  await expect(page.getByText('A closer look')).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Restaurant 1: La Table des Amis',
      exact: true,
    })
    .click();
  await expect(page.locator('.restaurant-card').first()).toHaveAttribute(
    'data-selected',
    'true',
  );
  await expect(page.getByRole('link', { name: /Website/ })).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  );
  await expect(page.locator('body')).toHaveJSProperty(
    'scrollWidth',
    await page.evaluate(() => window.innerWidth),
  );
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-results.png`,
    fullPage: true,
  });
  const searchRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/')) searchRequests.push(request.url());
  });
  await page.getByRole('button', { name: 'Français' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(
    page.getByRole('heading', { name: 'Votre point de rencontre.' }),
  ).toBeVisible();
  await expect(page.getByText('En savoir plus')).toBeVisible();
  await expect(page.locator('.map-marker.restaurant').first()).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Zoom avant' })).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty(
    'scrollWidth',
    await page.evaluate(() => window.innerWidth),
  );
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-results-fr.png`,
    fullPage: true,
  });
  expect(searchRequests).toHaveLength(0);
  await page.getByRole('button', { name: 'Modifier les adresses' }).click();
  await expect(
    page.getByRole('textbox', { name: 'Nom de la personne 1' }),
  ).toHaveValue('Personne 1');
  await expect(page.getByRole('combobox').first()).toHaveValue(
    mockAddresses[0].label,
  );
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-ready-fr.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('combobox')).toHaveCount(3);
  await page.getByRole('combobox').first().fill('Changed');
  await expect(
    page.getByRole('button', { name: /Find a fair table/ }),
  ).toBeDisabled();
});
test('routing fallback uses kilometres with no invented travel times', async ({
  page,
}) => {
  await page.route('**/api/meetings/search', (route) =>
    route.fulfill({
      json: {
        searchCenter: { lat: 48.86, lon: 2.35 },
        metricSource: 'geodesic',
        restaurants: results.slice(0, 1).map((r) => ({
          ...r,
          journeys: r.journeys.map(({ participantId, distanceMeters }) => ({
            participantId,
            distanceMeters,
          })),
        })),
        radiusMeters: 5000,
        candidateCount: 1,
        synthetic: true,
        warning: 'All comparisons use straight-line distance.',
      },
    }),
  );
  await page.goto('/?lang=en');
  for (const i of [0, 1]) {
    await page.getByRole('combobox').nth(i).fill('Paris');
    await page.getByRole('option').nth(i).click();
  }
  await page.getByRole('button', { name: /Find a fair table/ }).click();
  await expect(page.getByRole('status')).toContainText('straight-line');
  await expect(page.locator('.restaurant-card')).not.toContainText(' min');
});
