import type { NextConfig } from "next";

/** Static export only for Capacitor (Android). On Vercel we never export so API routes and pages are deployed. */
const isVercel = process.env.VERCEL === "1";
const buildForCapacitor = !isVercel && process.env.BUILD_FOR_CAPACITOR === "1";

const nextConfig: NextConfig = {
  ...(buildForCapacitor && { output: "export" as const }),
  images: {
    unoptimized: true, // Essential for Android WebViews
  },
  trailingSlash: true, // Ensures consistent routing on Android
};

export default nextConfig;
