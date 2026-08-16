import dotenv from 'dotenv';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

// Vite only exposes VITE_-prefixed variables, so .env is loaded here explicitly
// to pick up TEST_DATABASE_URL.
dotenv.config();

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.spec.ts'],
    setupFiles: ['./tests/setup.ts'],
    /**
     * Set here rather than at the top of tests/setup.ts. ES module imports are
     * hoisted and evaluated before the importing module's own body, so an
     * assignment in setup.ts would land *after* src/config/env.config.ts had
     * already read process.env. Vitest applies these before anything loads.
     */
    env: {
      NODE_ENV: 'test',
      JWT_ACCESS_SECRET: 'toolbeam_test_access_secret',
      JWT_ACCESS_EXPIRES_IN: '1h',
      ENABLE_DOCS: 'false',
      ...(process.env.TEST_DATABASE_URL && {
        TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
      }),
    },
    // Every spec talks to the same database and clears collections between
    // tests — running files in parallel would race on that shared state.
    fileParallelism: false,
    // Generous: covers a first-run mongodb-memory-server binary download.
    hookTimeout: 900_000,
    testTimeout: 30_000,
  },
});
