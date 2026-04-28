/**
 * Microphone capture using AudioWorklet.
 *
 * Replaces the deprecated ScriptProcessorNode path. The worker thread handles
 * PCM conversion + RMS computation and transfers Int16 frames to the main
 * thread every ~128ms (see audio-capture-worklet.js).
 */

export interface MicCaptureFrame {
  /** Int16 PCM samples at 16kHz mono, 2048 samples per frame. */
  pcm: Int16Array;
  /** RMS of the frame's float samples in [0, 1]. */
  rms: number;
}

export interface MicCaptureOptions {
  /** URL of the worklet module. Defaults to `/voice/audio-capture-worklet.js`. */
  workletUrl?: string;
  /** Called for every captured frame. */
  onFrame: (frame: MicCaptureFrame) => void;
  /** Called with human-readable error message on setup/runtime failure. */
  onError?: (error: Error) => void;
}

const DEFAULT_WORKLET_URL = "/voice/audio-capture-worklet.js";

export class MicCapture {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private options: MicCaptureOptions;

  constructor(options: MicCaptureOptions) {
    this.options = options;
  }

  /**
   * Request mic, create AudioContext @ 16kHz, load worklet, start capture.
   * Returns metadata about the stream on success.
   */
  async start(): Promise<{ sampleRate: number; trackLabel: string }> {
    // 1. getUserMedia
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    const track = this.stream.getAudioTracks()[0];
    if (!track) throw new Error("no audio track available");

    // 2. AudioContext @ 16kHz (so mic is resampled by the browser; removes
    //    the need for client-side downsampling AND works around a Chrome
    //    quirk where a default-rate context + MediaStream can silently yield
    //    zero frames).
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) throw new Error("Web Audio API not available");
    try {
      this.ctx = new Ctor({ sampleRate: 16000 });
    } catch {
      this.ctx = new Ctor();
    }
    if (!this.ctx) throw new Error("AudioContext construction failed");
    try {
      await this.ctx.resume();
    } catch {
      /* best-effort */
    }

    // 3. Load the worklet module
    if (!this.ctx.audioWorklet) {
      throw new Error("AudioWorklet not supported in this browser");
    }
    const workletUrl = this.options.workletUrl ?? DEFAULT_WORKLET_URL;
    try {
      await this.ctx.audioWorklet.addModule(workletUrl);
    } catch (err) {
      throw new Error(
        `failed to load audio worklet from ${workletUrl}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    // 4. Build the graph: mic → worklet → (destination, muted-via-gain not needed
    //    because the worklet outputs nothing).
    this.sourceNode = this.ctx.createMediaStreamSource(this.stream);
    this.workletNode = new AudioWorkletNode(this.ctx, "audio-capture-processor", {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 1,
    });

    this.workletNode.port.onmessage = (event) => {
      const data = event.data as { pcm: ArrayBuffer; rms: number };
      if (!data || !data.pcm) return;
      try {
        this.options.onFrame({
          pcm: new Int16Array(data.pcm),
          rms: data.rms,
        });
      } catch (err) {
        this.options.onError?.(
          err instanceof Error ? err : new Error(String(err)),
        );
      }
    };
    this.workletNode.port.onmessageerror = (event) => {
      console.error("[MicCapture] worklet port message error:", event);
    };

    this.sourceNode.connect(this.workletNode);

    return {
      sampleRate: this.ctx.sampleRate,
      trackLabel: track.label,
    };
  }

  async stop(): Promise<void> {
    try {
      this.workletNode?.disconnect();
    } catch {
      /* ignore */
    }
    this.workletNode = null;

    try {
      this.sourceNode?.disconnect();
    } catch {
      /* ignore */
    }
    this.sourceNode = null;

    this.stream?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    });
    this.stream = null;

    if (this.ctx && this.ctx.state !== "closed") {
      try {
        await this.ctx.close();
      } catch {
        /* ignore */
      }
    }
    this.ctx = null;
  }

  getSampleRate(): number | null {
    return this.ctx?.sampleRate ?? null;
  }
}
