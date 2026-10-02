export type RadioKind = "musica" | "anuncio" | "efecto" | "programa" | "vivo" | "relleno";

export type RadioItem = {
  id: string;
  kind: RadioKind;
  title: string;
  artist: string | null;
  src: string | null;
  start: number;
  end: number;
  origin: number;
  seek: number;
  bed: boolean;
  block: string | null;
  slot: string | null;
};

export type RadioFx = { id: string; src: string; title: string; kind: string; at: number };

export type RadioMix = { music: number; fx: number; bed: number };

export type RadioLive = {
  on: boolean;
  session: string | null;
  host: string;
  mic: boolean;
  started_at: number | null;
  rev: number;
  fx: RadioFx[];
};

export type RadioState = {
  now: number;
  name: string;
  tagline: string;
  on_air: boolean;
  stream: string | null;
  queue: RadioItem[];
  next_show: { title: string; kind: RadioKind; start: number } | null;
  live: RadioLive;
  mix: RadioMix;
  listeners: number;
  ice: RTCIceServer[];
  voice?: { state: string; offer: string | null; since?: number | null };
};

export type RadioTrack = {
  id: string;
  kind: Exclude<RadioKind, "vivo" | "relleno">;
  title: string;
  artist: string | null;
  src: string;
  duration: number;
  rotation: boolean;
  active: boolean;
  upcoming?: number;
};

export type RadioConfig = {
  name: string;
  tagline: string;
  on_air: boolean;
  autofill: boolean;
  bed_level: number;
  fx_level: number;
  stream_url: string;
  turn_url: string;
  turn_username: string;
  turn_credential: string;
  max_voice: number;
};

export type RadioBlock = {
  id: string;
  kind: RadioKind;
  title: string;
  artist: string | null;
  note: string | null;
  bed: boolean;
  duration: number;
  track_id: string | null;
  src: string | null;
  inactive: boolean;
  start: number;
  end: number;
};

export const KIND_LABEL: Record<RadioKind, string> = {
  musica: "Música",
  anuncio: "Anuncio",
  efecto: "Efecto",
  programa: "Programa",
  vivo: "En vivo",
  relleno: "Música continua",
};

export const TZ = "America/Lima";

export function clock(ms: number, seconds = false) {
  return new Date(ms).toLocaleTimeString("es-PE", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: seconds ? "2-digit" : undefined, hour12: false });
}

export function duration(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export function longDuration(seconds: number) {
  if (seconds > 0 && seconds < 60) return `${Math.max(1, Math.round(seconds))} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function limaDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: TZ });
}

export function dayLabel(date: string, today?: string) {
  if (today && date === today) return "Hoy";
  const value = new Date(`${date}T12:00:00-05:00`);
  if (today) {
    const tomorrow = new Date(`${today}T12:00:00-05:00`);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (limaDate(tomorrow.getTime()) === date) return "Mañana";
  }
  return value.toLocaleDateString("es-PE", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
}

export function currentItem(queue: RadioItem[], now: number) {
  return queue.find((item) => item.start <= now && now < item.end) ?? null;
}

export function newListenerId() {
  const key = "zoe-radio-listener";
  try {
    const saved = window.localStorage.getItem(key);
    if (saved && /^[0-9a-f-]{36}$/.test(saved)) return saved;
  } catch {
    /* storage blocked */
  }
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));
  try {
    window.localStorage.setItem(key, id);
  } catch {
    /* storage blocked */
  }
  return id;
}

function csrf() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
}

export async function postForm(url: string, data: Record<string, string>) {
  const body = new FormData();
  Object.entries(data).forEach(([key, value]) => body.set(key, value));
  const res = await fetch(url, { method: "POST", body, headers: { "X-CSRF-TOKEN": csrf(), Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } });
  return res.json().catch(() => ({}));
}

/** Offset between this device and the server clock, from the best (lowest latency) sample. */
export class ServerClock {
  private offset = 0;
  private best = Infinity;

  /** First rough estimate from the page props, replaced by the first measured sample. */
  seed(serverNow: number) {
    if (this.best === Infinity) this.offset = serverNow - Date.now();
  }

  sample(serverNow: number, sentAt: number, receivedAt: number) {
    const rtt = receivedAt - sentAt;
    if (rtt <= this.best * 1.5 + 20) {
      this.best = Math.min(this.best, rtt);
      this.offset = serverNow + rtt / 2 - receivedAt;
    }
  }

  now() {
    return Date.now() + this.offset;
  }
}

let silentUrl = "";
function silence() {
  if (silentUrl) return silentUrl;
  const rate = 8000;
  const samples = 800;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples * 2, true);
  silentUrl = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
  return silentUrl;
}

/** Plays a silent clip inside a click so iOS lets the element play later on its own. */
export function unlock(element: HTMLAudioElement) {
  element.src = silence();
  return element.play().then(() => element.pause()).catch(() => undefined);
}

type Deck = { el: HTMLAudioElement; gain: GainNode; item: RadioItem | null; ready: boolean };

/**
 * The program as every listener hears it: two decks that follow the server timeline
 * (with short crossfades), a music bus driven by the console faders and an effects bus.
 */
export class ProgramPlayer {
  ctx: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  clock: ServerClock;
  onItem?: (item: RadioItem | null) => void;
  onBlocked?: () => void;

  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private fxBus: GainNode | null = null;
  private decks: Deck[] = [];
  private active = -1;
  private queue: RadioItem[] = [];
  private mix: RadioMix = { music: 1, fx: 0.9, bed: 0.22 };
  private volume = 0.9;
  private timer = 0;
  private played = new Set<string>();
  private lastItem: string | null = null;

  constructor(clock: ServerClock) {
    this.clock = clock;
  }

  get running() {
    return this.timer !== 0;
  }

  /** Must be called from a click or tap. */
  async start() {
    if (!this.ctx) {
      const Context = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Context({ latencyHint: "playback" });
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.fxBus = ctx.createGain();
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.78;
      this.musicBus.connect(this.master);
      this.fxBus.connect(this.master);
      this.master.connect(this.analyser);
      this.analyser.connect(ctx.destination);
      this.decks = [0, 1].map(() => {
        const el = new Audio();
        el.crossOrigin = "anonymous";
        el.preload = "auto";
        const gain = ctx.createGain();
        gain.gain.value = 0;
        ctx.createMediaElementSource(el).connect(gain);
        gain.connect(this.musicBus!);
        return { el, gain, item: null, ready: false };
      });
    }
    await this.ctx.resume();
    await Promise.all(this.decks.map((deck) => unlock(deck.el)));
    this.decks.forEach((deck) => (deck.item = null));
    this.active = -1;
    this.lastItem = null;
    this.applyGains(0);
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), 400);
    this.tick();
  }

  stop() {
    window.clearInterval(this.timer);
    this.timer = 0;
    this.decks.forEach((deck) => {
      deck.el.pause();
      deck.item = null;
    });
    this.active = -1;
    this.lastItem = null;
    void this.ctx?.suspend();
  }

  setQueue(queue: RadioItem[]) {
    this.queue = queue;
    if (this.running) this.tick();
  }

  setMix(mix: RadioMix) {
    this.mix = mix;
    this.applyGains(0.25);
  }

  setVolume(volume: number) {
    this.volume = volume;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.05);
  }

  /** Plays a sound effect fired from the console; late events (over 6 s) are skipped. */
  fx(event: RadioFx, immediate = false) {
    if (this.played.has(event.id) || !this.ctx || !this.fxBus || !this.running) return;
    const late = this.clock.now() - event.at;
    if (!immediate && late > 6000) return;
    this.played.add(event.id);
    const el = new Audio();
    el.crossOrigin = "anonymous";
    el.src = event.src;
    const source = this.ctx.createMediaElementSource(el);
    source.connect(this.fxBus);
    el.onended = () => source.disconnect();
    void el.play().catch(() => source.disconnect());
  }

  currentItem() {
    return currentItem(this.queue, this.clock.now());
  }

  private gainFor(item: RadioItem | null) {
    if (!item) return 0;
    return item.bed ? this.mix.bed : 1;
  }

  private applyGains(seconds: number) {
    if (!this.ctx || !this.musicBus || !this.fxBus || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volume, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.mix.music, t, Math.max(0.01, seconds / 3));
    this.fxBus.gain.setTargetAtTime(this.mix.fx, t, 0.05);
    this.decks.forEach((deck, index) => {
      if (index === this.active) deck.gain.gain.setTargetAtTime(this.gainFor(deck.item), t, Math.max(0.01, seconds / 3));
    });
  }

  private tick() {
    if (!this.ctx) return;
    const now = this.clock.now();
    const item = currentItem(this.queue, now);
    if ((item?.id ?? null) !== this.lastItem) {
      this.lastItem = item?.id ?? null;
      this.onItem?.(item);
    }

    const playing = this.active >= 0 ? this.decks[this.active] : null;
    if (!item || !item.src) {
      if (playing) this.fadeOut(this.active);
      this.active = -1;
      this.preload(now);
      return;
    }

    if (playing && playing.item?.id === item.id) {
      const expected = (now - item.origin) / 1000;
      const el = playing.el;
      if (el.readyState >= 2 && !el.seeking && Math.abs(el.currentTime - expected) > 1.5) el.currentTime = Math.max(0, expected);
      if (el.paused && el.readyState >= 2) void el.play().catch(() => this.onBlocked?.());
      this.preload(now);
      return;
    }

    const target = this.decks.findIndex((deck) => deck.item?.id === item.id);
    const index = target >= 0 ? target : this.active === 0 ? 1 : 0;
    if (playing) this.fadeOut(this.active);
    this.active = index;
    const deck = this.decks[index];
    if (deck.item?.id !== item.id) this.load(deck, item);
    this.begin(deck, item);
  }

  private load(deck: Deck, item: RadioItem) {
    deck.item = item;
    deck.ready = false;
    deck.el.src = item.src!;
    deck.el.load();
  }

  private begin(deck: Deck, item: RadioItem) {
    const ctx = this.ctx!;
    const start = () => {
      if (deck.item?.id !== item.id) return;
      deck.el.currentTime = Math.max(0, (this.clock.now() - item.origin) / 1000);
      deck.gain.gain.cancelScheduledValues(ctx.currentTime);
      deck.gain.gain.setValueAtTime(0, ctx.currentTime);
      deck.gain.gain.linearRampToValueAtTime(this.gainFor(item), ctx.currentTime + 0.35);
      void deck.el.play().catch(() => this.onBlocked?.());
    };
    if (deck.el.readyState >= 1) start();
    else deck.el.addEventListener("loadedmetadata", start, { once: true });
  }

  private fadeOut(index: number) {
    const deck = this.decks[index];
    if (!deck || !this.ctx) return;
    const t = this.ctx.currentTime;
    deck.gain.gain.cancelScheduledValues(t);
    deck.gain.gain.setValueAtTime(deck.gain.gain.value, t);
    deck.gain.gain.linearRampToValueAtTime(0, t + 0.4);
    const item = deck.item;
    window.setTimeout(() => {
      if (deck.item === item && index !== this.active) deck.el.pause();
    }, 450);
  }

  /** Loads the next song in the free deck a few seconds before it starts. */
  private preload(now: number) {
    const next = this.queue.find((item) => item.start > now && item.src);
    if (!next || next.start - now > 25000) return;
    if (this.decks.some((deck) => deck.item?.id === next.id)) return;
    const free = this.active === 0 ? 1 : 0;
    this.load(this.decks[free], next);
  }
}

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

type ControlMessage = { t: "mix"; mix: RadioMix; rev: number } | { t: "fx"; fx: RadioFx };

/** The listener side of the live microphone. */
export class VoiceLink {
  status: "off" | "connecting" | "on" = "off";
  onStatus?: (status: VoiceLink["status"]) => void;
  onMix?: (mix: RadioMix, rev: number) => void;
  onFx?: (fx: RadioFx) => void;

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
            if (data.t === "fx") this.onFx?.(data.fx);
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
