"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSubstack, type SubstackArticle } from "@/context/SubstackContext";
import { useVoice } from "@/context/VoiceProvider";
import { speakWithAraRealtime } from "@/lib/ara-read-aloud";
import { ArticlesSection } from "@/components/substack/ArticlesSection";
import { ArticleModal } from "@/components/substack/ArticleModal";

/** Smaller chunks = faster first response and quicker time-to-first-audio */
const MAX_TTS_CHARS = 50;

function splitTextForAra(text: string): string[] {
  const normalized = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  const paragraphs = normalized.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  let current = "";

  const flushCurrent = () => {
    if (!current.trim()) return;
    chunks.push(current.trim());
    current = "";
  };

  const appendText = (value: string) => {
    const next = current ? `${current}\n\n${value}` : value;
    if (next.length <= MAX_TTS_CHARS) {
      current = next;
      return;
    }

    flushCurrent();

    if (value.length <= MAX_TTS_CHARS) {
      current = value;
      return;
    }

    const sentences = value.split(/(?<=[.!?])\s+/);
    let sentenceChunk = "";

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;

      const nextSentenceChunk = sentenceChunk ? `${sentenceChunk} ${trimmed}` : trimmed;
      if (nextSentenceChunk.length <= MAX_TTS_CHARS) {
        sentenceChunk = nextSentenceChunk;
        continue;
      }

      if (sentenceChunk) {
        chunks.push(sentenceChunk.trim());
      }

      if (trimmed.length <= MAX_TTS_CHARS) {
        sentenceChunk = trimmed;
        continue;
      }

      for (let index = 0; index < trimmed.length; index += MAX_TTS_CHARS) {
        chunks.push(trimmed.slice(index, index + MAX_TTS_CHARS).trim());
      }
      sentenceChunk = "";
    }

    if (sentenceChunk.trim()) {
      current = sentenceChunk.trim();
    }
  };

  for (const paragraph of paragraphs) {
    appendText(paragraph);
  }

  flushCurrent();
  return chunks;
}

function getApiBase(): string {
  if (typeof window === "undefined") return "";
  return (process.env.NEXT_PUBLIC_ASSISTANT_API_URL ?? "").replace(/\/$/, "");
}

interface LoadedArticle {
  title: string | null;
  content: string;
}

export default function SubstackPage() {
  const { ai, politics, fintech, loading, error, refresh } = useSubstack();
  const { getRealtimeToken } = useVoice();
  const [loadingUrl, setLoadingUrl] = useState<string | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState<string | null>(null);
  const [modalArticle, setModalArticle] = useState<SubstackArticle | null>(null);
  const [modalContent, setModalContent] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const articleCacheRef = useRef<Map<string, LoadedArticle>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioBlobUrlRef = useRef<string | null>(null);
  const playbackSessionRef = useRef(0);
  const playbackAbortRef = useRef<AbortController | null>(null);

  const revokeAudioBlobUrl = useCallback(() => {
    if (!audioBlobUrlRef.current) return;
    URL.revokeObjectURL(audioBlobUrlRef.current);
    audioBlobUrlRef.current = null;
  }, []);

  const stopPlayback = useCallback(() => {
    playbackSessionRef.current += 1;
    playbackAbortRef.current?.abort();
    playbackAbortRef.current = null;

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }

    revokeAudioBlobUrl();
    setLoadingUrl(null);
    setPlayingUrl(null);
    setPlaybackStatus(null);
  }, [revokeAudioBlobUrl]);

  const loadArticle = useCallback(async (article: SubstackArticle): Promise<LoadedArticle> => {
    const cached = articleCacheRef.current.get(article.link);
    if (cached) {
      setModalArticle(article);
      setModalContent(cached.content);
      setModalError(null);
      setModalLoading(false);
      return cached;
    }

    setModalArticle(article);
    setModalLoading(true);
    setModalError(null);
    setModalContent("");

    const base = getApiBase();
    const contentUrl = base
      ? `${base}/api/substack/article-content/?url=${encodeURIComponent(article.link)}`
      : `/api/substack/article-content/?url=${encodeURIComponent(article.link)}`;
    const response = await fetch(contentUrl, { cache: "no-store" });

    // #region agent log
    const rawBody = await response.text();
    let data: { title?: string | null; content?: string; error?: string };
    try {
      data = JSON.parse(rawBody) as typeof data;
    } catch (parseErr) {
      const bodyStart = rawBody.trimStart().slice(0, 120);
      fetch("http://127.0.0.1:7941/ingest/682557f1-4c11-46b8-bba1-57fb1f47de33", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "651c00" },
        body: JSON.stringify({
          sessionId: "651c00",
          location: "substack/page.tsx:loadArticle",
          message: "article-content response was not JSON",
          data: { status: response.status, contentType: response.headers.get("content-type"), bodyStart },
          timestamp: Date.now(),
          hypothesisId: "A",
        }),
      }).catch(() => {});
      throw new Error("Could not load the full article.");
    }
    // #endregion

    if (!response.ok) {
      throw new Error(data.error || "Could not load the full article.");
    }

    const content = String(data.content ?? "").trim();
    if (!content) {
      throw new Error("No article text was extracted.");
    }

    const loaded: LoadedArticle = {
      title: data.title ?? null,
      content,
    };

    articleCacheRef.current.set(article.link, loaded);
    setModalContent(loaded.content);
    setModalLoading(false);
    setModalError(null);
    return loaded;
  }, []);

  const waitForAudioToFinish = useCallback((audio: HTMLAudioElement) => {
    return new Promise<void>((resolve, reject) => {
      let timeoutId: number | null = null;

      const cleanup = () => {
        audio.removeEventListener("ended", handleEnded);
        audio.removeEventListener("error", handleError);
        audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };

      const MAX_WAIT_MS = 10 * 60 * 1000;
      const scheduleFallbackTimeout = (ms: number) => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        timeoutId = window.setTimeout(() => {
          cleanup();
          resolve();
        }, Math.min(ms, MAX_WAIT_MS));
      };

      const handleEnded = () => {
        cleanup();
        resolve();
      };

      const handleError = () => {
        cleanup();
        reject(new Error("Audio playback failed."));
      };

      const handleLoadedMetadata = () => {
        const durationSec = audio.duration;
        if (Number.isFinite(durationSec) && durationSec > 0) {
          scheduleFallbackTimeout(Math.ceil(durationSec * 1000) + 2000);
        } else {
          scheduleFallbackTimeout(5 * 60 * 1000);
        }
      };

      audio.addEventListener("ended", handleEnded);
      audio.addEventListener("error", handleError);
      if (audio.readyState >= 1) {
        handleLoadedMetadata();
      } else {
        audio.addEventListener("loadedmetadata", handleLoadedMetadata);
        scheduleFallbackTimeout(MAX_WAIT_MS);
      }
    });
  }, []);

  const handleOpenArticle = useCallback(
    async (article: SubstackArticle) => {
      try {
        await loadArticle(article);
      } catch (err) {
        setModalLoading(false);
        setModalError(err instanceof Error ? err.message : "Could not load the full article.");
      }
    },
    [loadArticle]
  );

  const handlePlay = useCallback(
    async (article: SubstackArticle) => {
      if (playingUrl === article.link) {
        stopPlayback();
        return;
      }

      setLoadingUrl(article.link);
      setModalError(null);

      try {
        const loaded = await loadArticle(article);
        stopPlayback();

        const sessionId = playbackSessionRef.current;
        const audio = audioRef.current ?? new Audio();
        audioRef.current = audio;
        audio.preload = "auto";
        audio.volume = 1;

        const chunks = splitTextForAra(
          `${loaded.title || article.title}. ${loaded.content}`
        );

        if (chunks.length === 0) {
          throw new Error("No article text is available for Ara to read.");
        }

        setPlayingUrl(article.link);

        const controller = new AbortController();
        playbackAbortRef.current = controller;

        let usedAraRealtime = false;
        try {
          const tokenResult = await getRealtimeToken();
          if (tokenResult.token && playbackSessionRef.current === sessionId) {
            setPlaybackStatus("Ara is reading…");
            setLoadingUrl(null);
            await speakWithAraRealtime({
              token: tokenResult.token,
              chunks,
              onChunkStart: (index, total) => {
                if (playbackSessionRef.current === sessionId) {
                  setPlaybackStatus(`Ara is reading part ${index + 1} of ${total}`);
                }
              },
              signal: controller.signal,
            });
            usedAraRealtime = true;
          }
        } catch (realtimeErr) {
          if (realtimeErr instanceof DOMException && realtimeErr.name === "AbortError") {
            throw realtimeErr;
          }
          // Fall through to article-audio API
        }

        if (!usedAraRealtime && playbackSessionRef.current === sessionId) {
          const base = getApiBase();
          const audioApiUrl = base ? `${base}/api/substack/article-audio/` : "/api/substack/article-audio/";
          for (let index = 0; index < chunks.length; index += 1) {
            if (playbackSessionRef.current !== sessionId) break;

            setPlaybackStatus(`Ara is reading part ${index + 1} of ${chunks.length}`);

            try {
              const response = await fetch(audioApiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: chunks[index] }),
              signal: controller.signal,
              });

              const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
              if (!response.ok) {
                const errorBody = await response.text();
                let errData: { error?: string } = {};
                try {
                  if (errorBody.trimStart().startsWith("{")) errData = JSON.parse(errorBody) as { error?: string };
                } catch {
                  // non-JSON error body
                }
                throw new Error(errData.error || "Ara voice is unavailable.");
              }

              if (!contentType.includes("audio")) {
                throw new Error("Ara voice returned an invalid audio response.");
              }

              const audioBlob = await response.blob();
              if (!audioBlob.size) throw new Error("Ara voice returned empty audio.");
              if (playbackSessionRef.current !== sessionId) break;

              revokeAudioBlobUrl();
              audioBlobUrlRef.current = URL.createObjectURL(audioBlob);
              audio.src = audioBlobUrlRef.current;
              setLoadingUrl(null);
              await audio.play();
              await waitForAudioToFinish(audio);
              revokeAudioBlobUrl();
            } catch (chunkError) {
              if (chunkError instanceof DOMException && chunkError.name === "AbortError") throw chunkError;
              setModalError(
                chunkError instanceof Error ? chunkError.message : "Ara voice is unavailable. Try again later."
              );
              break;
            }
          }
        }

        playbackAbortRef.current = null;
        if (playbackSessionRef.current === sessionId) {
          setPlayingUrl(null);
          setPlaybackStatus(null);
          setLoadingUrl(null);
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setModalError(
            err instanceof Error ? err.message : "Ara could not read this article."
          );
        }
        stopPlayback();
      } finally {
        setModalLoading(false);
      }
    },
    [
      getRealtimeToken,
      loadArticle,
      playingUrl,
      revokeAudioBlobUrl,
      stopPlayback,
      waitForAudioToFinish,
    ]
  );

  const handleCloseModal = useCallback(() => {
    if (modalArticle?.link === playingUrl) {
      stopPlayback();
    }
    setModalArticle(null);
    setModalError(null);
    setModalLoading(false);
    setModalContent("");
  }, [modalArticle, playingUrl, stopPlayback]);

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  return (
    <main className="flex-1 bg-black min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {error ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-center">
            <p className="text-zinc-400 text-sm">{error}</p>
            <div className="mt-3">
              <button
                onClick={refresh}
                className="text-xs text-zinc-500 underline hover:text-zinc-400"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            <ArticlesSection
              title="AI Articles"
              articles={ai}
              playingUrl={playingUrl}
              loadingUrl={loadingUrl}
              onPlay={handlePlay}
              onOpenArticle={handleOpenArticle}
              loading={loading}
            />
            <ArticlesSection
              title="Politics Articles"
              articles={politics}
              playingUrl={playingUrl}
              loadingUrl={loadingUrl}
              onPlay={handlePlay}
              onOpenArticle={handleOpenArticle}
              loading={loading}
            />
            <ArticlesSection
              title="Fintech Articles"
              articles={fintech}
              playingUrl={playingUrl}
              loadingUrl={loadingUrl}
              onPlay={handlePlay}
              onOpenArticle={handleOpenArticle}
              loading={loading}
            />
          </>
        )}
      </div>
      <ArticleModal
        article={modalArticle}
        content={modalContent}
        loading={modalLoading}
        error={modalError}
        isReading={playingUrl === modalArticle?.link}
        playbackStatus={playingUrl === modalArticle?.link ? playbackStatus : null}
        onClose={handleCloseModal}
        onReadAloud={() => {
          if (modalArticle) {
            void handlePlay(modalArticle);
          }
        }}
        onStopReading={stopPlayback}
      />
    </main>
  );
}
