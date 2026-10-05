import { createSerwistRoute } from '@serwist/turbopack'

// Builds and serves the service worker from app/sw.ts. The app registers it
// as /sw.js (a rewrite in next.config.ts), the address push subscriptions use.
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: 'app/sw.ts',
  // The offline page is kept from the start, to be shown when a page cannot load.
  additionalPrecacheEntries: [{ url: '/offline', revision: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev' }],
  useNativeEsbuild: true,
})
