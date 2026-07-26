import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "1024mb",
    },
    // Middleware/proxy clones request bodies (default 10MB). Large Drive uploads
    // are excluded from middleware matcher; this is a safety net if matched.
    proxyClientMaxBodySize: "1024mb",
  },
  // GramJS must stay external so Session classes keep correct identity
  serverExternalPackages: [
    "telegram",
    "big-integer",
    "websocket",
    "bufferutil",
    "utf-8-validate",
    "store2",
    "input",
    "mime",
    "pako",
    "socks",
    "htmlparser2",
  ],
};

export default nextConfig;
