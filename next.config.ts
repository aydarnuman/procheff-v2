import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // Configure API body size limit for file uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '30mb',
    },
  },

  // Turbopack config (empty to suppress warnings)
  turbopack: {},
};

export default nextConfig;
