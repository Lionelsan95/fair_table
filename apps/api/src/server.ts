import { buildApp } from './app.js';
import { config } from './config.js';
const app = buildApp(undefined, true);
await app.listen({ host: '0.0.0.0', port: config.PORT });
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
