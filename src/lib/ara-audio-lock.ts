/**
 * Global singleton mutex for Ara voice output.
 * Ensures only one Ara voice session (Grok realtime or read-aloud) plays at a time.
 */

let activeStop: (() => void) | null = null;

export function acquireAraVoice(stop: () => void): void {
  if (activeStop && activeStop !== stop) {
    activeStop();
  }
  activeStop = stop;
}

export function releaseAraVoice(stop: () => void): void {
  if (activeStop === stop) {
    activeStop = null;
  }
}

export function stopActiveAraVoice(): void {
  if (activeStop) {
    activeStop();
    activeStop = null;
  }
}
