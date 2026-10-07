import { csrf } from "@/lib/actions";
import type { Broadcaster } from "./voice";

export type CaptureBrief = {
  id: string;
  status: "recording" | "ready" | "saved" | "discarded";
  bytes: number;
  duration: number | null;
  parts: number;
  stale?: boolean;
};

type CaptureResponse = {
  ok?: boolean;
  error?: string;
  code?: string;
  message?: string;
  recording?: CaptureBrief;
};

async function postCapture(data: FormData): Promise<CaptureResponse> {
  const response = await fetch("/admin/radio/grabacion", {
    method: "POST",
    body: data,
    headers: { "X-CSRF-TOKEN": csrf(), Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
  });
  return response.json().catch(() => ({}));
}

function form(fields: Record<string, string>) {
  const body = new FormData();
  Object.entries(fields).forEach(([key, value]) => body.set(key, value));
  return body;
}

/**
 * Uploads the live microphone in order while the transmission is open.
 * A failed piece is retried; a piece the server already has is not sent twice in the file.
 */
export class LiveCapture {
  id: string | null = null;
  done = false;
  private chain: Promise<void> = Promise.resolve();
  private failed = false;

  constructor(private caster: Broadcaster) {}

  async start(session: string): Promise<CaptureResponse> {
    const opened = await postCapture(form({ action: "start", session }));
    if (!opened.ok || !opened.recording) return opened;
    this.id = opened.recording.id;
    const recording = opened.recording.id;
    const started = this.caster.startRecording((blob, index) => {
      this.chain = this.chain.then(() => this.send(recording, blob, index));
    });
    if (!started) {
      await postCapture(form({ action: "discard", id: recording }));
      this.id = null;
      return { error: "Este navegador no pudo grabar la transmisión. El vivo sigue al aire." };
    }
    return opened;
  }

  async finish(duration: number): Promise<CaptureBrief | null> {
    if (this.done || !this.id) return null;
    this.done = true;
    const measured = await this.caster.stopRecording();
    try {
      await this.chain;
    } catch {
      this.failed = true;
    }
    const closed = await postCapture(form({ action: "finish", id: this.id, duration: String(duration || measured) }));
    return closed.recording ?? null;
  }

  private async send(id: string, blob: Blob, index: number) {
    if (this.failed) return;
    const extension = this.caster.recordingExtension();
    let last: CaptureResponse = {};
    for (let attempt = 0; attempt < 3; attempt++) {
      const body = form({ action: "chunk", id, index: String(index), extension });
      body.set("audio", blob, `tramo-${index}.${extension}`);
      last = await postCapture(body);
      if (last.ok || last.code === "have" || last.code === "full") break;
      await new Promise((resolve) => window.setTimeout(resolve, 700 * (attempt + 1)));
    }
    if (last.code === "full") this.failed = true;
    if (!last.ok && last.code !== "have" && last.code !== "full") {
      this.failed = true;
    }
  }
}
