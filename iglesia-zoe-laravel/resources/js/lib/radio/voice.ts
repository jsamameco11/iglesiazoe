import type { RadioLayer, RadioMix, RadioState } from "./types";
import { postForm } from "./client";
import { unlock } from "./program-player";

/** Level of an analyser between 0 and 1 (RMS in dB, from -60 to 0). */
export function meterLevel(analyser: AnalyserNode, buffer: Float32Array<ArrayBuffer>) {
  analyser.getFloatTimeDomainData(buffer);
  let sum = 0;
  let peak = 0;
  for (const value of buffer) {
    sum += value * value;
    peak = Math.max(peak, Math.abs(value));
  }
  const rms = Math.sqrt(sum / buffer.length);
  const db = 20 * Math.log10(Math.max(rms, 1e-5));
  return { level: Math.min(1, Math.max(0, (db + 60) / 60)), peak: Math.min(1, peak) };
}

async function gathered(pc: RTCPeerConnection, timeout = 2500) {
  if (pc.iceGatheringState === "complete") return;
  await new Promise<void>((resolve) => {
    const done = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", done);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", done);
    window.setTimeout(resolve, timeout);
  });
}

type ControlMessage = { t: "mix"; mix: RadioMix; rev: number } | { t: "layer"; layer: RadioLayer } | { t: "stop"; ids: string[] } | { t: "voice"; on: boolean };

/** Voice this long above the threshold turns the detection on; this much silence turns it off. */
const VOICE_ATTACK_MS = 12;
const VOICE_HANG_MS = 550;

/**
 * Gain after the leveling compressor (+9 dB): any microphone from -48 to -16 dBFS of speech
 * reaches the listeners between -22 and -13 dBFS, above the music dropped under it, with the
 * limiter keeping the peaks under -1 dBFS.
 */
const VOICE_MAKEUP = 2.8;

/**
 * Speech detection on the audio thread, so it answers within milliseconds even with the tab in
 * the background. The noise floor follows quiet moments fast and loud ones slowly; voice is
 * what rises 10 dB above it (never below -52 dBFS, always from -20 dBFS).
 */
const DETECTOR = `
class ZoeVoiceDetector extends AudioWorkletProcessor {
  constructor() {
    super();
    this.noise = -70; this.on = false; this.loud = 0; this.quiet = 0; this.enabled = false;
    this.port.onmessage = (event) => {
      this.enabled = Boolean(event.data);
      this.loud = 0;
      if (!this.enabled && this.on) { this.on = false; this.port.postMessage(false); }
    };
  }
  process(inputs) {
    const samples = inputs[0] && inputs[0][0];
    if (!samples) return true;
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    const db = 10 * Math.log10(sum / samples.length + 1e-12);
    const ms = (samples.length / sampleRate) * 1000;
    this.noise += (db - this.noise) * (db < this.noise ? 0.02 : 0.0004);
    if (!this.enabled) return true;
    const threshold = Math.min(-20, Math.max(-52, this.noise + 10));
    if (db > threshold) { this.loud += ms; this.quiet = 0; } else { this.quiet += ms; if (this.quiet > 40) this.loud = 0; }
    const next = this.on ? this.quiet < ${VOICE_HANG_MS} : this.loud >= ${VOICE_ATTACK_MS};
    if (next !== this.on) { this.on = next; this.port.postMessage(next); }
    return true;
  }
}
registerProcessor("zoe-voice-detector", ZoeVoiceDetector);
`;

const detectorModules = new WeakMap<BaseAudioContext, Promise<void>>();

function loadDetector(ctx: AudioContext) {
  let loading = detectorModules.get(ctx);
  if (!loading) {
    const url = URL.createObjectURL(new Blob([DETECTOR], { type: "application/javascript" }));
    loading = ctx.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
    detectorModules.set(ctx, loading);
  }
  return loading;
}

/** The listener side of the live microphone. */
export class VoiceLink {
  status: "off" | "connecting" | "on" = "off";
  onStatus?: (status: VoiceLink["status"]) => void;
  onMix?: (mix: RadioMix, rev: number) => void;
  onLayer?: (layer: RadioLayer) => void;
  onStop?: (ids: string[]) => void;
  /** The host started or stopped speaking: the program drops under the voice. */
  onVoice?: (on: boolean) => void;
  /**
   * Hands the voice to the program mixer (null when it ends); true when it took it, so the
   * voice and the music share one volume and one limiter. Otherwise this element plays it.
   */
  route?: (stream: MediaStream | null) => boolean;
  private speaking = false;

  private pc: RTCPeerConnection | null = null;
  private session: string | null = null;
  private requestedAt = 0;
  private busy = false;
  readonly audio: HTMLAudioElement;

  constructor(private listener: string) {
    this.audio = new Audio();
    this.audio.autoplay = true;
  }

  unlock() {
    return unlock(this.audio);
  }

  setVolume(volume: number) {
    this.audio.volume = Math.min(1, Math.max(0, volume));
  }

  async update(state: RadioState) {
    const session = state.live.on ? state.live.session : null;
    if (!session) {
      this.close();
      this.session = null;
      return;
    }
    if (session !== this.session) {
      this.close();
      this.session = session;
      this.requestedAt = 0;
    }
    if (this.busy) return;
    const voice = state.voice;
    if (this.pc) {
      if (["connected", "connecting", "new"].includes(this.pc.connectionState)) return;
      this.close();
    }
    if (voice?.offer && voice.state === "offered") {
      await this.accept(session, voice.offer, state.ice);
      return;
    }
    const stuck = Date.now() - this.requestedAt > 15000;
    if (!voice || voice.state === "idle" || voice.state === "connected" || voice.state === "answered" || stuck) {
      if (Date.now() - this.requestedAt < 4000) return;
      this.requestedAt = Date.now();
      this.setStatus("connecting");
      await postForm("/radio/voz", { oyente: this.listener, session });
    }
  }

  close() {
    this.pc?.close();
    this.pc = null;
    if (this.audio.srcObject) this.route?.(null);
    this.audio.srcObject = null;
    this.audio.muted = false;
    this.setSpeaking(false);
    this.setStatus("off");
  }

  private setSpeaking(on: boolean) {
    if (on === this.speaking) return;
    this.speaking = on;
    this.onVoice?.(on);
  }

  private setStatus(status: VoiceLink["status"]) {
    if (status === this.status) return;
    this.status = status;
    this.onStatus?.(status);
  }

  private async accept(session: string, offer: string, ice: RTCIceServer[]) {
    this.busy = true;
    this.setStatus("connecting");
    try {
      const pc = new RTCPeerConnection({ iceServers: ice });
      this.pc = pc;
      pc.ontrack = (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        // Chrome only feeds a remote stream to Web Audio while a media element plays it, so it stays attached, muted.
        this.audio.srcObject = stream;
        this.audio.muted = this.route?.(stream) ?? false;
        void this.audio.play().catch(() => undefined);
      };
      pc.ondatachannel = (event) => {
        event.channel.onmessage = (message) => {
          try {
            const data = JSON.parse(String(message.data)) as ControlMessage;
            if (data.t === "mix") this.onMix?.(data.mix, data.rev);
            if (data.t === "layer") this.onLayer?.(data.layer);
            if (data.t === "stop") this.onStop?.(data.ids);
            if (data.t === "voice") this.setSpeaking(data.on);
          } catch {
            /* ignore malformed */
          }
        };
      };
      pc.onconnectionstatechange = () => {
        if (pc !== this.pc) return;
        if (pc.connectionState === "connected") this.setStatus("on");
        if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
          this.close();
          this.requestedAt = 0;
        }
      };
      await pc.setRemoteDescription({ type: "offer", sdp: offer });
      await pc.setLocalDescription(await pc.createAnswer());
      await gathered(pc);
      const result = await postForm("/radio/voz/respuesta", { oyente: this.listener, session, sdp: pc.localDescription?.sdp ?? "" });
      if (!result?.ok) {
        this.close();
        this.requestedAt = 0;
      }
    } catch {
      this.close();
      this.requestedAt = 0;
    } finally {
      this.busy = false;
    }
  }
}

type Peer = { pc: RTCPeerConnection; channel: RTCDataChannel; created: number };

/**
 * The console microphone: capture, voice processing (high-pass, compressor), the
 * talk gate, voice detection and one WebRTC connection per listener.
 */
export class Broadcaster {
  analyser: AnalyserNode | null = null;
  stream: MediaStream | null = null;
  readonly peers = new Map<string, Peer>();
  /** Whether the host's voice is detected now (only while talking with «Detectar voz» on). */
  speaking = false;
  onVoice?: (on: boolean) => void;

  private ctx: AudioContext | null = null;
  private gate: GainNode | null = null;
  private fader: GainNode | null = null;
  private returnGain: GainNode | null = null;
  private dest: MediaStreamAudioDestinationNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private detector: AudioWorkletNode | null = null;
  private fallbackTimer = 0;
  private talking = false;
  private detect = true;

  get open() {
    return this.stream !== null;
  }

  get connected() {
    let count = 0;
    this.peers.forEach((peer) => peer.pc.connectionState === "connected" && count++);
    return count;
  }

  async openMic(deviceId: string | null, processing: boolean) {
    this.closeMic();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: processing,
        noiseSuppression: processing,
        autoGainControl: false,
        channelCount: 1,
      },
    });
    const Context = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx ??= new Context({ latencyHint: "interactive" });
    await this.ctx.resume();
    const ctx = this.ctx;
    this.stream = stream;
    this.source = ctx.createMediaStreamSource(stream);
    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 85;
    const presence = ctx.createBiquadFilter();
    presence.type = "peaking";
    presence.frequency.value = 3200;
    presence.gain.value = 2.5;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -36;
    compressor.knee.value = 8;
    compressor.ratio.value = 3.5;
    compressor.attack.value = 0.008;
    compressor.release.value = 0.25;
    const makeup = ctx.createGain();
    makeup.gain.value = VOICE_MAKEUP;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.06;
    this.fader ??= ctx.createGain();
    this.gate = ctx.createGain();
    this.gate.gain.value = this.talking ? 1 : 0;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.returnGain = ctx.createGain();
    this.returnGain.gain.value = 0;
    this.dest ??= ctx.createMediaStreamDestination();
    this.source.connect(highpass).connect(presence).connect(compressor).connect(makeup).connect(limiter).connect(this.fader).connect(this.analyser);
    this.analyser.connect(this.gate).connect(this.dest);
    this.analyser.connect(this.returnGain).connect(ctx.destination);
    await this.listenForVoice(ctx, compressor);
    return stream;
  }

  /** Speech band of the processed microphone (before its fader) into the detector. */
  private async listenForVoice(ctx: AudioContext, input: AudioNode) {
    const low = ctx.createBiquadFilter();
    low.type = "highpass";
    low.frequency.value = 250;
    const high = ctx.createBiquadFilter();
    high.type = "lowpass";
    high.frequency.value = 4000;
    input.connect(low).connect(high);
    try {
      await loadDetector(ctx);
      const node = new AudioWorkletNode(ctx, "zoe-voice-detector", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
      node.port.onmessage = (event) => this.setSpeaking(Boolean(event.data));
      high.connect(node).connect(ctx.destination);
      this.detector = node;
    } catch {
      this.watchWithAnalyser(ctx, high);
    }
    this.syncDetection();
  }

  /** Same detection on the main thread, for browsers without AudioWorklet. */
  private watchWithAnalyser(ctx: AudioContext, input: AudioNode) {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    input.connect(analyser);
    const buffer = new Float32Array(analyser.fftSize);
    let noise = -70;
    let loud = 0;
    let quiet = 0;
    let last = performance.now();
    window.clearInterval(this.fallbackTimer);
    this.fallbackTimer = window.setInterval(() => {
      const at = performance.now();
      const ms = at - last;
      last = at;
      analyser.getFloatTimeDomainData(buffer);
      let sum = 0;
      for (const value of buffer) sum += value * value;
      const db = 10 * Math.log10(sum / buffer.length + 1e-12);
      noise += (db - noise) * (db < noise ? 0.15 : 0.003);
      if (!this.detecting) return;
      const threshold = Math.min(-20, Math.max(-52, noise + 10));
      if (db > threshold) {
        loud += ms;
        quiet = 0;
      } else {
        quiet += ms;
        if (quiet > 40) loud = 0;
      }
      this.setSpeaking(this.speaking ? quiet < VOICE_HANG_MS : loud >= VOICE_ATTACK_MS);
    }, 15);
  }

  private get detecting() {
    return this.detect && this.talking && this.stream !== null;
  }

  private syncDetection() {
    this.detector?.port.postMessage(this.detecting);
    if (!this.detecting) this.setSpeaking(false);
  }

  private setSpeaking(on: boolean) {
    if (on === this.speaking) return;
    this.speaking = on;
    this.broadcast({ t: "voice", on });
    this.onVoice?.(on);
  }

  closeMic() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.source?.disconnect();
    this.source = null;
    this.detector?.disconnect();
    this.detector = null;
    window.clearInterval(this.fallbackTimer);
    this.fallbackTimer = 0;
    this.setSpeaking(false);
  }

  setLevel(value: number) {
    if (this.fader && this.ctx) this.fader.gain.setTargetAtTime(value, this.ctx.currentTime, 0.03);
  }

  setTalking(on: boolean) {
    this.talking = on;
    if (this.gate && this.ctx) this.gate.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.04);
    this.syncDetection();
  }

  /** «Detectar voz»: while talking, the program drops for every listener as soon as the voice is heard. */
  setDetect(on: boolean) {
    this.detect = on;
    this.syncDetection();
  }

  setReturn(on: boolean) {
    if (this.returnGain && this.ctx) this.returnGain.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05);
  }

  async serve(ids: string[], ice: RTCIceServer[]) {
    const track = this.dest?.stream.getAudioTracks()[0];
    if (!track || !this.dest) return;
    await Promise.all(
      ids.map(async (id) => {
        this.drop(id);
        const pc = new RTCPeerConnection({ iceServers: ice });
        pc.addTrack(track, this.dest!.stream);
        const channel = pc.createDataChannel("control");
        channel.onopen = () => channel.send(JSON.stringify({ t: "voice", on: this.speaking } satisfies ControlMessage));
        this.peers.set(id, { pc, channel, created: Date.now() });
        pc.onconnectionstatechange = () => {
          if (["failed", "closed"].includes(pc.connectionState)) this.drop(id);
        };
        try {
          const offer = await pc.createOffer();
          offer.sdp = offer.sdp?.replace("useinbandfec=1", "useinbandfec=1;stereo=0;maxaveragebitrate=64000");
          await pc.setLocalDescription(offer);
          await gathered(pc);
          await postForm("/admin/radio/senal/oferta", { id, sdp: pc.localDescription?.sdp ?? "" });
        } catch {
          this.drop(id);
        }
      }),
    );
  }

  async accept(answers: { id: string; answer: string }[]) {
    await Promise.all(
      answers.map(async ({ id, answer }) => {
        const peer = this.peers.get(id);
        if (!peer || peer.pc.signalingState !== "have-local-offer") return;
        await peer.pc.setRemoteDescription({ type: "answer", sdp: answer }).catch(() => this.drop(id));
      }),
    );
  }

  /** Closes connections of listeners that left (after a grace period for new ones). */
  prune(alive: string[]) {
    const keep = new Set(alive);
    this.peers.forEach((peer, id) => {
      if (!keep.has(id) && Date.now() - peer.created > 20000) this.drop(id);
    });
  }

  broadcast(message: ControlMessage) {
    const text = JSON.stringify(message);
    this.peers.forEach((peer) => {
      if (peer.channel.readyState === "open") peer.channel.send(text);
    });
  }

  dropAll() {
    [...this.peers.keys()].forEach((id) => this.drop(id));
  }

  shutdown() {
    this.dropAll();
    this.closeMic();
    void this.ctx?.close();
    this.ctx = null;
    this.fader = null;
    this.dest = null;
  }

  private drop(id: string) {
    const peer = this.peers.get(id);
    if (!peer) return;
    peer.pc.close();
    this.peers.delete(id);
  }
}
