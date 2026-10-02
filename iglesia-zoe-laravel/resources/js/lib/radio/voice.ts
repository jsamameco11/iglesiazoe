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

type ControlMessage = { t: "mix"; mix: RadioMix; rev: number } | { t: "layer"; layer: RadioLayer } | { t: "stop"; ids: string[] };

/** The listener side of the live microphone. */
export class VoiceLink {
  status: "off" | "connecting" | "on" = "off";
  onStatus?: (status: VoiceLink["status"]) => void;
  onMix?: (mix: RadioMix, rev: number) => void;
  onLayer?: (layer: RadioLayer) => void;
  onStop?: (ids: string[]) => void;

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
    this.audio.srcObject = null;
    this.setStatus("off");
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
        this.audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
        void this.audio.play().catch(() => undefined);
      };
      pc.ondatachannel = (event) => {
        event.channel.onmessage = (message) => {
          try {
            const data = JSON.parse(String(message.data)) as ControlMessage;
            if (data.t === "mix") this.onMix?.(data.mix, data.rev);
            if (data.t === "layer") this.onLayer?.(data.layer);
            if (data.t === "stop") this.onStop?.(data.ids);
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
 * talk gate and one WebRTC connection per listener.
 */
export class Broadcaster {
  analyser: AnalyserNode | null = null;
  stream: MediaStream | null = null;
  readonly peers = new Map<string, Peer>();

  private ctx: AudioContext | null = null;
  private gate: GainNode | null = null;
  private fader: GainNode | null = null;
  private returnGain: GainNode | null = null;
  private dest: MediaStreamAudioDestinationNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private talking = false;

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
    compressor.threshold.value = -24;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.2;
    this.fader ??= ctx.createGain();
    this.gate = ctx.createGain();
    this.gate.gain.value = this.talking ? 1 : 0;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.returnGain = ctx.createGain();
    this.returnGain.gain.value = 0;
    this.dest ??= ctx.createMediaStreamDestination();
    this.source.connect(highpass).connect(presence).connect(compressor).connect(this.fader).connect(this.analyser);
    this.analyser.connect(this.gate).connect(this.dest);
    this.analyser.connect(this.returnGain).connect(ctx.destination);
    return stream;
  }

  closeMic() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.source?.disconnect();
    this.source = null;
  }

  setLevel(value: number) {
    if (this.fader && this.ctx) this.fader.gain.setTargetAtTime(value, this.ctx.currentTime, 0.03);
  }

  setTalking(on: boolean) {
    this.talking = on;
    if (this.gate && this.ctx) this.gate.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.04);
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
