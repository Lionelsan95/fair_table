import Fastify, { LogController } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import { searchRequestSchema } from '@fairtable/domain';
import { config } from './config.js';
import { GeoPlatformGeocodingProvider } from './providers/geocoding/geoplateforme-geocoding-provider.js';
import { GeoPlatformRoutingProvider } from './providers/routing/geoplateforme-routing-provider.js';
import { OverpassRestaurantProvider } from './providers/restaurants/overpass-restaurant-provider.js';
import { mockProviders } from './providers/mock.js';
import { searchMeeting } from './search.js';
export function buildApp(
  providers = config.USE_MOCK_PROVIDERS === 'true'
    ? mockProviders()
    : {
        geocoding: new GeoPlatformGeocodingProvider(
          config.GEOPLATFORM_AUTOCOMPLETE_BASE_URL,
        ),
        restaurants: new OverpassRestaurantProvider(config.OVERPASS_API_URL),
        routing: new GeoPlatformRoutingProvider(
          config.GEOPLATFORM_ROUTING_BASE_URL,
        ),
      },
  logging = false,
) {
  const app = Fastify({
    logger: logging,
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: 16384,
  });
  let activeSearches = 0;
  app.register(cors, { origin: config.WEB_ORIGIN });
  app.register(rateLimit, { max: 80, timeWindow: '1 minute' });
  app.addHook('onSend', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
  });
  app.setErrorHandler((error, _req, reply) => {
    const code = z.object({ statusCode: z.number() }).safeParse(error);
    const status =
      code.success && code.data.statusCode === 429
        ? 429
        : code.success && code.data.statusCode === 400
          ? 400
          : 503;
    reply.code(status).send({
      code:
        status === 429
          ? 'rate_limited'
          : status === 400
            ? 'invalid_request'
            : 'service_unavailable',
      message:
        status === 429
          ? 'Too many requests. Please wait a moment.'
          : status === 400
            ? 'Invalid request.'
            : 'This service is temporarily unavailable. Please try again.',
    });
  });
  app.get('/api/health', async () => ({
    status: 'ok',
    synthetic: config.USE_MOCK_PROVIDERS === 'true',
  }));
  app.get('/api/autocomplete', async (req, reply) => {
    const parsed = z
      .object({ q: z.string().trim().min(3).max(200) })
      .safeParse(req.query);
    if (!parsed.success)
      return reply.code(400).send({
        code: 'invalid_request',
        message: 'Enter at least 3 characters.',
      });
    const controller = new AbortController();
    req.raw.on('aborted', () => controller.abort());
    reply.raw.on('close', () => {
      if (!reply.raw.writableEnded) controller.abort();
    });
    try {
      return {
        suggestions: await providers.geocoding.autocomplete(
          parsed.data.q,
          controller.signal,
        ),
      };
    } catch {
      return reply.code(503).send({
        code: 'geocoding_unavailable',
        message:
          'Address suggestions are temporarily unavailable. Please try again.',
      });
    }
  });
  app.post(
    '/api/meetings/search',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const parsed = searchRequestSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.code(400).send({
          code: 'invalid_request',
          message:
            'Choose 2 to 5 participants with unique IDs and valid locations.',
        });
      if (activeSearches >= 2)
        return reply.code(503).send({
          code: 'service_busy',
          message: 'We are comparing other journeys. Please try again shortly.',
        });
      const controller = new AbortController();
      reply.raw.on('close', () => {
        if (!reply.raw.writableEnded) controller.abort();
      });
      const signal = AbortSignal.any([
        controller.signal,
        AbortSignal.timeout(110000),
      ]);
      activeSearches++;
      const start = Date.now();
      try {
        const result = await searchMeeting(parsed.data, providers, signal, {
          radii: config.radii,
          minimumCandidates:
            config.USE_MOCK_PROVIDERS === 'true' ? 5 : config.minimumCandidates,
          shortlistSize: config.SHORTLIST_SIZE,
          resultLimit: config.resultLimit,
          synthetic: config.USE_MOCK_PROVIDERS === 'true',
        });
        app.log.info(
          {
            requestId: req.id,
            participantCount: parsed.data.participants.length,
            latencyMs: Date.now() - start,
            resultCount: result.restaurants.length,
            status: 'ok',
          },
          'Meeting search completed',
        );
        return result;
      } catch {
        app.log.warn(
          {
            requestId: req.id,
            latencyMs: Date.now() - start,
            status: 'unavailable',
          },
          'Meeting search failed',
        );
        return reply.code(503).send({
          code: 'restaurants_unavailable',
          message:
            'Restaurant search is temporarily unavailable. Please try again.',
        });
      } finally {
        activeSearches--;
      }
    },
  );
  return app;
}
