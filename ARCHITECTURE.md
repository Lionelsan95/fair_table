# Architecture

## Boundaries

`packages/domain` depends only on Zod. It exports coordinates, participant/restaurant/travel types, REST request/response schemas, Haversine distance, statistics, the meeting-center solver, safe website parsing and ranking. It has no knowledge of HTTP, React, MapLibre, OSM tags or IGN payloads.

`apps/api` owns external-service adapters and orchestration. `GeocodingProvider`, `RestaurantProvider` and `RoutingProvider` are the three swappable ports. Adapters return domain models; raw upstream payloads never cross the API boundary. Configuration and validation are centralized in `src/config.ts`. `GEOPLATFORM_GEOCODING_BASE_URL` is reserved for future explicit forward geocoding; autocomplete already returns coordinates, so the MVP avoids an unnecessary second geocoding request.

`apps/web` uses shared response schemas to validate the backend contract. Local React state owns the form and selected restaurant. TanStack Query owns search lifecycle and health state without persistence; query/mutation garbage collection is immediate once inactive. Address fields handle debounce, AbortController, stale-response guards and accessible listbox navigation. A selected address is a coordinate-bearing suggestion, never arbitrary text. Simple controlled state keeps the small dynamic form explicit; React Hook Form was not needed here.

The Base UI `Button` follows shadcn’s owned-source component pattern, with `components.json`, CVA variants, Tailwind v4 tokens and the `cn` utility. Additional components can be installed using that Base UI registry configuration. No Radix dependency is used.

## Request flow

1. After 300 ms without typing, `/api/autocomplete?q=...` validates a 3–200 character query and invokes IGN completion for up to five street-address suggestions.
2. The browser submits 2–5 selected participants to `POST /api/meetings/search`. Shared schemas enforce coordinate bounds, participant counts and unique IDs. Labels are trimmed and bounded.
3. The domain computes a minimax center. The solver enumerates circles supported by one, two or three points in a local equirectangular projection and chooses the center with the smallest maximum radius. Longitude deltas wrap around the date line. This is a regional planar approximation, not a road-network optimum.
4. Overpass searches 2, 5, 10 and optionally 15 km, stopping as soon as at least eight usable candidates exist. Node coordinates and way/relation centers are validated. Queries use `nwr[amenity=restaurant]` with tags and centers. Records are deduplicated by OSM ID and, conservatively, matching name within 30 m. Missing metadata is omitted. Unsafe website protocols are dropped.
5. Haversine metrics rank all candidates cheaply. Only the first eight (configurable) enter the expensive stage.
6. Two orchestration workers request participant-to-restaurant metrics. A shared adapter queue serializes upstream requests and imposes a 300 ms minimum start interval, below the conservative published routing limit. Geocoding and Overpass have their own bounded queues.
7. Rank all shortlisted restaurants using one metric source. Return at most five, including per-person distance/duration, rank, center, radius, candidate count, balance score and descriptive statistics. One or two results are legitimate successes.

## Ranking

For every restaurant compute minimum, maximum, mean, spread and population standard deviation. For a candidate set, divide every component by the same largest journey (a zero denominator becomes one). Twice population standard deviation is bounded by spread, so all components remain on a comparable 0–1 scale. A common scale avoids exaggerating a tiny difference between two already balanced options.

```text
cost = 0.7 × (normalizedSpread + 2 × normalizedDeviation) / 2
     + 0.3 × normalizedLongestJourney
```

Lower cost is better. Ties use the shortest worst trip, then stable ID. This avoids optimizing only the mean or rewarding a location very close to one participant while ignoring another. Equal balance still favours the shorter worst journey. The displayed balance score uses a separate, easy-to-explain relative-spread formula documented in README. The shared normalization factor preserves ordering when an unrelated candidate is added. The geometric shortlist remains an intentional MVP tradeoff.

The `statistics` response values are **seconds for routing**, **metres for geodesic**. Every journey always has `distanceMeters`; only real routed journeys have `durationSeconds`. `metricSource` is required and applies to the entire response. This prevents cross-unit ranking and misleading display.

## Failure and cancellation

External fetches use bounded timeouts and abort propagation. Transient network/timeout, 429 and 5xx failures get at most one retry with a 500 ms exponential-backoff base. `Retry-After` is respected up to three seconds; longer values fail fast without retrying. Every retry re-enters the provider limiter. Invalid JSON/schema responses are rejected without retries. An Overpass `remark` is treated as an incomplete response, not silently accepted as complete.

A routing failure stops scheduling further work. All candidates fall back to straight-line metrics, preserving comparable units and retaining restaurants with unavailable routes. A 30-second route-stage deadline prevents a long queue from hanging the UI. Restaurant discovery failure returns a sanitized 503; it cannot invent restaurant candidates. A total 110-second request deadline bounds radius expansion. Client disconnect aborts upstream work. Global search concurrency and per-IP request limits protect public services.

The frontend displays preparation stages without percentages or invented provider counts; the REST response is atomic, so these are explicitly not backend telemetry. Failed searches retain locations and offer retry. Map failure leaves all list functionality usable. Network error strings and upstream URLs are never logged.

## Map and responsive composition

MapLibre loads as a separate lazy chunk. One instance is created per mount and removed on unmount. Marker updates do not recreate the map. A ResizeObserver handles layout changes; selections use a callback ref. Participant letters derive from stable IDs even when only B or C has been selected. Results fit all markers inside the actual map panel, which sits beside rather than behind the desktop sidebar; padding therefore does not double-count the sidebar width.

Restaurant cards and marker buttons share one selected ID. Marker activation scrolls the matching card into view; card focus/activation selects the marker and eases the camera. Expanded cards contain details without forcing map-only interaction. At 700 px and below the DOM is visually composed as compact header, 43vh results map and a fixed-layout bottom results sheet with expandable detail cards. Initial mobile form remains above the map. Motion is disabled for reduced-motion preferences.

## Replacing providers

Implement the relevant interface under `apps/api/src/providers`, validate upstream data, and inject it through `buildApp` (as tests and mock mode do). Domain ranking and REST consumers need no changes. Configure public endpoint URLs via environment settings for compatible/self-hosted implementations. Change `VITE_MAP_STYLE_URL` at frontend build time to use a different MapLibre style; preserve all required source attribution.

## Deployment and testing

The API is bundled with tsup; the domain is bundled into it. The production image includes only deployed runtime dependencies and runs as `node`. The web is static Vite output served by unprivileged Nginx. The API is private to Compose’s network. Neither service persists user data.

Vitest covers geometry edge cases, fairness-vs-mean behavior, provider normalization, retry/timeout/cancellation, fallback units, adaptive discovery and request validation through Fastify inject. React Testing Library covers autocomplete, form validity, participant counts, loading, results, details, retries and empty states. Playwright covers the complete three-person flow, real MapLibre marker DOM with a deterministic style, selection in both directions and geometric fallback on desktop/mobile/tablet. External services are deliberately not a dependency of automated tests.

## Internationalization and safe evolution

`i18n/config.ts` is the locale registry and preference resolver. `en.ts` defines the message shape; `fr.ts` must satisfy that same TypeScript contract, including interpolation signatures. Catalog functions handle small, explicit plural variants. `I18nProvider` owns only locale selection, document language/title/description and memoized Intl formatters. It does not own meeting data or trigger API requests. To add a language, implement the catalog and add its code/label/Intl identifier to the registry. Consider an ICU library only when message complexity or translator tooling justifies it.

`useMeeting` owns ephemeral participants, validation, mutation state, results and selection. `App` composes the form, progress, results and map. Default participant labels are derived at presentation time; user-supplied labels and geocoded addresses are retained. Locale changes do not clear inputs, re-run searches or reconstruct the MapLibre instance. Marker labels are refreshed without refitting the map when coordinates are unchanged.

The API returns stable `ApiErrorCode` values defined by the shared domain contract. The web request boundary validates them and falls back safely for old, malformed or non-JSON error responses. Human-facing error copy belongs to each catalog, never upstream messages. API metrics remain metres/seconds; `Intl.NumberFormat` and `Intl.ListFormat` format their presentation. Raw names, addresses, opening-hours expressions and unknown provider metadata are preserved. Missing restaurant names are represented by an empty string and receive a localized fallback in the UI.

Locale preference precedence is URL, supported browser language, then configured fallback (`VITE_DEFAULT_LOCALE`, French by default). Only the language code is written to the URL. No meeting information is placed in browser storage. Presentation configuration, search limits and provider endpoints remain in their existing web/API configuration modules; avoid introducing a universal configuration engine until a concrete use case requires one.

Tests cover locale precedence, formatting, catalog completeness, localized API errors, preserved form/results/selection and both languages across desktop, tablet and mobile browser flows.
