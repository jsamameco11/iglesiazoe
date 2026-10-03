import { useEffect, useMemo, useState } from "react";
import { SelectField, type SelectOption } from "@/Components/ui/select-field";
import { Flag } from "@/Components/site/icons";
import { geo, type GeoCountry } from "@/lib/geo";
import { digits } from "@/lib/text";

/** Must match FormsController::SEXES and FormsController::MARITAL_STATUSES, which validate them. */
export const SEXES = ["Masculino", "Femenino"];
export const MARITAL = ["Soltero(a)", "Casado(a)", "Conviviente", "Divorciado(a)", "Separado(a)", "Viudo(a)"];

const DEFAULT_DIAL = "PE:51";

/** Countries for the public forms, with a phone code that follows the chosen country until the person picks one. */
export function useCountryDial(country: string) {
  const [countries, setCountries] = useState<GeoCountry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialKey, setDialKey] = useState(DEFAULT_DIAL);
  const [dialTouched, setDialTouched] = useState(false);
  const countryMeta = countries.find((item) => item.code === country);

  useEffect(() => {
    geo
      .countries()
      .then(setCountries)
      .catch(() => setError("No pudimos cargar la lista de países. Recarga la página."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!dialTouched && countryMeta) setDialKey(`${countryMeta.code}:${countryMeta.dial}`);
  }, [countryMeta, dialTouched]);

  const countryOptions = useMemo<SelectOption[]>(
    () => countries.map((item) => ({ value: item.code, label: item.name, prefix: <Flag code={item.code} /> })),
    [countries],
  );
  const dialOptions = useMemo<SelectOption[]>(
    () => countries.map((item) => ({ value: `${item.code}:${item.dial}`, label: `+${item.dial}`, hint: item.name, prefix: <Flag code={item.code} /> })),
    [countries],
  );

  return {
    loading,
    error,
    countryMeta,
    countryOptions,
    dialOptions,
    dialKey,
    dial: dialKey.split(":")[1] ?? "",
    pickDial: (value: string) => {
      setDialKey(value);
      setDialTouched(true);
    },
    followCountry: () => setDialTouched(false),
    reset: () => {
      setDialKey(DEFAULT_DIAL);
      setDialTouched(false);
    },
  };
}

type CountryDial = ReturnType<typeof useCountryDial>;

/** Phone code picker and number as a single labelled field. */
export function PhoneField({
  label,
  numberLabel,
  placeholder,
  dial,
  phone,
  onPhone,
  error,
}: {
  label: string;
  numberLabel: string;
  placeholder: string;
  dial: CountryDial;
  phone: string;
  onPhone: (value: string) => void;
  error?: string;
}) {
  return (
    <div className="visit-label">
      <span className="text-sm">{label}</span>
      <div className="visit-phone">
        <SelectField
          label="Código"
          value={dial.dialKey}
          options={dial.dialOptions}
          loading={dial.loading}
          onChange={dial.pickDial}
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
          className="visit-input"
          value={phone}
          onChange={(event) => onPhone(digits(event.target.value, 15))}
          inputMode="tel"
          autoComplete="tel-national"
          placeholder={placeholder}
          aria-label={numberLabel}
          aria-invalid={error ? true : undefined}
        />
      </div>
      {error && <span className="select-field-error">{error}</span>}
    </div>
  );
}
