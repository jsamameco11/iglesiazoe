import { Link } from "@inertiajs/react";
import { useActionState } from "react";
import { submitQuickVisit } from "@/lib/actions";
import { useCopy } from "@/lib/copy";

export function QuickVisitForm() {
  const t = useCopy();
  const [state, action, pending] = useActionState(submitQuickVisit, undefined);

  if (state?.ok) {
    return <p className="visit-note is-ok">{t("home.quickThanks")}</p>;
  }

  return (
    <form action={action} className="visit-form">
      {state?.error && <p className="visit-note is-error">{state.error}</p>}
      <div className="visit-row cols-2">
        <label className="visit-label">
          <span className="text-sm">{t("home.quickName")}</span>
          <input name="full_name" className="visit-input" autoComplete="name" required minLength={3} maxLength={120} />
        </label>
        <label className="visit-label">
          <span className="text-sm">{t("home.quickContact")}</span>
          <input name="contact" className="visit-input" autoComplete="email" required maxLength={160} />
        </label>
      </div>
      <button type="submit" disabled={pending} className="visit-submit">
        {pending ? t("forms.sending") : t("home.quickSubmit")}
      </button>
      <Link href="/visita" className="home-link mt-1 justify-self-start text-sm">
        {t("home.quickMore")} →
      </Link>
    </form>
  );
}
