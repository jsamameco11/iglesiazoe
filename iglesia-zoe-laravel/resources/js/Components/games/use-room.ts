import { useCallback, useEffect, useRef, useState } from "react";
import { getJson, postJson, roomToken, type Reply, type RoomBase } from "@/lib/games";

const EVERY_MS = 1500;
const HIDDEN_MS = 5000;

export type RoomLink = "live" | "gone" | "closed";

/**
 * Keeps a live room in sync: polls its state, sends moves with the player's token and
 * notices when the player was removed or the room was closed.
 */
export function useRoom<T extends RoomBase>(code: string, token: string | null) {
  const [room, setRoom] = useState<T | null>(null);
  const [link, setLink] = useState<RoomLink>("live");
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const version = useRef(0);

  const take = useCallback(
    (reply: Reply<T>) => {
      if (reply.status === 403 || reply.left) {
        roomToken.forget(code);
        setLink("gone");
        return false;
      }
      if (reply.status === 410 || reply.closed) {
        roomToken.forget(code);
        setLink("closed");
        return false;
      }
      if (reply.status === 0) {
        setOffline(true);
        return false;
      }
      setOffline(false);
      if (reply.error) return false;
      if (reply.version >= version.current) {
        version.current = reply.version;
        setRoom(reply);
      }
      return true;
    },
    [code],
  );

  const refresh = useCallback(async () => {
    if (!token) return;
    take(await getJson<T>(`/juegos/salas/${code}`, token));
  }, [code, token, take]);

  useEffect(() => {
    if (!token || link !== "live") return;
    let stopped = false;
    let timer = 0;
    const loop = async () => {
      await refresh();
      if (!stopped) timer = window.setTimeout(loop, document.hidden ? HIDDEN_MS : EVERY_MS);
    };
    void loop();
    const wake = () => {
      if (!document.hidden) {
        window.clearTimeout(timer);
        void loop();
      }
    };
    document.addEventListener("visibilitychange", wake);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [token, link, refresh]);

  const act = useCallback(
    async (action: string, payload: Record<string, unknown> = {}): Promise<Reply<T>> => {
      setBusy(true);
      setError("");
      const reply = await postJson<T>(`/juegos/salas/${code}`, { action, ...payload }, token);
      setBusy(false);
      if (!take(reply) && reply.error && reply.status !== 403 && reply.status !== 410) setError(reply.error);
      return reply;
    },
    [code, token, take],
  );

  return { room, link, offline, error, setError, busy, act };
}
