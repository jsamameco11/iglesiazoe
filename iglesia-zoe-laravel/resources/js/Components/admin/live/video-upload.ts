import { csrf } from "@/lib/actions";

const RETRIES = 6;

async function post(url: string, body: FormData, signal: AbortSignal) {
  const response = await fetch(url, {
    method: "POST",
    body,
    signal,
    headers: { "X-CSRF-TOKEN": csrf(), "X-Requested-With": "XMLHttpRequest", Accept: "application/json" },
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok, status: response.status, data };
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const id = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      window.clearTimeout(id);
      reject(new DOMException("Cancelado", "AbortError"));
    });
  });
}

/**
 * Sends a large video to the server in parts. A part that fails is retried; if the server
 * already has more (or less) than expected, the upload continues from what it reports.
 * Resolves with the upload token the publish action needs.
 */
export async function uploadVideo(file: File, onProgress: (fraction: number) => void, signal: AbortSignal): Promise<string> {
  const start = new FormData();
  start.set("name", file.name);
  start.set("size", String(file.size));
  const begun = await post("/admin/recursos/video/iniciar", start, signal);
  if (!begun.ok) throw new Error(String(begun.data.error || "No se pudo empezar la subida."));

  const upload = String(begun.data.upload);
  const chunk = Number(begun.data.chunk) || 16 * 1024 * 1024;
  let offset = Number(begun.data.offset) || 0;
  let failures = 0;

  while (offset < file.size) {
    const part = new FormData();
    part.set("upload", upload);
    part.set("offset", String(offset));
    part.set("chunk", file.slice(offset, Math.min(offset + chunk, file.size)), "part");
    try {
      const sent = await post("/admin/recursos/video/parte", part, signal);
      if (sent.status === 422 && sent.data.error && !String(sent.data.error).includes("Reintentando")) {
        throw new Error(String(sent.data.error));
      }
      if (!sent.ok) throw new TypeError(String(sent.data.error || "network"));
      offset = Number(sent.data.offset);
      failures = 0;
      onProgress(offset / file.size);
    } catch (error) {
      if (signal.aborted || (error instanceof Error && !(error instanceof TypeError))) throw error;
      failures++;
      if (failures > RETRIES) throw new Error("Se perdió la conexión varias veces. Revisa el internet y vuelve a intentarlo.");
      await wait(Math.min(30000, 1500 * 2 ** failures), signal);
    }
  }

  return upload;
}
