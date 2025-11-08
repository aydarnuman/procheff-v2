import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // ❌ React Compiler KAPALI
  // reactCompiler: true,

  // ❌ STRICT MODE KAPALI
  reactStrictMode: false,
  
  // ❌ FAST REFRESH TAMAMEN KAPALI - Development experience kötü ama stable
  ...(process.env.NODE_ENV === 'development' && {
    experimental: {
      serverActions: {
        bodySizeLimit: '30mb',
      },
    },
  }),
};

export default nextConfig;
