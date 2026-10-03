import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { I18nProvider } from './i18n/I18nProvider';
import * as api from './api';
import type { SearchResponse } from '@fairtable/domain';
vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return {
    ...actual,
    health: vi.fn(),
    autocomplete: vi.fn(),
    searchMeeting: vi.fn(),
  };
});
vi.mock('./components/MeetingMap', () => ({
  default: () => <div>Map equivalent</div>,
}));
const response: SearchResponse = {
  searchCenter: { lat: 48.86, lon: 2.35 },
  metricSource: 'routing',
  radiusMeters: 2000,
  candidateCount: 1,
  synthetic: true,
  restaurants: [
    {
      rank: 1,
      restaurant: {
        id: 'r1',
        name: 'Test Bistro',
        coordinate: { lat: 48.86, lon: 2.35 },
        cuisine: [],
        dietaryOptions: [],
        source: 'synthetic',
        website: 'https://example.org',
      },
      fairnessScore: 95,
      statistics: {
        min: 600,
        max: 660,
        mean: 630,
        spread: 60,
        standardDeviation: 30,
      },
      journeys: [
        { participantId: 'p1', distanceMeters: 2000, durationSeconds: 600 },
        { participantId: 'p2', distanceMeters: 2200, durationSeconds: 660 },
      ],
    },
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState(null, '', '/');
  vi.mocked(api.health).mockResolvedValue({ status: 'ok', synthetic: true });
  vi.mocked(api.autocomplete).mockResolvedValue([
    { label: 'Paris address', coordinate: { lat: 48.86, lon: 2.35 } },
  ]);
  vi.mocked(api.searchMeeting).mockResolvedValue(response);
});
function setup() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <I18nProvider initialLocale="en">
        <App />
      </I18nProvider>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}
async function fill(user: ReturnType<typeof userEvent.setup>) {
  for (const input of screen.getAllByRole('combobox')) {
    await user.type(input, 'Paris');
    await user.click(await screen.findByRole('option'));
  }
}
it('switches 2 to 5 participants, preserves names and disables incomplete search', async () => {
  const user = setup();
  expect(screen.getAllByRole('combobox')).toHaveLength(2);
  await user.click(screen.getByRole('button', { name: '5 people' }));
  expect(screen.getAllByRole('combobox')).toHaveLength(5);
  expect(
    screen.getByRole('button', { name: /Find a fair table/ }),
  ).toBeDisabled();
});
it('supports keyboard autocomplete and invalidates edited coordinates', async () => {
  const user = setup();
  const inputs = screen.getAllByRole('combobox');
  await user.type(inputs[0], 'Paris');
  await screen.findByRole('option');
  await user.keyboard('{ArrowDown}{Enter}');
  expect(screen.getByText('Selected')).toBeVisible();
  await user.type(inputs[1], 'Paris');
  await user.click(await screen.findByRole('option'));
  expect(
    screen.getByRole('button', { name: /Find a fair table/ }),
  ).toBeEnabled();
  await user.type(inputs[0], 'x');
  expect(
    screen.getByRole('button', { name: /Find a fair table/ }),
  ).toBeDisabled();
  expect(screen.getAllByText('Selected')).toHaveLength(1);
});
it('renders results and opens safe details on card selection', async () => {
  const user = setup();
  await fill(user);
  await user.click(screen.getByRole('button', { name: /Find a fair table/ }));
  const card = await screen.findByRole('button', {
    name: /Select restaurant 1/,
  });
  expect(screen.getByText('Cuisine not specified')).toBeVisible();
  await user.click(card);
  expect(screen.getByText('A closer look')).toBeVisible();
  expect(screen.getByRole('link', { name: /Website/ })).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  );
  expect(screen.getByText('Maximum difference')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Edit locations' }));
  expect(screen.getAllByRole('combobox')).toHaveLength(2);
});
it('shows meaningful loading and empty states', async () => {
  let resolve!: (r: SearchResponse) => void;
  vi.mocked(api.searchMeeting).mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const user = setup();
  await fill(user);
  await user.click(screen.getByRole('button', { name: /Find a fair table/ }));
  expect(screen.getByRole('status')).toHaveTextContent('Locating meeting area');
  await user.click(screen.getByRole('button', { name: 'Français' }));
  expect(screen.getByRole('status')).toHaveTextContent(
    'Repérage du point de rencontre',
  );
  resolve({ ...response, restaurants: [] });
  expect(await screen.findByText('Un peu plus loin ?')).toBeVisible();
  expect(
    screen.getByRole('button', { name: /Changer les adresses/ }),
  ).toBeVisible();
  expect(api.searchMeeting).toHaveBeenCalledTimes(1);
});
it('handles search provider errors and retries', async () => {
  vi.mocked(api.searchMeeting).mockRejectedValueOnce(
    new Error('Restaurant search is temporarily unavailable.'),
  );
  const user = setup();
  await fill(user);
  await user.click(screen.getByRole('button', { name: /Find a fair table/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'temporarily unavailable',
  );
  await user.click(screen.getByRole('button', { name: /Try again/ }));
  expect(await screen.findByText('Test Bistro')).toBeVisible();
});
it('shows autocomplete errors, retries, and debounces input', async () => {
  vi.mocked(api.autocomplete).mockRejectedValueOnce(new Error('Unavailable'));
  const user = setup();
  await user.type(screen.getAllByRole('combobox')[0], 'Paris');
  expect(
    await screen.findByText('Suggestions unavailable. Please try again.'),
  ).toBeVisible();
  expect(api.autocomplete).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(api.autocomplete).toHaveBeenCalledTimes(2));
});
it('switches language without losing names, coordinates, results or selection', async () => {
  const user = setup();
  const name = screen.getByRole('textbox', { name: 'Name for person 1' });
  await user.clear(name);
  await user.type(name, 'Alice');
  await fill(user);
  await user.click(screen.getByRole('button', { name: 'Français' }));
  expect(
    screen.getByRole('textbox', { name: 'Nom de la personne 1' }),
  ).toHaveValue('Alice');
  expect(
    screen.getByRole('textbox', { name: 'Nom de la personne 2' }),
  ).toHaveValue('Personne 2');
  expect(
    screen.getByRole('combobox', { name: 'Adresse de la personne 1' }),
  ).toHaveValue('Paris address');
  await user.click(screen.getByRole('button', { name: /Trouver notre table/ }));
  await user.click(
    await screen.findByRole('button', { name: /Choisir le restaurant 1/ }),
  );
  expect(screen.getByText('En savoir plus')).toBeVisible();
  expect(screen.getByText(/2,2\s+km par la route/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'English' }));
  expect(
    screen.getByRole('heading', { name: 'Your common ground.' }),
  ).toBeVisible();
  expect(screen.getByText('A closer look')).toBeVisible();
  expect(screen.getByText('Person 2')).toBeVisible();
  expect(api.searchMeeting).toHaveBeenCalledTimes(1);
  expect(api.autocomplete).toHaveBeenCalledTimes(2);
  expect(document.documentElement.lang).toBe('en');
  expect(window.location.search).toBe('?lang=en');
  await user.click(screen.getByRole('button', { name: 'Edit locations' }));
  expect(
    screen.getByRole('textbox', { name: 'Name for person 1' }),
  ).toHaveValue('Alice');
  expect(
    screen.getByRole('button', { name: /Find a fair table/ }),
  ).toBeEnabled();
});
it('translates an existing error immediately without making another request', async () => {
  vi.mocked(api.searchMeeting).mockRejectedValueOnce(
    new api.ApiError('rate_limited'),
  );
  const user = setup();
  await fill(user);
  await user.click(screen.getByRole('button', { name: /Find a fair table/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Too many requests',
  );
  await user.click(screen.getByRole('button', { name: 'Français' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Trop de demandes');
  expect(api.searchMeeting).toHaveBeenCalledTimes(1);
});
