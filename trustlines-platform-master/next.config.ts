import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root: an empty package-lock.json in the parent
    // Trust-ERP folder otherwise makes Turbopack treat that as the root,
    // which breaks client-manifest resolution (e.g. sonner's Toaster).
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
