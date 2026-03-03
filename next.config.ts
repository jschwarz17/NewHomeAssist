import type { NextConfig } from "next";

/** Set BUILD_FOR_CAPACITOR=1 when building the static export for Android (out/). Leave unset for Vercel so API routes are deployed. */
const buildForCapacitor = process.env.BUILD_FOR_CAPACITOR === "1";

const nextConfig: NextConfig = {
  ...(buildForCapacitor && { output: "export" }),
  images: {
    unoptimized: true, // Essential for Android WebViews
  },
  trailingSlash: true, // Ensures consistent routing on Android
};

export default nextConfig;
