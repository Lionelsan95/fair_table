import { z } from 'zod';
const env = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    WEB_ORIGIN: z.url().default('http://localhost:5173'),
    GEOPLATFORM_AUTOCOMPLETE_BASE_URL: z
      .url()
      .default('https://data.geopf.fr/geocodage/completion/'),
    GEOPLATFORM_GEOCODING_BASE_URL: z
      .url()
      .default('https://data.geopf.fr/geocodage/search'),
    GEOPLATFORM_ROUTING_BASE_URL: z
      .url()
      .default('https://data.geopf.fr/navigation/itineraire'),
    OVERPASS_API_URL: z
      .url()
      .default('https://overpass-api.de/api/interpreter'),
    USE_MOCK_PROVIDERS: z.enum(['true', 'false']).default('false'),
    SHORTLIST_SIZE: z.coerce.number().int().min(5).max(12).default(8),
    FINAL_RADIUS_METERS: z.coerce
      .number()
      .int()
      .min(10000)
      .max(30000)
      .default(15000),
  })
  .parse(process.env);
export const config = {
  ...env,
  radii: [...new Set([2000, 5000, 10000, env.FINAL_RADIUS_METERS])],
  minimumCandidates: 8,
  resultLimit: 5,
};
