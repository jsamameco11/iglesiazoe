import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { MARITAL, PhoneField, SEXES, useCountryDial } from "@/Components/site/person-fields";
import { SelectField, type SelectOption } from "@/Components/ui/select-field";
import { submitVisit } from "@/lib/actions";
import { useCopy } from "@/lib/copy";
import { citiesOf, cityName, districtsOf, geo, type GeoTree } from "@/lib/geo";
import { digits } from "@/lib/text";

type Errors = Partial<Record<"first_name" | "last_name" | "phone" | "email" | "sex" | "age" | "marital_status" | "service", string>>;

const input = "visit-input";

export function VisitForm({
  cta = "Quiero visitarlos",
  sunday = "Domingo 10:00 a.m.",
  wednesday = "Miércoles 8:00 p.m.",
}: {
  cta?: string;
  sunday?: string;
  wednesday?: string;
}) {
  const t = useCopy();
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [tree, setTree] = useState<GeoTree>([]);
  const [loadingTree, setLoadingTree] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [sex, setSex] = useState("");
  const [age, setAge] = useState("");
  const [marital, setMarital] = useState("");
  const [service, setService] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const dial = useCountryDial(country);

  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<{ ok?: boolean; error?: string }>({});
  const [pending, setPending] = useState(false);

  const labels = dial.countryMeta?.labels ?? ["Estado o departamento", "Provincia o ciudad", "Distrito"];
  const hasCity = labels.length > 1;
  const hasDistrict = labels.length > 2;
  const services = useMemo(() => [sunday, wednesday].filter(Boolean), [sunday, wednesday]);

  useEffect(() => {
    setTree([]);
    setRegion("");
    setCity("");
    setDistrict("");
    if (!country) return;
    setLoadingTree(true);
    let alive = true;
    geo
      .tree(country)
      .then((rows) => alive && setTree(rows))
      .catch(() => alive && setStatus({ error: "No pudimos cargar la lista de lugares. Recarga la página." }))
      .finally(() => alive && setLoadingTree(false));
    return () => {
      alive = false;
    };
  }, [country]);

  const countryOptions = useMemo<SelectOption[]>(() => [{ value: "", label: "Prefiero no indicarlo" }, ...dial.countryOptions], [dial.countryOptions]);
  const cities = useMemo(() => (region && hasCity ? citiesOf(tree, region) : []), [tree, region, hasCity]);
  const regionOptions = useMemo(() => tree.map(([name]) => ({ value: name, label: name })), [tree]);
  const cityOptions = useMemo(() => cities.map((item) => ({ value: cityName(item), label: cityName(item) })), [cities]);
  const districtOptions = useMemo(
    () => (city && hasDistrict ? districtsOf(cities, city) : []).map((name) => ({ value: name, label: name })),
    [cities, city, hasDistrict],
  );

  const clearError = (key: keyof Errors) => setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));

  const validate = (): Errors => {
    const next: Errors = {};
    if (firstName.trim().length < 2) next.first_name = "Escribe tus nombres.";
    if (lastName.trim().length < 2) next.last_name = "Escribe tus apellidos.";
    if (phone.length < 6) next.phone = "Escribe tu número de celular.";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Escribe un correo válido o déjalo vacío.";
    if (!sex) next.sex = "Elige una opción.";
    const ageNumber = Number(age);
    if (!age || ageNumber < 1 || ageNumber > 120) next.age = "Edad entre 1 y 120.";
    if (!marital) next.marital_status = "Elige una opción.";
    if (!service) next.service = "Elige el servicio al que asistirás.";
    return next;
  };

  const reset = () => {
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setSex("");
    setAge("");
    setMarital("");
    setService("");
    setCountry("");
    dial.reset();
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
    data.set("phone_code", dial.dial);
    data.set("phone", phone);
    data.set("email", email.trim());
    data.set("sex", sex);
    data.set("age", age);
    data.set("marital_status", marital);
    data.set("service", service);
    data.set("country_code", country);
    data.set("region", region);
    data.set("city", city);
    data.set("district", district);

    setPending(true);
    const result = await submitVisit(undefined, data);
    setPending(false);
    if (result?.ok) {
      setStatus({ ok: true });
      reset();
    } else {
      setStatus({ error: result?.error || "No pudimos enviar tus datos. Inténtalo otra vez." });
    }
  };

  return (
    <form ref={form} onSubmit={onSubmit} noValidate className="visit-form">
      {status.ok && (
        <p className="visit-note is-ok" role="status">
          {t("visit.thanks")}
        </p>
      )}
      {(status.error || dial.error) && (
        <p className="visit-note is-error" role="alert">
          {status.error || dial.error}
        </p>
      )}

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

      <div className="visit-row cols-2">
        <PhoneField
          label={t("visit.mobile")}
          numberLabel="Número de celular"
          placeholder={t("forms.phonePlaceholder")}
          dial={dial}
          phone={phone}
          onPhone={(value) => {
            setPhone(value);
            clearError("phone");
          }}
          error={errors.phone}
        />
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

      <fieldset className="visit-label">
        <legend className="text-sm">{t("visit.service")}</legend>
        <div className="visit-services" role="radiogroup" aria-invalid={errors.service ? true : undefined}>
          {services.map((item, index) => (
            <label key={item} className={`visit-service ${service === item ? "is-on" : ""}`}>
              <input
                type="radio"
                name={`${id}-service`}
                value={item}
                checked={service === item}
                onChange={() => {
                  setService(item);
                  clearError("service");
                }}
                aria-invalid={errors.service && index === 0 ? true : undefined}
              />
              <span className="visit-service-dot" aria-hidden="true" />
              <span>{item}</span>
            </label>
          ))}
        </div>
        {errors.service && <span className="select-field-error">{errors.service}</span>}
      </fieldset>

      <fieldset className="visit-origin">
        <legend className="visit-origin-title">
          {t("visit.origin")} <span className="select-field-optional">{t("forms.optional")}</span>
        </legend>
        <p className="visit-origin-hint">{t("visit.originHint")}</p>
        <div className="visit-row cols-2">
          <SelectField
            label={t("forms.country")}
            value={country}
            options={countryOptions}
            loading={dial.loading}
            onChange={(value) => {
              setCountry(value);
              dial.followCountry();
            }}
            searchable
          />
          {country && (
            <SelectField
              label={labels[0]}
              value={region}
              options={regionOptions}
              loading={loadingTree}
              onChange={(value) => {
                setRegion(value);
                setCity("");
                setDistrict("");
              }}
              optional
              searchable
            />
          )}
        </div>
        {country && region && (hasCity || hasDistrict) && (
          <div className="visit-row cols-2">
            {hasCity && (
              <SelectField
                label={labels[1]}
                value={city}
                options={cityOptions}
                onChange={(value) => {
                  setCity(value);
                  setDistrict("");
                }}
                optional
                searchable
              />
            )}
            {hasDistrict && (
              <SelectField
                label={labels[2]}
                value={district}
                options={districtOptions}
                disabled={!city}
                placeholder={city ? "Selecciona" : `Elige primero ${labels[1].toLowerCase()}`}
                onChange={setDistrict}
                optional
                searchable
              />
            )}
          </div>
        )}
      </fieldset>

      <button type="submit" disabled={pending} className="visit-submit">
        {pending ? t("forms.sending") : cta}
      </button>
    </form>
  );
}
