import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "1024mb",
    },
  },
  // GramJS (telegram) is Node-only — keep out of Turbopack client graph
  serverExternalPackages: ["telegram", "big-integer", "websocket", "bufferutil", "utf-8-validate"],
};

export default nextConfig;
