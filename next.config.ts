import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export", // Required for Capacitor to run locally on the tablet
  images: {
    unoptimized: true, // Essential for Android WebViews
  },
  trailingSlash: true, // Ensures consistent routing on Android
};

export default nextConfig;
