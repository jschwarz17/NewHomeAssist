"use client";

import { useCallback, useRef } from "react";

const SWIPE_UP_THRESHOLD = 50;

interface LockScreenOverlayProps {
  visible: boolean;
  onClose: () => void;
}

export function LockScreenOverlay({ visible, onClose }: LockScreenOverlayProps) {
  const touchStartY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const currentY = e.touches[0].clientY;
      const deltaY = touchStartY.current - currentY;
      if (deltaY > SWIPE_UP_THRESHOLD) {
        onClose();
      }
    },
    [onClose]
  );

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center touch-none select-none"
      style={{ touchAction: "pan-y", backgroundColor: "#0a0a0a" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      <div className="flex-1 flex items-center justify-center w-full px-6">
        <img
          src="/casade-lock.png"
          alt="CasaDe.ai"
          className="max-w-[85vw] max-h-[60vh] w-auto h-auto object-contain"
        />
      </div>
      <p className="text-zinc-500 text-sm pb-12">Swipe up to return</p>
    </div>
  );
}
