import { useMemo, useRef, useState, type FormEvent } from "react";
import { MARITAL, PhoneField, SEXES, useCountryDial } from "@/Components/site/person-fields";
import { SelectField } from "@/Components/ui/select-field";
import { submitBaptism } from "@/lib/actions";
import { useCopy } from "@/lib/copy";
import { digits } from "@/lib/text";

const DEFAULT_COUNTRY = "PE";

type BaptismEventOption = { id: string; event_date: string | null; location: string | null };
type Errors = Partial<Record<"first_name" | "last_name" | "sex" | "age" | "marital_status" | "country" | "phone" | "email", string>>;

const input = "visit-input";

function eventLabel(event: BaptismEventOption, fallback: string) {
  const date = event.event_date
    ? new Date(event.event_date + "T12:00:00").toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" })
    : fallback;
  return event.location ? `${date} · ${event.location}` : date;
}

export function BaptismForm({
  events,
  cta = "¡Quiero bautizarme!",
  fallback = "Fecha por confirmar",
}: {
  events: BaptismEventOption[];
  cta?: string;
  fallback?: string;
}) {
  const t = useCopy();
  const form = useRef<HTMLFormElement>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [sex, setSex] = useState("");
  const [age, setAge] = useState("");
  const [marital, setMarital] = useState("");
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const dial = useCountryDial(country);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [notes, setNotes] = useState("");

  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<{ ok?: boolean; error?: string }>({});
  const [pending, setPending] = useState(false);

  const eventOptions = useMemo(() => events.map((event) => ({ value: event.id, label: eventLabel(event, fallback) })), [events, fallback]);

  const clearError = (key: keyof Errors) => setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));

  const validate = (): Errors => {
    const next: Errors = {};
    if (firstName.trim().length < 2) next.first_name = "Escribe tus nombres.";
    if (lastName.trim().length < 2) next.last_name = "Escribe tus apellidos.";
    if (!sex) next.sex = "Elige una opción.";
    const ageNumber = Number(age);
    if (!age || ageNumber < 1 || ageNumber > 120) next.age = "Edad entre 1 y 120.";
    if (!marital) next.marital_status = "Elige una opción.";
    if (!country) next.country = "Elige tu país.";
    if (phone.length < 6) next.phone = "Escribe un teléfono válido.";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Escribe un correo válido.";
    return next;
  };

  const reset = () => {
    setFirstName("");
    setLastName("");
    setSex("");
    setAge("");
    setMarital("");
    setPhone("");
    setEmail("");
    setNotes("");
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      setStatus({});
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }

    const data = new FormData();
    data.set("first_name", firstName.trim());
    data.set("last_name", lastName.trim());
    data.set("sex", sex);
    data.set("age", age);
    data.set("marital_status", marital);
    data.set("country_code", country);
    data.set("phone_code", dial.dial);
    data.set("phone", phone);
    data.set("email", email.trim());
    if (eventId) data.set("event_id", eventId);
    data.set("notes", notes.trim());

    setPending(true);
    const result = await submitBaptism(undefined, data);
    setPending(false);
    if (result?.ok) {
      setStatus({ ok: true });
      reset();
    } else {
      setStatus({ error: result?.error || "No pudimos enviar tu inscripción. Inténtalo otra vez." });
    }
  };

  return (
    <form ref={form} onSubmit={onSubmit} noValidate className="visit-form">
      {status.ok && <p className="visit-note is-ok">{t("baptism.thanks")}</p>}
      {(status.error || dial.error) && <p className="visit-note is-error">{status.error || dial.error}</p>}

      <div className="visit-row cols-2">
        <label className="visit-label">
          <span className="text-sm">{t("forms.firstName")}</span>
          <input
            className={input}
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
            className={input}
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
      </div>

      <div className="visit-row cols-3">
        <SelectField
          label={t("forms.sex")}
          value={sex}
          options={SEXES.map((item) => ({ value: item, label: item }))}
          onChange={(value) => {
            setSex(value);
            clearError("sex");
          }}
          error={errors.sex}
        />
        <label className="visit-label">
          <span className="text-sm">{t("forms.age")}</span>
          <input
            className={input}
            value={age}
            onChange={(event) => {
              setAge(digits(event.target.value, 3));
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
      </div>

      <div className="visit-row cols-2">
        <SelectField
          label={t("forms.country")}
          value={country}
          options={dial.countryOptions}
          loading={dial.loading}
          onChange={(value) => {
            setCountry(value);
            dial.followCountry();
            clearError("country");
          }}
          error={errors.country}
          searchable
        />
        <PhoneField
          label={t("forms.phone")}
          numberLabel="Número de teléfono"
          placeholder={t("forms.phonePlaceholder")}
          dial={dial}
          phone={phone}
          onPhone={(value) => {
            setPhone(value);
            clearError("phone");
          }}
          error={errors.phone}
        />
      </div>

      <label className="visit-label">
        <span className="text-sm">
          {t("forms.email")} <span className="select-field-optional">{t("forms.optional")}</span>
        </span>
        <input
          className={input}
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            clearError("email");
          }}
          autoComplete="email"
          maxLength={160}
          aria-invalid={errors.email ? true : undefined}
        />
        {errors.email && <span className="select-field-error">{errors.email}</span>}
      </label>

      {eventOptions.length > 0 && <SelectField label={t("baptism.date")} value={eventId} options={eventOptions} onChange={setEventId} />}

      <label className="visit-label">
        <span className="text-sm">
          {t("baptism.story")} <span className="select-field-optional">{t("forms.optional")}</span>
        </span>
        <textarea
          className={`${input} resize-none`}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          maxLength={800}
        />
      </label>

      <button type="submit" disabled={pending} className="visit-submit">
        {pending ? t("forms.sending") : cta}
      </button>
    </form>
  );
}
