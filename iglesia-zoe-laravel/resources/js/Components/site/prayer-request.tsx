import { usePage } from "@inertiajs/react";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { submitPrayer } from "@/lib/actions";
import { useCopy } from "@/lib/copy";
import type { SiteSettings } from "@/lib/types";

const MAX = 2000;

function HandsIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-9 w-9" aria-hidden="true">
      <path d="M24 40V22l-6-11c-1-1.8-3.6-1-3.4 1l1.4 11-4 5v12" />
      <path d="M24 40V22l6-11c1-1.8 3.6-1 3.4 1L32 23l4 5v12" />
      <path d="M24 6v4M16 8l1.6 3.4M32 8l-1.6 3.4" />
    </svg>
  );
}

export function PrayerRequestForm() {
  const { settings } = usePage().props as unknown as { settings?: SiteSettings };
  const topics = Array.isArray(settings?.prayerTopics) ? settings.prayerTopics : [];
  const t = useCopy();
  const form = useRef<HTMLFormElement>(null);
  const [topic, setTopic] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [pending, start] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("full_name") || "").trim();
    if (name.length < 3) return setError("Escribe tu nombre.");
    if (text.trim().length < 8) return setError("Cuéntanos un poco más sobre tu petición (mínimo 8 caracteres).");
    setError("");
    start(async () => {
      const result = await submitPrayer(undefined, data);
      if (result?.ok) {
        setSentTo(name.split(" ")[0]);
        form.current?.reset();
        setTopic("");
        setText("");
      } else {
        setError(result?.error || "No pudimos enviar tu petición. Inténtalo otra vez.");
      }
    });
  }

  if (sentTo) {
    return (
      <div className="prayer-sent" role="status">
        <span className="prayer-sent-glow" aria-hidden="true" />
        <span className="prayer-sent-icon"><HandsIcon /></span>
        <p className="editorial mt-6 text-[2.1rem] leading-tight">Gracias, {sentTo}.</p>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-7 text-muted">
          {t("prayer.thanks")}
        </p>
        <p className="editorial mt-5 text-lg italic text-muted">{t("prayer.thanksVerse")}</p>
        <button type="button" onClick={() => setSentTo("")} className="prayer-again">Enviar otra petición</button>
      </div>
    );
  }

  return (
    <form ref={form} onSubmit={submit} className="visit-form" noValidate>
      {topics.length > 0 && (
      <fieldset className="min-w-0">
        <legend className="text-sm">¿Por qué motivo oramos? <span className="text-muted">(opcional)</span></legend>
        <div className="prayer-topics">
          {topics.map((item) => (
            <label key={item} className="prayer-topic" data-on={topic === item ? "true" : "false"}>
              <input
                type="radio"
                name="topic"
                value={item}
                checked={topic === item}
                onChange={() => setTopic(item)}
                onClick={() => topic === item && setTopic("")}
                className="sr-only"
              />
              {item}
            </label>
          ))}
        </div>
      </fieldset>
      )}

      <label className="visit-label text-sm">
        Nombre
        <input name="full_name" required minLength={3} maxLength={120} autoComplete="name" placeholder="¿Cómo te llamas?" className="visit-input" />
      </label>

      <div className="visit-row cols-2">
        <label className="visit-label text-sm">
          Teléfono <span className="sr-only">(opcional)</span>
          <input name="phone" inputMode="tel" maxLength={30} autoComplete="tel" placeholder="Opcional" className="visit-input" />
        </label>
        <label className="visit-label text-sm">
          Correo <span className="sr-only">(opcional)</span>
          <input name="email" type="email" maxLength={160} autoComplete="email" placeholder="Opcional" className="visit-input" />
        </label>
      </div>

      <label className="visit-label text-sm">
        Tu petición
        <textarea
          name="request"
          required
          rows={5}
          maxLength={MAX}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Cuéntanos por quién o por qué situación quieres que oremos."
          className="visit-input resize-none leading-7"
        />
        <span className="mt-1.5 self-end text-[11px] text-muted">{text.length} / {MAX}</span>
      </label>

      <p className="text-[12.5px] leading-5 text-muted">{t("prayer.privacy")}</p>

      {error && <p className="visit-note is-error" role="alert">{error}</p>}

      <button disabled={pending} className="visit-submit prayer-submit">
        <span>{pending ? "Enviando…" : "Enviar mi petición"}</span>
      </button>
    </form>
  );
}
