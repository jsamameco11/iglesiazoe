import { useRef, useState, useTransition, type FormEvent } from "react";
import { SelectField } from "@/Components/ui/select-field";
import { submitServe } from "@/lib/actions";
import { useCopy } from "@/lib/copy";
import type { ServeArea } from "@/lib/types";

const MARITAL = ["Soltero(a)", "Casado(a)", "Conviviente", "Divorciado(a)", "Separado(a)", "Viudo(a)"];
const MAX_NOTES = 800;

type Field = "serve_area_id" | "first_name" | "last_name" | "age" | "marital_status" | "phone" | "email";
type Errors = Partial<Record<Field, string>>;

/** «Regístrate para servir»: lands in the panel under Formularios → Quieren servir. */
export function ServeForm({ areas, initialArea = "" }: { areas: ServeArea[]; initialArea?: string }) {
  const t = useCopy();
  const form = useRef<HTMLFormElement>(null);
  const [areaId, setAreaId] = useState(initialArea);
  const [team, setTeam] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [marital, setMarital] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState("");
  const [sent, setSent] = useState<{ name: string; area: string } | null>(null);
  const [pending, start] = useTransition();

  const area = areas.find((item) => item.id === areaId);
  const clearError = (key: Field) => setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));

  function validate(): Errors {
    const next: Errors = {};
    if (!area) next.serve_area_id = "Elige un área.";
    if (firstName.trim().length < 2) next.first_name = "Escribe tus nombres.";
    if (lastName.trim().length < 2) next.last_name = "Escribe tus apellidos.";
    const years = Number(age);
    if (!age || years < 8 || years > 100) next.age = "Edad entre 8 y 100.";
    if (!marital) next.marital_status = "Elige una opción.";
    if (phone.replace(/\D/g, "").length < 6) next.phone = "Escribe tu teléfono.";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Escribe un correo válido.";
    return next;
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
    data.set("serve_area_id", areaId);
    data.set("team", team);
    data.set("first_name", firstName.trim());
    data.set("last_name", lastName.trim());
    data.set("age", age);
    data.set("marital_status", marital);
    data.set("phone", phone.trim());
    data.set("email", email.trim());
    data.set("notes", notes.trim());

    setError("");
    start(async () => {
      const result = await submitServe(data);
      if (result?.ok) {
        setSent({ name: firstName.trim().split(" ")[0], area: area?.name ?? "" });
        setTeam("");
        setFirstName("");
        setLastName("");
        setAge("");
        setMarital("");
        setPhone("");
        setEmail("");
        setNotes("");
      } else {
        setError(result?.error || "No pudimos enviar tu registro. Inténtalo otra vez.");
      }
    });
  }

  if (sent) {
    return (
      <div className="serve-sent" role="status">
        <span className="serve-sent-icon" aria-hidden="true">✓</span>
        <p className="editorial mt-6 text-[1.9rem] leading-tight text-ink">{t("serve.thanks").replace("{nombre}", sent.name).replace("{area}", sent.area)}</p>
        <button type="button" onClick={() => setSent(null)} className="serve-sent-again">{t("serve.again")}</button>
      </div>
    );
  }

  return (
    <form ref={form} onSubmit={submit} className="visit-form" noValidate>
      <div className="visit-row cols-2">
        <SelectField
          label={t("serve.area")}
          value={areaId}
          options={areas.map((item) => ({ value: item.id, label: item.name, hint: item.tagline ?? undefined }))}
          onChange={(value) => {
            setAreaId(value);
            setTeam("");
            clearError("serve_area_id");
          }}
          error={errors.serve_area_id}
        />
        <SelectField
          label={t("serve.team")}
          value={team}
          optional
          disabled={!area || !area.teams.length}
          placeholder={t("serve.teamAny")}
          options={[{ value: "", label: t("serve.teamAny") }, ...(area?.teams ?? []).map((item) => ({ value: item, label: item }))]}
          onChange={setTeam}
        />
      </div>

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
          <span className="text-sm">{t("forms.phone")}</span>
          <input
            className="visit-input"
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value.replace(/[^\d+\s-]/g, "").slice(0, 20));
              clearError("phone");
            }}
            inputMode="tel"
            autoComplete="tel"
            placeholder={t("forms.phonePlaceholder")}
            aria-invalid={errors.phone ? true : undefined}
          />
          {errors.phone && <span className="select-field-error">{errors.phone}</span>}
        </label>
        <label className="visit-label">
          <span className="text-sm">
            {t("forms.email")} <span className="select-field-optional">{t("forms.optional")}</span>
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
        <span>
          {t("serve.notes")} <span className="select-field-optional">{t("forms.optional")}</span>
        </span>
        <textarea
          rows={3}
          maxLength={MAX_NOTES}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder={t("serve.notesPlaceholder")}
          className="visit-input resize-none leading-7"
        />
      </label>

      {error && <p className="visit-note is-error" role="alert">{error}</p>}

      <button disabled={pending} className="visit-submit">
        {pending ? t("forms.sending") : t("serve.submit")}
      </button>
    </form>
  );
}
