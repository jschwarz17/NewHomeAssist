"use client";

import { useCallback, useEffect, useState } from "react";
import {
  enrollSpeaker,
  getEnrolledSpeakers,
  isEagleAvailable,
  type EagleEnrolledSpeakers,
} from "@/lib/eagle";

type SpeakerId = "jesse" | "vanessa";

export function EagleEnrollSection() {
  const [available, setAvailable] = useState(false);
  const [enrolled, setEnrolled] = useState<EagleEnrolledSpeakers>({ jesse: false, vanessa: false });
  const [loading, setLoading] = useState<SpeakerId | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const ok = await isEagleAvailable();
    setAvailable(ok);
    if (ok) {
      const e = await getEnrolledSpeakers();
      setEnrolled(e);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const accessKey = typeof window !== "undefined" ? process.env.NEXT_PUBLIC_PICOVOICE_API_KEY ?? "" : "";

  const onEnroll = useCallback(
    async (speakerId: SpeakerId) => {
      if (!accessKey) {
        setMessage("Add NEXT_PUBLIC_PICOVOICE_API_KEY to your env.");
        return;
      }
      setLoading(speakerId);
      setMessage(null);
      const result = await enrollSpeaker(speakerId, accessKey);
      setLoading(null);
      if (result.success) {
        setMessage(`${speakerId === "jesse" ? "Jesse" : "Vanessa"} enrolled.`);
        await refresh();
      } else {
        setMessage(result.error ?? "Enrollment failed.");
      }
    },
    [accessKey, refresh]
  );

  if (!available) {
    return (
      <section className="mt-8">
        <h2 className="text-sm font-medium text-zinc-300">Voice ID (Eagle)</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Eagle speaker recognition is only available in the Android app. Open the app on your
          tablet to enroll.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-zinc-300">Voice ID (Eagle)</h2>
      <p className="text-sm text-zinc-500 mt-1">
        Enroll each speaker once. Speak for a few seconds in a quiet room. Both must be enrolled for
        recognition.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">Jesse:</span>
          {enrolled.jesse ? (
            <span className="text-xs text-emerald-500">enrolled</span>
          ) : (
            <button
              type="button"
              onClick={() => onEnroll("jesse")}
              disabled={!!loading}
              className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {loading === "jesse" ? "Speaking…" : "Enroll Jesse"}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">Vanessa:</span>
          {enrolled.vanessa ? (
            <span className="text-xs text-emerald-500">enrolled</span>
          ) : (
            <button
              type="button"
              onClick={() => onEnroll("vanessa")}
              disabled={!!loading}
              className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {loading === "vanessa" ? "Speaking…" : "Enroll Vanessa"}
            </button>
          )}
        </div>
      </div>
      {message && (
        <p className={`mt-2 text-sm ${message.startsWith("Add ") ? "text-amber-500" : "text-zinc-400"}`}>
          {message}
        </p>
      )}
    </section>
  );
}
