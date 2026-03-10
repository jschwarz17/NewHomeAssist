"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSubstack, type SubstackArticle } from "@/context/SubstackContext";
import { ArticlesSection } from "@/components/substack/ArticlesSection";
import { ArticleModal } from "@/components/substack/ArticleModal";

const MAX_TTS_CHARS = 3600;

function getApiBase(): string {
  if (typeof window === "undefined") return "";
  return (process.env.NEXT_PUBLIC_ASSISTANT_API_URL ?? "").replace(/\/$/, "");
}

function buildApiUrl(path: string): string {
  const base = getApiBase();
  return base ? `${base}${path}` : path;
}

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

interface LoadedArticle {
  title: string | null;
  content: string;
}

export default function SubstackPage() {
  const { ai, politics, fintech, loading, error, refresh } = useSubstack();
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

    const response = await fetch(
      `${buildApiUrl("/api/substack/article-content")}?url=${encodeURIComponent(article.link)}`,
      { cache: "no-store" }
    );

    const data = (await response.json()) as {
      title?: string | null;
      content?: string;
      error?: string;
    };

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
      const handleEnded = () => {
        cleanup();
        resolve();
      };

      const handleError = () => {
        cleanup();
        reject(new Error("Audio playback failed."));
      };

      const cleanup = () => {
        audio.removeEventListener("ended", handleEnded);
        audio.removeEventListener("error", handleError);
      };

      audio.addEventListener("ended", handleEnded);
      audio.addEventListener("error", handleError);
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

        const chunks = splitTextForAra(
          `${loaded.title || article.title}. ${loaded.content}`
        );

        if (chunks.length === 0) {
          throw new Error("No article text is available for Ara to read.");
        }

        setPlayingUrl(article.link);

        for (let index = 0; index < chunks.length; index += 1) {
          if (playbackSessionRef.current !== sessionId) {
            return;
          }

          setPlaybackStatus(`Ara is reading part ${index + 1} of ${chunks.length}`);

          const controller = new AbortController();
          playbackAbortRef.current = controller;

          const response = await fetch(buildApiUrl("/api/substack/article-audio"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: chunks[index] }),
            signal: controller.signal,
          });

          if (!response.ok) {
            const data = (await response.json().catch(() => ({}))) as { error?: string };
            throw new Error(data.error || "Ara could not generate audio for this article.");
          }

          const audioBlob = await response.blob();
          if (playbackSessionRef.current !== sessionId) {
            return;
          }

          revokeAudioBlobUrl();
          audioBlobUrlRef.current = URL.createObjectURL(audioBlob);
          audio.src = audioBlobUrlRef.current;
          setLoadingUrl(null);
          await audio.play();
          await waitForAudioToFinish(audio);
          revokeAudioBlobUrl();
        }

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
    [loadArticle, playingUrl, revokeAudioBlobUrl, stopPlayback, waitForAudioToFinish]
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
