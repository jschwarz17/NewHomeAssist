import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.jesse.assistant",
  appName: "JesseHomeAssistant",
  webDir: "out", // Points to the Next.js static export folder
  server: {
    androidScheme: "https", // Allows Mic/WASM in WebView
    cleartext: true, // Allows HTTP connection to laptop for Live Reload
  },
};

export default config;
