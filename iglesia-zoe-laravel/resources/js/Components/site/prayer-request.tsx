import { usePage } from "@inertiajs/react";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { SelectField } from "@/Components/ui/select-field";
import { submitPrayer } from "@/lib/actions";
import { useCopy } from "@/lib/copy";
import type { SiteSettings } from "@/lib/types";

const MAX = 2000;
const MARITAL = ["Soltero(a)", "Casado(a)", "Conviviente", "Divorciado(a)", "Separado(a)", "Viudo(a)"];

type Errors = Partial<Record<"first_name" | "last_name" | "age" | "marital_status" | "email" | "request", string>>;

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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [marital, setMarital] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [pending, start] = useTransition();

  const clearError = (key: keyof Errors) => setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));

  function validate(): Errors {
    const next: Errors = {};
    if (firstName.trim().length < 2) next.first_name = "Escribe tus nombres.";
    if (lastName.trim().length < 2) next.last_name = "Escribe tus apellidos.";
    const ageNumber = Number(age);
    if (!age || ageNumber < 1 || ageNumber > 120) next.age = "Edad entre 1 y 120.";
    if (!marital) next.marital_status = "Elige una opción.";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Escribe un correo válido.";
    if (text.trim().length < 8) next.request = "Cuéntanos un poco más sobre tu petición (mínimo 8 caracteres).";
    return next;
  }

  function reset() {
    setTopic("");
    setFirstName("");
    setLastName("");
    setAge("");
    setMarital("");
    setPhone("");
    setEmail("");
    setText("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      setError("");
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }

    const data = new FormData();
    if (topic) data.set("topic", topic);
    data.set("first_name", firstName.trim());
    data.set("last_name", lastName.trim());
    data.set("age", age);
    data.set("marital_status", marital);
    data.set("phone", phone.trim());
    data.set("email", email.trim());
    data.set("request", text.trim());

    setError("");
    start(async () => {
      const result = await submitPrayer(undefined, data);
      if (result?.ok) {
        setSentTo(firstName.trim().split(" ")[0]);
        reset();
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
        <p className="editorial mt-6 text-[2.1rem] leading-tight">{t("prayer.thanksHello").replace("{nombre}", sentTo)}</p>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-7 text-muted">
          {t("prayer.thanks")}
        </p>
        <p className="editorial mt-5 text-lg italic text-muted">{t("prayer.thanksVerse")}</p>
        <button type="button" onClick={() => setSentTo("")} className="prayer-again">{t("prayer.again")}</button>
      </div>
    );
  }

  return (
    <form ref={form} onSubmit={submit} className="visit-form" noValidate>
      {topics.length > 0 && (
      <fieldset className="min-w-0">
        <legend className="text-sm">{t("prayer.topicLabel")} <span className="text-muted">{t("forms.optional")}</span></legend>
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

      <div className="visit-row sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7.5rem]">
        <label className="visit-label">
          <span className="text-sm">{t("forms.firstName")}</span>
          <input
            className="visit-input"
            value={firstName}
            onChange={(event) => {
              setFirstName(event.target.value);
              clearError("first_name");
            }}
            autoComplete="given-name"
            maxLength={60}
            aria-invalid={errors.first_name ? true : undefined}
          />
          {errors.first_name && <span className="select-field-error">{errors.first_name}</span>}
        </label>
        <label className="visit-label">
          <span className="text-sm">{t("forms.lastName")}</span>
          <input
            className="visit-input"
            value={lastName}
            onChange={(event) => {
              setLastName(event.target.value);
              clearError("last_name");
            }}
            autoComplete="family-name"
            maxLength={80}
            aria-invalid={errors.last_name ? true : undefined}
          />
          {errors.last_name && <span className="select-field-error">{errors.last_name}</span>}
        </label>
        <label className="visit-label">
          <span className="text-sm">{t("forms.age")}</span>
          <input
            className="visit-input"
            value={age}
            onChange={(event) => {
              setAge(event.target.value.replace(/\D/g, "").slice(0, 3));
              clearError("age");
            }}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            placeholder={t("forms.agePlaceholder")}
            aria-invalid={errors.age ? true : undefined}
          />
          {errors.age && <span className="select-field-error">{errors.age}</span>}
        </label>
      </div>

      <div className="visit-row cols-3">
        <SelectField
          label={t("forms.marital")}
          value={marital}
          options={MARITAL.map((item) => ({ value: item, label: item }))}
          onChange={(value) => {
            setMarital(value);
            clearError("marital_status");
          }}
          error={errors.marital_status}
        />
        <label className="visit-label">
          <span className="text-sm">
            {t("prayer.phone")} <span className="select-field-optional">{t("forms.optional")}</span>
          </span>
          <input
            className="visit-input"
            value={phone}
            onChange={(event) => setPhone(event.target.value.replace(/[^\d+\s-]/g, "").slice(0, 30))}
            inputMode="tel"
            autoComplete="tel"
            placeholder={t("forms.phonePlaceholder")}
          />
        </label>
        <label className="visit-label">
          <span className="text-sm">
            {t("prayer.email")} <span className="select-field-optional">{t("forms.optional")}</span>
          </span>
          <input
            className="visit-input"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              clearError("email");
            }}
            maxLength={160}
            autoComplete="email"
            aria-invalid={errors.email ? true : undefined}
          />
          {errors.email && <span className="select-field-error">{errors.email}</span>}
        </label>
      </div>

      <label className="visit-label text-sm">
        {t("prayer.request")}
        <textarea
          name="request"
          required
          rows={5}
          maxLength={MAX}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            clearError("request");
          }}
          placeholder={t("prayer.requestPlaceholder")}
          className="visit-input resize-none leading-7"
          aria-invalid={errors.request ? true : undefined}
        />
        <span className="mt-1.5 flex justify-between gap-3 text-[11px]">
          <span className="select-field-error">{errors.request}</span>
          <span className="text-muted">{text.length} / {MAX}</span>
        </span>
      </label>

      <p className="text-[12.5px] leading-5 text-muted">{t("prayer.privacy")}</p>

      {error && <p className="visit-note is-error" role="alert">{error}</p>}

      <button disabled={pending} className="visit-submit prayer-submit">
        <span>{pending ? t("forms.sending") : t("prayer.submit")}</span>
      </button>
    </form>
  );
}
