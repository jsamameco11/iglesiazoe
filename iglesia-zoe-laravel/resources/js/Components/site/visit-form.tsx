import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { SelectField, type SelectOption } from "@/Components/ui/select-field";
import { submitVisit } from "@/lib/actions";
import { flagUrl, geo, type GeoCountry, type GeoPlace } from "@/lib/geo";

const SEXES = ["Masculino", "Femenino"];
const MARITAL = ["Soltero(a)", "Casado(a)", "Conviviente", "Divorciado(a)", "Separado(a)", "Viudo(a)"];
const DEFAULT_COUNTRY = "PE";

type Errors = Partial<Record<"first_name" | "last_name" | "sex" | "age" | "marital_status" | "country" | "phone" | "email" | "region", string>>;

const input = "visit-input";

function Flag({ code }: { code: string }) {
  return <img src={flagUrl(code)} alt="" width={20} height={14} loading="lazy" className="visit-flag" />;
}

function digits(value: string, max: number) {
  return value.replace(/\D/g, "").slice(0, max);
}

export function VisitForm({
  cta = "Quiero visitarlos",
  sunday = "Domingo 10:00 a.m.",
  wednesday = "Miércoles 8:00 p.m.",
}: {
  cta?: string;
  sunday?: string;
  wednesday?: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [countries, setCountries] = useState<GeoCountry[]>([]);
  const [regions, setRegions] = useState<GeoPlace[]>([]);
  const [cities, setCities] = useState<GeoPlace[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [loading, setLoading] = useState({ countries: true, regions: false, cities: false, districts: false });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [sex, setSex] = useState("");
  const [age, setAge] = useState("");
  const [marital, setMarital] = useState("");
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [dialKey, setDialKey] = useState(`${DEFAULT_COUNTRY}:51`);
  const [dialTouched, setDialTouched] = useState(false);
  const dial = dialKey.split(":")[1] ?? "";
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [regionId, setRegionId] = useState("");
  const [cityId, setCityId] = useState("");
  const [district, setDistrict] = useState("");
  const [service, setService] = useState(sunday);

  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<{ ok?: boolean; error?: string }>({});
  const [pending, setPending] = useState(false);

  const countryMeta = countries.find((item) => item.code === country);
  const labels = countryMeta?.labels ?? ["Estado o departamento", "Provincia o ciudad", "Distrito"];
  const hasCity = labels.length > 1;
  const hasDistrict = labels.length > 2;

  useEffect(() => {
    geo
      .countries()
      .then(setCountries)
      .catch(() => setStatus({ error: "No pudimos cargar la lista de países. Recarga la página." }))
      .finally(() => setLoading((state) => ({ ...state, countries: false })));
  }, []);

  useEffect(() => {
    setRegions([]);
    setRegionId("");
    if (!country) return;
    setLoading((state) => ({ ...state, regions: true }));
    let alive = true;
    geo
      .regions(country)
      .then((rows) => alive && setRegions(rows))
      .finally(() => alive && setLoading((state) => ({ ...state, regions: false })));
    return () => {
      alive = false;
    };
  }, [country]);

  useEffect(() => {
    setCities([]);
    setCityId("");
    if (!regionId || !hasCity) return;
    setLoading((state) => ({ ...state, cities: true }));
    let alive = true;
    geo
      .cities(Number(regionId))
      .then((rows) => alive && setCities(rows))
      .finally(() => alive && setLoading((state) => ({ ...state, cities: false })));
    return () => {
      alive = false;
    };
  }, [regionId, hasCity]);

  useEffect(() => {
    setDistricts([]);
    setDistrict("");
    if (!cityId || !hasDistrict) return;
    setLoading((state) => ({ ...state, districts: true }));
    let alive = true;
    geo
      .districts(Number(cityId))
      .then((rows) => alive && setDistricts(rows))
      .finally(() => alive && setLoading((state) => ({ ...state, districts: false })));
    return () => {
      alive = false;
    };
  }, [cityId, hasDistrict]);

  useEffect(() => {
    if (!dialTouched && countryMeta) setDialKey(`${countryMeta.code}:${countryMeta.dial}`);
  }, [countryMeta, dialTouched]);

  const countryOptions = useMemo<SelectOption[]>(
    () => countries.map((item) => ({ value: item.code, label: item.name, prefix: <Flag code={item.code} /> })),
    [countries],
  );
  const dialOptions = useMemo<SelectOption[]>(
    () =>
      countries.map((item) => ({
        value: `${item.code}:${item.dial}`,
        label: `+${item.dial}`,
        hint: item.name,
        prefix: <Flag code={item.code} />,
      })),
    [countries],
  );
  const regionOptions = useMemo(() => regions.map((item) => ({ value: String(item.id), label: item.name })), [regions]);
  const cityOptions = useMemo(() => cities.map((item) => ({ value: String(item.id), label: item.name })), [cities]);
  const districtOptions = useMemo(() => districts.map((name) => ({ value: name, label: name })), [districts]);
  const serviceOptions = useMemo(() => [sunday, wednesday].filter(Boolean).map((item) => ({ value: item, label: item })), [sunday, wednesday]);

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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Escribe un correo válido.";
    if (!regionId) next.region = `Elige tu ${labels[0].toLowerCase()}.`;
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
    setRegionId("");
    setService(sunday);
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
    data.set("phone_code", dial);
    data.set("phone", phone);
    data.set("email", email.trim());
    data.set("region", regions.find((item) => String(item.id) === regionId)?.name ?? "");
    data.set("city", cities.find((item) => String(item.id) === cityId)?.name ?? "");
    data.set("district", district);
    data.set("service", service);

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
      {status.ok && <p className="visit-note is-ok">¡Gracias! Recibimos tus datos y te esperamos con los brazos abiertos.</p>}
      {status.error && <p className="visit-note is-error">{status.error}</p>}

      <div className="visit-row cols-2">
        <label className="visit-label">
          <span className="text-sm">Nombres</span>
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
          <span className="text-sm">Apellidos</span>
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
          label="Sexo"
          value={sex}
          options={SEXES.map((item) => ({ value: item, label: item }))}
          onChange={(value) => {
            setSex(value);
            clearError("sex");
          }}
          error={errors.sex}
        />
        <label className="visit-label">
          <span className="text-sm">Edad</span>
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
            placeholder="Años"
            aria-invalid={errors.age ? true : undefined}
          />
          {errors.age && <span className="select-field-error">{errors.age}</span>}
        </label>
        <SelectField
          label="Estado civil"
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
          label="País"
          value={country}
          options={countryOptions}
          loading={loading.countries}
          onChange={(value) => {
            setCountry(value);
            setDialTouched(false);
            clearError("country");
          }}
          error={errors.country}
          searchable
        />
        <div className="visit-label">
          <span className="text-sm">Teléfono</span>
          <div className="visit-phone">
            <SelectField
              label="Código"
              value={dialKey}
              options={dialOptions}
              loading={loading.countries}
              onChange={(value) => {
                setDialKey(value);
                setDialTouched(true);
              }}
              renderValue={(option) => (
                <>
                  {option.prefix}
                  {option.label}
                </>
              )}
              searchable
              compact
              className="visit-dial"
            />
            <input
              className={input}
              value={phone}
              onChange={(event) => {
                setPhone(digits(event.target.value, 15));
                clearError("phone");
              }}
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="Número"
              aria-label="Número de teléfono"
              aria-invalid={errors.phone ? true : undefined}
            />
          </div>
          {errors.phone && <span className="select-field-error">{errors.phone}</span>}
        </div>
      </div>

      <label className="visit-label">
        <span className="text-sm">Correo electrónico</span>
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

      <div className={`visit-row ${hasCity ? "cols-2" : ""}`}>
        <SelectField
          label={labels[0]}
          value={regionId}
          options={regionOptions}
          loading={loading.regions}
          disabled={!country}
          placeholder={country ? "Selecciona" : "Elige primero el país"}
          onChange={(value) => {
            setRegionId(value);
            clearError("region");
          }}
          error={errors.region}
          searchable
        />
        {hasCity && (
          <SelectField
            label={labels[1]}
            value={cityId}
            options={cityOptions}
            loading={loading.cities}
            disabled={!regionId}
            placeholder={regionId ? "Selecciona" : `Elige primero ${labels[0].toLowerCase()}`}
            onChange={setCityId}
            optional
            searchable
          />
        )}
      </div>

      <div className="visit-row cols-2">
        {hasDistrict && (
          <SelectField
            label={labels[2]}
            value={district}
            options={districtOptions}
            loading={loading.districts}
            disabled={!cityId}
            placeholder={cityId ? "Selecciona" : `Elige primero ${labels[1].toLowerCase()}`}
            onChange={setDistrict}
            optional
            searchable
          />
        )}
        <SelectField label="Servicio al que asistirás" value={service} options={serviceOptions} onChange={setService} />
      </div>

      <button type="submit" disabled={pending} className="visit-submit">
        {pending ? "Enviando…" : cta}
      </button>
    </form>
  );
}
