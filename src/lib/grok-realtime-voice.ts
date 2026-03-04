/**
 * Grok Voice Agent realtime client: connect on wake word, stream mic, play Ara's voice.
 * Uses wss://api.x.ai/v1/realtime with ephemeral token and sec-websocket-protocol for browser.
 */

const SAMPLE_RATE = 24000;
const WS_URL = "wss://api.x.ai/v1/realtime";

function resampleTo24000(input: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === SAMPLE_RATE) return input;
  const ratio = inputSampleRate / SAMPLE_RATE;
  const outLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcIndex = i * ratio;
    const idx = Math.floor(srcIndex);
    const frac = srcIndex - idx;
    const next = idx + 1 < input.length ? input[idx + 1] : input[idx];
    output[i] = input[idx] * (1 - frac) + next * frac;
  }
  return output;
}

function float32ToPCM16Base64(float32: Float32Array): string {
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(pcm16.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64PCM16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const pcm16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;
  return float32;
}

export interface GrokRealtimeOptions {
  token: string;
  instructions: string;
  onTranscript?: (text: string) => void;
  onError?: (err: string) => void;
}

export async function startGrokRealtimeVoice(
  options: GrokRealtimeOptions
): Promise<() => void> {
  const { token, instructions, onTranscript, onError } = options;
  if (!token) {
    onError?.("No realtime token");
    return () => {};
  }

  const MIC_DELAY_MS = 600;

  const protocol = `xai-client-secret.${token}`;
  const ws = new WebSocket(WS_URL, [protocol]);
  let audioContext: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let sourceNode: MediaElementAudioSourceNode | MediaStreamAudioSourceNode | null = null;
  let processor: ScriptProcessorNode | null = null;
  let outputContext: AudioContext | null = null;
  let closed = false;
  let userHasSpoken = false;
  let nextPlayTime = 0;

  const stop = () => {
    if (closed) return;
    closed = true;
    try {
      ws.close();
    } catch {}
    try {
      processor?.disconnect();
      sourceNode?.disconnect();
      stream?.getTracks().forEach((t) => t.stop());
      audioContext?.close();
      outputContext?.close();
    } catch {}
  };

  ws.onerror = () => {
    onError?.("Voice connection error");
    stop();
  };

  ws.onclose = () => {
    stop();
  };

  ws.onopen = async () => {
    ws.send(
      JSON.stringify({
        type: "session.update",
        session: {
          voice: "Ara",
          instructions,
          turn_detection: { type: "server_vad" },
          audio: {
            input: { format: { type: "audio/pcm", rate: SAMPLE_RATE } },
            output: { format: { type: "audio/pcm", rate: SAMPLE_RATE } },
          },
        },
      })
    );

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new AudioContext();
      sourceNode = audioContext.createMediaStreamSource(stream);
      const bufferSize = 2048;
      processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      const inputRate = audioContext.sampleRate;
      const micStartTime = Date.now();
      processor.onaudioprocess = (e) => {
        if (closed || ws.readyState !== WebSocket.OPEN) return;
        if (Date.now() - micStartTime < MIC_DELAY_MS) return;
        const input = e.inputBuffer.getChannelData(0);
        const resampled = resampleTo24000(input, inputRate);
        const base64 = float32ToPCM16Base64(resampled);
        ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: base64 }));
      };
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      silentGain.connect(audioContext.destination);
      sourceNode.connect(processor);
      processor.connect(silentGain);

      outputContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      nextPlayTime = outputContext.currentTime;
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Could not start microphone");
      stop();
    }
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string);
      switch (data.type) {
        case "input_audio_buffer.speech_started":
          userHasSpoken = true;
          break;
        case "response.created":
          if (!userHasSpoken) {
            ws.send(JSON.stringify({ type: "response.cancel" }));
            break;
          }
          if (outputContext) nextPlayTime = outputContext.currentTime;
          break;
        case "response.output_audio.delta":
          if (data.delta && outputContext && !closed) {
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
        case "response.output_audio_transcript.delta":
          if (data.delta && onTranscript) onTranscript(data.delta);
          break;
        case "error":
          onError?.(data.message ?? "Voice error");
          break;
        default:
          break;
      }
    } catch {
      // ignore parse errors
    }
  };

  return stop;
}
