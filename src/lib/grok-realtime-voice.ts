/**
 * Grok Voice Agent realtime client: connect on wake word, stream mic, play Ara's voice.
 * Uses wss://api.x.ai/v1/realtime with ephemeral token and sec-websocket-protocol for browser.
 * Supports function calling for memory storage.
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

const PLAY_MUSIC_TOOL = {
  type: "function",
  name: "play_music",
  description:
    "Play music on ONE Sonos speaker only. Call when the user says 'play...', 'put on...', 'I want to listen to...', or names an artist/song/playlist.\n\n" +
    "CRITICAL — Location: If the user names a room or location (e.g. 'play X downstairs', 'in the living room', 'on the kitchen speaker', 'in the bedroom'), you MUST pass that exact location as 'device'. Play ONLY on that speaker; do not default to Living Room. " +
    "If no room is specified, then default to 'Living Room'.\n" +
    "Available speakers: Living Room, Downstairs, Guest Bathroom, Master Bathroom (or whatever room names the user uses — match their words).\n" +
    "Music default: if no artist/song given, use 'Latin indie' for query.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "What music to play — artist, song, genre, playlist name, or mood. Default: 'Latin indie'",
      },
      device: {
        type: "string",
        description: "The exact room/speaker the user asked for (e.g. 'Downstairs', 'Living Room'). Required when user specifies a location. Play only on this speaker.",
      },
    },
  },
};

const PLAY_YOUTUBE_TOOL = {
  type: "function",
  name: "play_youtube",
  description:
    "Open YouTube and play a video. Call this when the user says anything like " +
    "'let's watch a video', 'open YouTube', 'play a video of...', 'I want to see...', " +
    "'show me a video about...', or describes any video content they want to watch.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "What to search for on YouTube — topic, title, creator, or description of the video.",
      },
    },
    required: ["query"],
  },
};

const PAUSE_MUSIC_TOOL = {
  type: "function",
  name: "pause_music",
  description:
    "Pause or stop music on Sonos speakers. Call this when the user says:\n" +
    "- 'stop the living room', 'pause downstairs', 'turn off the kitchen' → pass that room as 'device'.\n" +
    "- 'stop the music', 'pause', 'turn off the music', 'silence' (NO room named) → do NOT pass a device. " +
    "The system will check which speakers are playing and handle it automatically (stop all if same music, or ask user if different music is on different speakers).\n" +
    "IMPORTANT: Only pass 'device' when the user explicitly names a room. If they just say 'stop' or 'stop the music' without naming a room, omit 'device' entirely.",
  parameters: {
    type: "object",
    properties: {
      device: {
        type: "string",
        description: "The specific room the user named (e.g. 'Living Room', 'Downstairs'). OMIT this if the user did not name a room.",
      },
    },
  },
};

const SET_VOLUME_TOOL = {
  type: "function",
  name: "set_volume",
  description:
    "Set the volume on Sonos speakers. Call this when the user says " +
    "'turn it up', 'turn it down', 'set volume to...', 'louder', 'quieter', etc. " +
    "Volume range is 0-100.",
  parameters: {
    type: "object",
    properties: {
      volume: {
        type: "number",
        description: "Volume level 0-100. For 'turn it up'/'louder' use 60-70, for 'turn it down'/'quieter' use 20-30.",
      },
      device: {
        type: "string",
        description: "Which room/speaker. Default: 'Living Room'. Options: Living Room, Downstairs, Guest Bathroom, Master Bathroom.",
      },
    },
    required: ["volume"],
  },
};

const CLOSE_VIDEO_TOOL = {
  type: "function",
  name: "close_video",
  description:
    "IMPORTANT: Call this tool whenever the user wants to stop watching a YouTube video or return to the dashboard. " +
    "Trigger phrases include but are not limited to: 'stop', 'stop the video', 'close', 'close it', " +
    "'go back', 'back', 'dashboard', 'done', 'done watching', 'exit', 'go home', 'that's enough', " +
    "'I'm done', 'enough', 'turn it off', 'shut it off', 'end the video', 'no more', 'next', " +
    "or ANY phrase that suggests the user is finished watching or wants to leave the video screen. " +
    "If a video was recently played and the user says 'stop' or 'done', ALWAYS use close_video (not pause_music).",
  parameters: { type: "object", properties: {} },
};

const USE_NEW_TOOLS_TOOL = {
  type: "function",
  name: "use_new_tools",
  description:
    "Use this tool to get REAL-TIME, LIVE data. Call it automatically (without the user saying 'use new tools') whenever the user asks about: " +
    "weather or forecast; news or headlines; current time or timezone; sports scores or standings; stock prices or market quotes; " +
    "recipes or cooking; translating text or language; movies, TV shows, or what to watch. " +
    "Also call it when the user explicitly says 'use new tools', 'try new tools', or 'use your other tools' — then pass the question they want re-answered. " +
    "Pass the user's question exactly as they asked it. Do NOT answer from memory for these topics — always call this tool for live data.",
  parameters: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description: "The user's question (e.g. 'What's the weather?', 'What time is it in Tokyo?', 'Any news?', 'How is Apple stock doing?').",
      },
    },
    required: ["question"],
  },
};

const STORE_MEMORY_TOOL = {
  type: "function",
  name: "store_memory",
  description:
    "Store a fact, preference, name, or piece of personal information that the user wants you to remember across conversations. " +
    "Call this tool whenever the user:\n" +
    "- Explicitly says 'remember', 'don't forget', 'keep in mind', 'note that'\n" +
    "- Teaches you something: 'I want to teach you', 'I want you to learn', 'I want you to know', 'let me tell you about'\n" +
    "- Shares personal facts: names (their name, spouse, kids, pets), preferences (food, language, allergies), " +
    "important dates (birthdays, anniversaries), routines, nicknames, or any detail about their life or household\n" +
    "- Corrects you: 'actually my name is...', 'no, it's...'\n" +
    "- States something they clearly expect you to retain for the future\n\n" +
    "When in doubt, store it. It's always better to remember too much than too little. " +
    "Write the memory as a clear, concise factual statement.",
  parameters: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "A clear factual statement of what to remember, e.g. 'Jesse's dog is named Bruno' or 'Vanessa prefers to be spoken to in Spanish'.",
      },
    },
    required: ["text"],
  },
};

export interface GrokRealtimeOptions {
  token: string;
  instructions: string;
  stream: MediaStream;
  apiBaseUrl: string;
  onTranscript?: (text: string) => void;
  onError?: (err: string) => void;
  onMemoryStored?: (text: string) => void;
  onPlayMusic?: (query: string, device: string) => Promise<string>;
  onPauseMusic?: (device: string) => Promise<string>;
  onSetVolume?: (volume: number, device: string) => Promise<string>;
  onPlayYouTube?: (query: string) => Promise<string>;
  onCloseVideo?: () => void;
  onUseNewTools?: (question: string) => Promise<{ success: boolean; answer: string }>;
}

export async function startGrokRealtimeVoice(
  options: GrokRealtimeOptions
): Promise<() => void> {
  const { token, instructions, stream, apiBaseUrl, onTranscript, onError, onMemoryStored, onPlayMusic, onPauseMusic, onSetVolume, onPlayYouTube, onCloseVideo, onUseNewTools } = options;
  if (!token) {
    onError?.("No realtime token");
    return () => {};
  }

  const MIC_DELAY_MS = 250;

  const protocol = `xai-client-secret.${token}`;
  const ws = new WebSocket(WS_URL, [protocol]);
  let audioContext: AudioContext | null = null;
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
      stream.getTracks().forEach((t) => t.stop());
      audioContext?.close();
      outputContext?.close();
    } catch {}
  };

  function respondToFunctionCall(callId: string, output: object) {
    ws.send(JSON.stringify({
      type: "conversation.item.create",
      item: { type: "function_call_output", call_id: callId, output: JSON.stringify(output) },
    }));
    ws.send(JSON.stringify({ type: "response.create" }));
  }

  async function handleFunctionCall(name: string, callId: string, args: string) {
    try {
      const parsed = JSON.parse(args);

      if (name === "store_memory") {
        const text = parsed.text ?? "";
        if (text) {
          onMemoryStored?.(text);
          respondToFunctionCall(callId, { success: true, stored: text });
          return;
        }
      }

      if (name === "play_music") {
        const query = parsed.query || "Latin indie";
        const device = parsed.device || "living room";
        // #region agent log
        fetch('http://127.0.0.1:7941/ingest/682557f1-4c11-46b8-bba1-57fb1f47de33',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'915513'},body:JSON.stringify({sessionId:'915513',runId:'voice-playback',hypothesisId:'H4',location:'src/lib/grok-realtime-voice.ts:267',message:'play_music tool args resolved',data:{query,device,rawQuery:parsed.query ?? null,rawDevice:parsed.device ?? null},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (onPlayMusic) {
          const result = await onPlayMusic(query, device);
          respondToFunctionCall(callId, { success: true, message: result });
        } else {
          respondToFunctionCall(callId, { success: false, message: "Music playback not available" });
        }
        return;
      }

      if (name === "pause_music") {
        const device = parsed.device || "";
        if (onPauseMusic) {
          const result = await onPauseMusic(device);
          respondToFunctionCall(callId, { success: true, message: result });
        } else {
          respondToFunctionCall(callId, { success: false, message: "Music control not available" });
        }
        return;
      }

      if (name === "set_volume") {
        const volume = parsed.volume ?? 30;
        const device = parsed.device || "living room";
        if (onSetVolume) {
          const result = await onSetVolume(volume, device);
          respondToFunctionCall(callId, { success: true, message: result });
        } else {
          respondToFunctionCall(callId, { success: false, message: "Volume control not available" });
        }
        return;
      }

      if (name === "play_youtube") {
        const query = parsed.query ?? "";
        if (query && onPlayYouTube) {
          const result = await onPlayYouTube(query);
          respondToFunctionCall(callId, { success: true, message: result });
        } else {
          respondToFunctionCall(callId, { success: false, message: "YouTube not available" });
        }
        return;
      }

      if (name === "close_video") {
        onCloseVideo?.();
        respondToFunctionCall(callId, { success: true, message: "Returned to dashboard" });
        return;
      }

      if (name === "use_new_tools") {
        const question = parsed.question ?? "";
        if (question && onUseNewTools) {
          const result = await onUseNewTools(question);
          respondToFunctionCall(callId, result);
        } else {
          respondToFunctionCall(callId, { success: false, answer: "External tools are not available right now." });
        }
        return;
      }
    } catch {}

    respondToFunctionCall(callId, { success: false, error: "Unknown function" });
  }

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
          tools: [STORE_MEMORY_TOOL, PLAY_MUSIC_TOOL, PAUSE_MUSIC_TOOL, SET_VOLUME_TOOL, PLAY_YOUTUBE_TOOL, CLOSE_VIDEO_TOOL, USE_NEW_TOOLS_TOOL],
          audio: {
            input: { format: { type: "audio/pcm", rate: SAMPLE_RATE } },
            output: { format: { type: "audio/pcm", rate: SAMPLE_RATE } },
          },
        },
      })
    );

    try {
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
      const micBoost = audioContext.createGain();
      micBoost.gain.value = 2.5;
      sourceNode.connect(micBoost);
      micBoost.connect(processor);
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
        case "response.function_call_arguments.done":
          handleFunctionCall(data.name, data.call_id, data.arguments);
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
