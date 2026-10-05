import { send, type ActionResult } from "@/lib/actions";
import { postWithProgress } from "./admin-ui";

type Opened = { direct?: boolean; token?: string; partSize?: number; urls?: string[]; error?: string };
type Part = { n: number; etag: string };
type Sent = { token: string; parts: Part[] };

const BEGIN = "/admin/radio/subida";
const CANCEL = "/admin/radio/subida/cancelar";
/** Parts going up at the same time. */
const PARALLEL = 4;
const ATTEMPTS = 5;
/** Share of the progress bar the audio fills; the rest is saving the form. */
const AUDIO_SHARE = 0.97;
const CUT = "Se cortó la conexión mientras subía el audio. Revisa tu internet e inténtalo de nuevo.";

/** Audios already in Wasabi whose form failed, so a retry does not send them again. */
const stored = new WeakMap<File, Sent>();

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Sends one part to its signed address and returns the ETag Wasabi gives it. */
function putPart(url: string, body: Blob, onProgress: (bytes: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (event) => onProgress(event.loaded);
    xhr.onload = () => {
      const etag = xhr.getResponseHeader("ETag");
      if (xhr.status >= 200 && xhr.status < 300 && etag) resolve(etag.replace(/"/g, ""));
      else reject(new Error(`Wasabi answered ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(body);
  });
}

/**
 * Sends the audio straight to Wasabi in parts, several at a time, retrying each part on its own.
 * Null when the server keeps files itself (no Wasabi), so the file must go with the form.
 */
async function sendToStorage(file: File, kind: string, onProgress: (value: number) => void): Promise<Sent | { error: string } | null> {
  const known = stored.get(file);
  if (known) return known;

  let opened: Opened;
  try {
    opened = (await send(BEGIN, { name: file.name, size: String(file.size), kind })) as Opened;
  } catch {
    return { error: CUT };
  }
  if (opened.error) return { error: opened.error };
  if (!opened.direct || !opened.token || !opened.partSize || !opened.urls?.length) return null;

  const { token, partSize, urls } = opened;
  const loaded = urls.map(() => 0);
  const parts: Part[] = [];
  let next = 0;
  let failed = false;
  const report = () => onProgress(Math.min(1, loaded.reduce((sum, bytes) => sum + bytes, 0) / file.size));

  async function worker() {
    while (!failed && next < urls.length) {
      const index = next++;
      const body = file.slice(index * partSize, Math.min(file.size, (index + 1) * partSize));
      for (let attempt = 1; ; attempt++) {
        try {
          const etag = await putPart(urls[index], body, (bytes) => {
            loaded[index] = bytes;
            report();
          });
          loaded[index] = body.size;
          report();
          parts.push({ n: index + 1, etag });
          break;
        } catch {
          loaded[index] = 0;
          report();
          if (failed || attempt >= ATTEMPTS) {
            failed = true;
            return;
          }
          await wait(1000 * 2 ** (attempt - 1));
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(PARALLEL, urls.length) }, worker));
  if (failed) {
    send(CANCEL, { token }).catch(() => undefined);
    return { error: CUT };
  }
  const sent = { token, parts: parts.sort((first, second) => first.n - second.n) };
  stored.set(file, sent);
  return sent;
}

/**
 * Saves a radio form that carries an audio. With Wasabi the audio goes straight there and the form only
 * carries the finished upload; without it (a local machine) the file travels with the form as before.
 */
export async function postAudio(url: string, data: FormData, file: File, kind: string, onProgress: (value: number) => void = () => undefined): Promise<ActionResult> {
  data.delete("audio");
  const sent = await sendToStorage(file, kind, (value) => onProgress(value * AUDIO_SHARE));
  if (sent === null) {
    data.set("audio", file);
    return postWithProgress(url, data, onProgress);
  }
  if ("error" in sent) return { error: sent.error };

  data.set("upload", sent.token);
  data.set("parts", JSON.stringify(sent.parts));
  const result = await postWithProgress(url, data);
  if (!result.error) {
    stored.delete(file);
    onProgress(1);
  } else if (result.again) {
    stored.delete(file);
  }
  return result;
}
