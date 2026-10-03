import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node24',
  bundle: true,
  noExternal: ['@fairtable/domain'],
  clean: true,
});
