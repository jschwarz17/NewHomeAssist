/**
 * Use the Grok Voice Agent (realtime API) to speak text as Ara — no mic, no tools.
 * Same pipeline as the main voice session, so it works on Android where Ara's voice already works.
 */

const WS_URL = "wss://api.x.ai/v1/realtime";
const SAMPLE_RATE = 24000;

function base64PCM16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const pcm16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;
  return float32;
}

export interface AraReadAloudOptions {
  token: string;
  chunks: string[];
  onChunkStart?: (index: number, total: number) => void;
  signal?: AbortSignal;
}

/**
 * Speaks each chunk via the Voice Agent (Ara). Resolves when all chunks are done or rejects on error.
 * Uses the same realtime WebSocket as the main voice session.
 */
export function speakWithAraRealtime(options: AraReadAloudOptions): Promise<void> {
  const { token, chunks, onChunkStart, signal } = options;
  if (!chunks.length) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const protocol = `xai-client-secret.${token}`;
    const ws = new WebSocket(WS_URL, [protocol]);
    let outputContext: AudioContext | null = null;
    let closed = false;
    let nextPlayTime = 0;
    let currentChunkIndex = 0;
    let pendingResolve: (() => void) | null = null;

    const stop = (err?: unknown) => {
      if (closed) return;
      closed = true;
      try {
        ws.close();
      } catch {}
      try {
        outputContext?.close();
      } catch {}
      if (err != null) reject(err);
      else resolve();
    };

    if (signal) {
      signal.addEventListener("abort", () => stop(new DOMException("Aborted", "AbortError")));
    }

    ws.onerror = () => stop(new Error("Voice connection error"));
    ws.onclose = () => {
      if (!closed) stop(new Error("Voice connection closed"));
    };

    ws.onopen = () => {
      try {
        outputContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      } catch (e) {
        stop(e);
        return;
      }

      ws.send(
        JSON.stringify({
          type: "session.update",
          session: {
            voice: "Ara",
            instructions:
              "You are Ara. When the user sends you a message, read it aloud exactly. Do not add any introduction, conclusion, or commentary. Just read the text.",
            turn_detection: null,
            audio: {
              input: { format: { type: "audio/pcm", rate: SAMPLE_RATE } },
              output: { format: { type: "audio/pcm", rate: SAMPLE_RATE } },
            },
          },
        })
      );

      function sendNextChunk() {
        if (closed || currentChunkIndex >= chunks.length) {
          if (currentChunkIndex >= chunks.length) stop();
          return;
        }
        const text = chunks[currentChunkIndex];
        onChunkStart?.(currentChunkIndex, chunks.length);

        ws.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [{ type: "input_text", text }],
            },
          })
        );
        ws.send(
          JSON.stringify({
            type: "response.create",
            response: { modalities: ["text", "audio"] },
          })
        );
      }

      sendNextChunk();
      pendingResolve = sendNextChunk;
    };

    ws.onmessage = (event) => {
      if (closed) return;
      try {
        const data = JSON.parse(event.data as string);
        switch (data.type) {
          case "response.output_audio.delta":
            if (data.delta && outputContext) {
              const float32 = base64PCM16ToFloat32(data.delta);
              const buffer = outputContext.createBuffer(1, float32.length, SAMPLE_RATE);
              buffer.copyToChannel(new Float32Array(float32), 0);
              const node = outputContext.createBufferSource();
              node.buffer = buffer;
              node.connect(outputContext.destination);
              const now = outputContext.currentTime;
              const startAt = Math.max(now, nextPlayTime);
              node.start(startAt);
              nextPlayTime = startAt + buffer.duration;
            }
            break;
          case "response.done":
            currentChunkIndex += 1;
            if (currentChunkIndex >= chunks.length) {
              stop();
            } else {
              pendingResolve?.();
            }
            break;
          case "response.created":
            if (outputContext) nextPlayTime = outputContext.currentTime;
            break;
          case "error":
            stop(new Error(data.message ?? "Voice error"));
            break;
          default:
            break;
        }
      } catch {
        // ignore parse errors
      }
    };
  });
}
