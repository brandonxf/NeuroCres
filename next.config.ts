import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Los comprobantes de pago pueden pesar hasta 5 MB (más lo que suma multipart).
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
