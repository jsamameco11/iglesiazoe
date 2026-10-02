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
