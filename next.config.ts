import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

// What the browser may load and do on every page (Ressources/security-codebase-plan.md).
// The content policy is only reported for now, so it cannot break a page
// before it has been watched in use; the other headers are enforced.
const contentPolicy = [
  "default-src 'self'",
  // Next.js and the theme script run inline scripts.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // Profile pictures are data URLs.
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // No page of the app may be shown inside another site's frame.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy-Report-Only', value: contentPolicy },
];

const nextConfig: NextConfig = {
  experimental: {
    // Detects a lost connection (even when the device says it is online),
    // keeps navigations and form submissions waiting, and retries them when
    // it comes back. Read in the app with useOffline() from "next/offline".
    useOffline: true,
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async rewrites() {
    // The service worker is built from app/sw.ts and served under /serwist;
    // it keeps the address /sw.js, which existing push subscriptions use.
    return [{ source: '/sw.js', destination: '/serwist/sw.js' }];
  },
};

export default withSerwist(nextConfig);
