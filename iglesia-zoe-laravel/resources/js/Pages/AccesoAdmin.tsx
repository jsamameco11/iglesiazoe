import { Head, useForm, usePage } from "@inertiajs/react";
import { useState, type CSSProperties } from "react";
import { useSitePalette } from "@/Components/site/palette-scope";
import { readPairs, useCopy } from "@/lib/copy";
import type { SiteSettings } from "@/lib/types";

type Audience = "admin" | "superadmin";
type Props = { next?: string | null; audience: Audience; siteUrl: string; siteLabel: string };

const field =
  "mt-1.5 w-full rounded-2xl border border-line bg-white px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-muted/60 focus:border-ink/40 focus:ring-4 focus:ring-ink/5";

export default function AccesoAdmin({ next, audience, siteUrl, siteLabel }: Props) {
  const t = useCopy();
  const { settings } = usePage().props as unknown as { settings?: SiteSettings };
  const { style, attrs } = useSitePalette();
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm({ username: "", password: "", audience, next: next || "" });
  const points = readPairs(settings, "panel.points").map((pair) => pair.text);
  const error = form.errors.username || form.errors.password || form.errors.audience;

  const options: { key: Audience; title: string; note: string }[] = [
    { key: "admin", title: t("panel.admin"), note: t("panel.adminNote") },
    { key: "superadmin", title: t("panel.super"), note: t("panel.superNote") },
  ];

  return (
    <div data-skin="aire" {...attrs} className="min-h-screen bg-paper lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]" style={style as CSSProperties}>
      <Head title={t("panel.title")} />

      <section className="relative overflow-hidden bg-ink px-6 py-10 text-white sm:px-10 lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:px-14 lg:py-14">
        <div className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-orange/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-36 left-1/4 h-72 w-72 rounded-full bg-sky/10 blur-3xl" />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-orange">{t("panel.kicker")}</p>
          <h1 className="mt-5 max-w-lg text-[2.4rem] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-5xl lg:text-[3.6rem]">{t("panel.title")}</h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-white/65 sm:text-[15px]">{t("panel.text")}</p>
        </div>
        {points.length > 0 && (
          <ul className="relative mt-8 hidden max-w-md gap-3 sm:grid lg:mt-0">
            {points.map((point) => (
              <li key={point} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange" />
                {point}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex items-start justify-center px-5 py-10 sm:px-10 lg:min-h-screen lg:items-center lg:py-14">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            form.post("/acceso", { preserveScroll: true, onFinish: () => form.reset("password") });
          }}
          className="w-full max-w-md"
        >
          <fieldset>
            <legend className="text-sm font-semibold">{t("panel.choose")}</legend>
            <div role="radiogroup" className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {options.map((option) => {
                const on = form.data.audience === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      form.setData("audience", option.key);
                      form.clearErrors();
                    }}
                    className={`rounded-2xl border p-4 text-left transition ${on ? "border-ink bg-ink text-white shadow-[0_18px_40px_-24px_rgba(20,20,20,0.6)]" : "border-line bg-white hover:border-ink/30"}`}
                  >
                    <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                      {option.title}
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] ${on ? "border-white bg-white text-ink" : "border-line"}`}>{on ? "✓" : ""}</span>
                    </span>
                    <span className={`mt-1.5 block text-xs leading-5 ${on ? "text-white/70" : "text-muted"}`}>{option.note}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">{error}</p>
          )}

          <label className="mt-6 block text-xs font-semibold text-muted">
            {t("panel.user")}
            <input
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={form.data.username}
              onChange={(event) => form.setData("username", event.target.value)}
              className={field}
            />
          </label>
          <label className="mt-4 block text-xs font-semibold text-muted">
            {t("panel.password")}
            <span className="relative block">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={form.data.password}
                onChange={(event) => form.setData("password", event.target.value)}
                className={`${field} pr-20`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 mt-[3px] -translate-y-1/2 rounded-full px-2.5 py-1 text-xs font-semibold text-muted hover:text-ink"
              >
                {showPassword ? "Ocultar" : "Ver"}
              </button>
            </span>
          </label>

          <button
            disabled={form.processing}
            className="mt-7 inline-flex w-full items-center justify-center rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-60"
          >
            {form.processing ? "Ingresando…" : t("panel.button")}
          </button>

          <p className="mt-8 border-t border-line pt-6 text-sm leading-6 text-muted">
            <a href={siteUrl} className="underline-offset-4 hover:text-ink hover:underline">
              {t("panel.serverLink")}
            </a>
            <span className="block text-xs text-muted/80">{siteLabel}</span>
          </p>
        </form>
      </section>
    </div>
  );
}
