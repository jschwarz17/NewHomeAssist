"use client";

import { useCallback, useRef, useState } from "react";
import { LockScreenOverlay } from "./LockScreenOverlay";

const PULL_DOWN_THRESHOLD = 50;

export function HomeTitleWithLock() {
  const [lockVisible, setLockVisible] = useState(false);
  const startY = useRef(0);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    startY.current = e.clientY;
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.buttons !== 1) return; // only when primary button held (mouse)
      const deltaY = e.clientY - startY.current;
      if (deltaY > PULL_DOWN_THRESHOLD) {
        setLockVisible(true);
      }
    },
    []
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const deltaY = e.touches[0].clientY - startY.current;
    if (deltaY > PULL_DOWN_THRESHOLD) {
      setLockVisible(true);
    }
  }, []);

  return (
    <>
      <div
        className="touch-manipulation cursor-grab active:cursor-grabbing select-none py-1"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        role="button"
        tabIndex={0}
        aria-label="Drag down to show lock screen"
      >
        <h1 className="text-3xl font-extralight tracking-tight text-center mb-3">
          Casa de los Schwarzes
        </h1>
      </div>
      <LockScreenOverlay
        visible={lockVisible}
        onClose={() => setLockVisible(false)}
      />
    </>
  );
}
