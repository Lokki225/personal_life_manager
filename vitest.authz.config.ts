import path from 'node:path'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// The two-account authorization suite (Ressources/security-codebase-plan.md,
// step 3). It needs a real, non-production database: `npm run test:authz`
// reads DATABASE_URL from .env. Kept out of `npm test`, which needs none.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.authz.ts'],
    env: loadEnv('test', process.cwd(), ''),
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
})
