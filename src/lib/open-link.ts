/**
 * Open a URL in the system browser on Android/iOS (Capacitor), or in a new tab on web.
 * Use this for widget links so they work in the WebView on device.
 */
export async function openLink(url: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform: () => boolean } }).Capacitor;
    if (cap?.isNativePlatform?.()) {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url });
      return;
    }
  } catch {
    // fallback
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
