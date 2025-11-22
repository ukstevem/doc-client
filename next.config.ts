// next.config.ts

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Force webpack dev middleware to use polling.
  // This helps hot reload work reliably inside Docker volumes.
  webpackDevMiddleware: (config) => {
    config.watchOptions = {
      poll: 1000,          // check for changes every 1s
      aggregateTimeout: 300,
    };
    return config;
  },
};

export default nextConfig;
