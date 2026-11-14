import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Existence checks must finish before streaming to preserve HTTP 404s.
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
