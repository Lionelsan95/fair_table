import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        test: {
          name: 'server',
          include: ['packages/**/*.test.ts', 'apps/api/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'web',
          testTimeout: 15000,
          include: ['apps/web/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['./apps/web/src/test-setup.ts'],
        },
      },
    ],
  },
});
