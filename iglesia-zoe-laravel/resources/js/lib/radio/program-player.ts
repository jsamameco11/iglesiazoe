import type { RadioItem, RadioLayer, RadioMix } from "./types";
import { currentItem } from "./queue";
import type { ServerClock } from "./client";

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

type Deck = { el: HTMLAudioElement; gain: GainNode; item: RadioItem | null; ready: boolean; fadingUntil: number };

type Voice = { layer: RadioLayer; el: HTMLAudioElement; gain: GainNode; source: MediaElementAudioSourceNode; started: boolean; done: boolean };

/** Layers up to this long are effects: they always play from the start, unless they arrive too late. */
const SHORT_LAYER = 20000;

const LATE_EFFECT = 6000;

const PRELOAD = 25000;

/**
 * The program as every listener hears it: two decks that follow the server timeline
 * (crossfading songs that overlap), a music bus driven by the console faders, and the
 * layers bus where pads, players and overlay blocks sound at the same time, lowering
 * the music while a layer that asks for it plays.
 */
export class ProgramPlayer {
  ctx: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  clock: ServerClock;
  onItem?: (item: RadioItem | null) => void;
  onBlocked?: () => void;
  onLayers?: (playing: string[]) => void;

  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private duckBus: GainNode | null = null;
  private fxBus: GainNode | null = null;
  private decks: Deck[] = [];
  private active = -1;
  private queue: RadioItem[] = [];
  private layers: RadioLayer[] = [];
  private voices = new Map<string, Voice>();
  private skipped = new Set<string>();
  private ducking = false;
  private mix: RadioMix = { music: 1, fx: 0.9, bed: 0.22, duck: 0.25 };
  private volume = 0.9;
  private timer = 0;
  private lastItem: string | null = null;
  private lastPlaying = "";

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
      this.duckBus = ctx.createGain();
      this.fxBus = ctx.createGain();
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.78;
      this.musicBus.connect(this.duckBus).connect(this.master);
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
        return { el, gain, item: null, ready: false, fadingUntil: 0 };
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
    [...this.voices.keys()].forEach((id) => this.release(id, 0));
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

  /** Layers from the server state: pads and players of the console and overlay blocks. */
  setLayers(layers: RadioLayer[]) {
    const pushed = this.layers.filter((layer) => layer.source === "live" && !layers.some((item) => item.id === layer.id) && this.clock.now() - layer.start < 8000);
    this.layers = [...layers, ...pushed];
    if (this.running) this.syncLayers(this.clock.now());
  }

  /** A layer that arrived before the next poll (fired here or through the live link). */
  pushLayer(layer: RadioLayer) {
    this.layers = [...this.layers.filter((item) => item.id !== layer.id), layer];
    if (this.running) this.syncLayers(this.clock.now());
  }

  dropLayers(ids: string[]) {
    this.layers = this.layers.filter((layer) => !ids.includes(layer.id));
    ids.forEach((id) => this.release(id, 0.25));
    if (this.running) this.syncLayers(this.clock.now());
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
    this.duckBus?.gain.setTargetAtTime(this.ducking ? this.mix.duck : 1, t, this.ducking ? 0.12 : 0.45);
    this.decks.forEach((deck, index) => {
      if (index === this.active) deck.gain.gain.setTargetAtTime(this.gainFor(deck.item), t, Math.max(0.01, seconds / 3));
    });
  }

  private tick() {
    if (!this.ctx) return;
    const now = this.clock.now();
    this.syncLayers(now);
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

    // A song that starts while the previous one still sounds is a crossfade over the overlap.
    const outgoing = playing?.item;
    const overlap = outgoing && outgoing.end > now + 400 && now - item.start < 2000 ? (outgoing.end - now) / 1000 : 0;
    const fade = Math.min(12, Math.max(0.35, overlap));
    const target = this.decks.findIndex((deck) => deck.item?.id === item.id);
    const index = target >= 0 ? target : this.active === 0 ? 1 : 0;
    if (playing) this.fadeOut(this.active, fade);
    this.active = index;
    const deck = this.decks[index];
    if (deck.item?.id !== item.id) this.load(deck, item);
    this.begin(deck, item, fade);
  }

  private load(deck: Deck, item: RadioItem) {
    deck.item = item;
    deck.ready = false;
    deck.el.src = item.src!;
    deck.el.load();
  }

  private begin(deck: Deck, item: RadioItem, fade: number) {
    const ctx = this.ctx!;
    const start = () => {
      if (deck.item?.id !== item.id) return;
      deck.el.currentTime = Math.max(0, (this.clock.now() - item.origin) / 1000);
      deck.gain.gain.cancelScheduledValues(ctx.currentTime);
      deck.gain.gain.setValueAtTime(0, ctx.currentTime);
      deck.gain.gain.linearRampToValueAtTime(this.gainFor(item), ctx.currentTime + fade);
      void deck.el.play().catch(() => this.onBlocked?.());
    };
    if (deck.el.readyState >= 1) start();
    else deck.el.addEventListener("loadedmetadata", start, { once: true });
  }

  private fadeOut(index: number, seconds = 0.4) {
    const deck = this.decks[index];
    if (!deck || !this.ctx) return;
    const t = this.ctx.currentTime;
    deck.gain.gain.cancelScheduledValues(t);
    deck.gain.gain.setValueAtTime(deck.gain.gain.value, t);
    deck.gain.gain.linearRampToValueAtTime(0, t + seconds);
    deck.fadingUntil = performance.now() + seconds * 1000 + 100;
    const item = deck.item;
    window.setTimeout(() => {
      if (deck.item === item && index !== this.active) deck.el.pause();
    }, seconds * 1000 + 50);
  }

  /** Loads the next song in the free deck a few seconds before it starts (never over a song fading out). */
  private preload(now: number) {
    const next = this.queue.find((item) => item.start > now && item.src);
    if (!next || next.start - now > PRELOAD) return;
    if (this.decks.some((deck) => deck.item?.id === next.id)) return;
    const free = this.decks[this.active === 0 ? 1 : 0];
    if (free.fadingUntil > performance.now()) return;
    this.load(free, next);
  }

  /** Starts, follows and stops the layer voices, and lowers the music while a ducking layer sounds. */
  private syncLayers(now: number) {
    if (!this.ctx || !this.fxBus) return;
    const wanted = new Map(this.layers.filter((layer) => layer.src && layer.end > now).map((layer) => [layer.id, layer]));

    this.voices.forEach((voice, id) => {
      const short = voice.layer.end - voice.layer.start <= SHORT_LAYER;
      const stopped = !wanted.has(id) && voice.layer.end > now + 300;
      const ended = !short && voice.layer.end <= now;
      if (voice.done || stopped || ended) this.release(id, stopped ? 0.25 : 0.6);
    });

    wanted.forEach((layer) => {
      const voice = this.voices.get(layer.id);
      if (voice) {
        voice.layer = layer;
        this.follow(voice, now);
        return;
      }
      if (this.skipped.has(layer.id) || layer.start - now > PRELOAD) return;
      const short = layer.end - layer.start <= SHORT_LAYER;
      if (short && now - layer.start > LATE_EFFECT) {
        this.skipped.add(layer.id);
        return;
      }
      this.voices.set(layer.id, this.voice(layer));
      this.follow(this.voices.get(layer.id)!, now);
    });

    const playing = [...this.voices.values()].filter((voice) => voice.started && !voice.done);
    const ducking = playing.some((voice) => voice.layer.duck);
    if (ducking !== this.ducking) {
      this.ducking = ducking;
      this.applyGains(0.25);
    }
    const ids = playing.map((voice) => voice.layer.id).join(",");
    if (ids !== this.lastPlaying) {
      this.lastPlaying = ids;
      this.onLayers?.(playing.map((voice) => voice.layer.id));
    }
  }

  private voice(layer: RadioLayer): Voice {
    const ctx = this.ctx!;
    const el = new Audio();
    el.crossOrigin = "anonymous";
    el.preload = "auto";
    el.src = layer.src;
    const gain = ctx.createGain();
    gain.gain.value = layer.volume / 100;
    const source = ctx.createMediaElementSource(el);
    source.connect(gain).connect(this.fxBus!);
    const voice: Voice = { layer, el, gain, source, started: false, done: false };
    el.onended = el.onerror = () => {
      voice.done = true;
      if (this.running) this.syncLayers(this.clock.now());
    };
    return voice;
  }

  /** Effects start from the beginning when their time comes; long layers follow the clock like the program. */
  private follow(voice: Voice, now: number) {
    const { layer, el, gain } = voice;
    gain.gain.setTargetAtTime(layer.volume / 100, this.ctx!.currentTime, 0.06);
    if (now < layer.start - 60) return;
    const short = layer.end - layer.start <= SHORT_LAYER;
    const expected = (now - layer.start) / 1000;
    if (!voice.started) {
      voice.started = true;
      const begin = () => {
        if (!short) el.currentTime = Math.max(0, (this.clock.now() - layer.start) / 1000);
        void el.play().catch(() => this.onBlocked?.());
      };
      if (el.readyState >= 1) begin();
      else el.addEventListener("loadedmetadata", begin, { once: true });
      return;
    }
    if (!short && el.readyState >= 2 && !el.seeking && Math.abs(el.currentTime - expected) > 1.5) el.currentTime = Math.max(0, expected);
  }

  private release(id: string, seconds: number) {
    const voice = this.voices.get(id);
    if (!voice) return;
    this.voices.delete(id);
    const done = () => {
      voice.el.pause();
      voice.el.removeAttribute("src");
      voice.source.disconnect();
    };
    if (!this.ctx || seconds <= 0 || voice.done) return done();
    voice.gain.gain.setTargetAtTime(0, this.ctx.currentTime, seconds / 3);
    window.setTimeout(done, seconds * 1000 + 80);
  }
}
