import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Detects a lost connection (even when the device says it is online),
    // keeps navigations and form submissions waiting, and retries them when
    // it comes back. Read in the app with useOffline() from "next/offline".
    useOffline: true,
  },
};

export default nextConfig;
