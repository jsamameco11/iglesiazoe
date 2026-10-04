import { useCallback, useEffect, useRef, useState } from "react";
import type { useStation } from "@/Components/radio/listener/use-station";
import { currentItem, type RadioItem, type RadioSpotifyPlaylist } from "@/lib/radio";

type PlaybackUpdate = { data: { isPaused: boolean; isBuffering: boolean; duration: number; position: number } };

type EmbedController = {
  loadUri: (uri: string) => void;
  play: () => void;
  resume: () => void;
  pause: () => void;
  destroy: () => void;
  addListener: (event: "ready" | "playback_update", callback: (event: PlaybackUpdate) => void) => void;
};

type IFrameApi = {
  createController: (element: HTMLElement, options: { uri: string; width?: string | number; height?: string | number }, callback: (controller: EmbedController) => void) => void;
};

type SpotifyWindow = Window & { onSpotifyIframeApiReady?: (api: IFrameApi) => void };

/** Longest a Spotify song may keep playing after a change is due before the change is forced. */
const MAX_FINISH = 10 * 60000;

/** Without sound this long after asking Spotify to play, the browser wants a tap inside its player. */
const TAP_AFTER = 5000;

/** Spotify stopped by itself this long after the end of a song: the playlist ended and starts over. */
const REPLAY_AFTER = 3000;

let loader: Promise<IFrameApi> | null = null;

/** Spotify's iFrame API, loaded once per page. */
function spotifyApi(): Promise<IFrameApi> {
  loader ??= new Promise((resolve) => {
    const host = window as SpotifyWindow;
    const previous = host.onSpotifyIframeApiReady;
    host.onSpotifyIframeApiReady = (api) => {
      previous?.(api);
      resolve(api);
    };
    const script = document.createElement("script");
    script.src = "https://open.spotify.com/embed/iframe-api/v1";
    script.async = true;
    document.body.appendChild(script);
  });
  return loader;
}

const uri = (playlist: RadioSpotifyPlaylist) => `spotify:playlist:${playlist.url.split("/playlist/")[1]?.split("?")[0] ?? ""}`;

/** A song of the station's automatic music (not a scheduled block, a live bed or a program). */
const isStationMusic = (item: RadioItem) => item.kind === "musica" && item.slot === null && item.block === null && !item.bed;

/**
 * The Spotify side of the automatic music for one listener. When the station's source is a
 * Spotify playlist, its gaps are silent and this plays the playlist in Spotify's own player.
 * Scheduled blocks and the live signal still win at their exact time. A change of source never
 * cuts a song: from the station, Spotify starts once the station's last song has faded out;
 * towards the station or another playlist, the Spotify song on air finishes first (the station
 * stays silent meanwhile). The listener never picks songs: the player is a display, the
 * playlist plays in its order and starts over when it ends.
 */
export function useSpotifyAir(station: ReturnType<typeof useStation>) {
  const { state, now, playing, hold } = station;
  const source = state.source ?? null;
  const target = source ? (source.changing && now >= source.since ? source.next : source.spotify) : null;
  const involved = source?.spotify ?? source?.next ?? null;
  const item = currentItem(state.queue, now);
  const stationTakes = !state.on_air || state.live.on || Boolean(state.live.cut) || (item !== null && !isStationMusic(item));

  const controller = useRef<EmbedController | null>(null);
  const element = useRef<HTMLDivElement | null>(null);
  const loaded = useRef<string | null>(null);
  const started = useRef(false);
  const last = useRef({ duration: 0, position: 0 });
  /** A change waiting for the Spotify song to end: the next playlist, or null to hand back to the station. */
  const finishing = useRef<{ next: RadioSpotifyPlaylist | null; since: number } | null>(null);
  const decision = useRef("");
  const [ready, setReady] = useState(false);
  const [sounding, setSounding] = useState(false);
  const [shown, setShown] = useState<RadioSpotifyPlaylist | null>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const soundingRef = useRef(false);
  /** This page wants Spotify sounding, and since when it asked (null once it sounds). */
  const wanted = useRef(false);
  const asked = useRef<number | null>(null);
  const replay = useRef<number | null>(null);

  const load = useCallback((playlist: RadioSpotifyPlaylist) => {
    controller.current?.loadUri(uri(playlist));
    loaded.current = playlist.id;
    started.current = false;
    setShown(playlist);
  }, []);

  const start = useCallback(() => {
    const embed = controller.current;
    if (!embed) return;
    if (started.current) embed.resume();
    else embed.play();
    started.current = true;
    wanted.current = true;
    asked.current ??= Date.now();
  }, []);

  const stop = useCallback(() => {
    if (soundingRef.current) controller.current?.pause();
    wanted.current = false;
    asked.current = null;
    setNeedsTap(false);
  }, []);

  /** Makes a change that waited for the song to end. */
  const finish = useCallback(() => {
    const change = finishing.current;
    finishing.current = null;
    decision.current = "";
    if (!change) return;
    if (change.next) {
      load(change.next);
      start();
    } else {
      stop();
    }
    hold(false);
  }, [hold, load, start, stop]);

  const involvedRef = useRef(involved);
  involvedRef.current = involved;
  const hasSpotify = involved !== null;

  const mount = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) {
        controller.current?.destroy();
        controller.current = null;
        element.current = null;
        loaded.current = null;
        setReady(false);
        return;
      }
      const first = involvedRef.current;
      if (element.current === node || !hasSpotify || !first) return;
      element.current = node;
      const slot = document.createElement("div");
      node.replaceChildren(slot);
      void spotifyApi().then((api) => {
        if (element.current !== node) return;
        api.createController(slot, { uri: uri(first), width: "100%", height: 80 }, (embed) => {
          controller.current = embed;
          loaded.current = first.id;
          setShown(first);
          embed.addListener("ready", () => setReady(true));
          embed.addListener("playback_update", ({ data }) => {
            const before = last.current;
            const changedTrack = before.duration > 0 && data.duration > 0 && Math.abs(data.duration - before.duration) > 1000;
            const restarted = before.position > 3000 && data.position + 3000 < before.position;
            const ending = data.duration > 0 && data.duration - data.position <= 800;
            const endedBefore = before.duration > 0 && before.duration - before.position <= 1500;
            last.current = { duration: data.duration, position: data.position };
            soundingRef.current = !data.isPaused;
            setSounding(!data.isPaused);
            if (!data.isPaused) {
              asked.current = null;
              setNeedsTap(false);
              if (replay.current !== null) window.clearTimeout(replay.current);
              replay.current = null;
            }
            if (finishing.current && (data.isPaused || changedTrack || restarted || ending)) {
              finish();
            } else if (data.isPaused && wanted.current && (ending || endedBefore) && replay.current === null) {
              replay.current = window.setTimeout(() => {
                replay.current = null;
                if (wanted.current && !soundingRef.current && !finishing.current) controller.current?.play();
              }, REPLAY_AFTER);
            }
          });
        });
      });
    },
    [hasSpotify, finish],
  );

  useEffect(() => {
    const embed = controller.current;
    if (!embed || !ready) return;

    if (finishing.current) {
      if (!playing || stationTakes || now - finishing.current.since > MAX_FINISH) {
        finishing.current = null;
        if (!playing || stationTakes) {
          embed.pause();
          stop();
        }
        hold(false);
        decision.current = "";
      }
      return;
    }

    const handBack = item !== null && isStationMusic(item);
    let next: string;
    if (!playing || stationTakes) next = "pause";
    else if (handBack) next = soundingRef.current ? "finish-station" : "station";
    else if (!target) next = "pause";
    else if (loaded.current === target.id) next = `play-${target.id}`;
    else next = soundingRef.current ? `finish-${target.id}` : `load-${target.id}`;

    if (next === decision.current) return;
    decision.current = next;

    if (next === "pause" || next === "station") {
      stop();
      hold(false);
    } else if (next === "finish-station") {
      hold(true);
      finishing.current = { next: null, since: now };
    } else if (next.startsWith("finish-") && target) {
      finishing.current = { next: target, since: now };
    } else if (next.startsWith("load-") && target) {
      load(target);
      start();
      hold(false);
    } else {
      start();
      hold(false);
    }
  }, [hold, item, load, now, playing, ready, start, stop, stationTakes, target]);

  useEffect(() => {
    if (asked.current !== null && !needsTap && Date.now() - asked.current > TAP_AFTER) setNeedsTap(true);
  }, [needsTap, now]);

  useEffect(
    () => () => {
      hold(false);
      if (replay.current !== null) window.clearTimeout(replay.current);
    },
    [hold],
  );

  /** Spotify fills the automatic music for this listener right now. */
  const active = Boolean(target) && state.on_air && !stationTakes && item === null;
  /** The playlist this listener hears: the one loaded while its song finishes, otherwise the one due. */
  const playlist = sounding && shown ? shown : target;

  return { mount, ready, sounding, active, target, playlist, involved, needsTap, waiting: source?.changing && now < (source?.since ?? 0) ? source : null };
}
