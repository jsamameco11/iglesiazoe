import { copyDefault, copyGroups, readCopy } from "@/lib/copy";
import type { SiteSettings } from "@/lib/types";

export type CopyGroup = (typeof copyGroups)[number];

const field = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

/** Inputs of one group of site texts, named copy[key] for /admin/textos. */
export function CopyFields({ settings, group, columns = true }: { settings: SiteSettings; group: CopyGroup; columns?: boolean }) {
  return (
    <div className={`grid gap-4 ${columns ? "md:grid-cols-2" : ""}`}>
      {group.entries.map((entry) => {
        const area = "area" in entry && entry.area;
        const hint = "hint" in entry ? entry.hint : undefined;
        const value = readCopy(settings, entry.key);
        return (
          <label key={entry.key} className={`text-sm ${area && columns ? "md:col-span-2" : ""}`}>
            {entry.label}
            {area ? (
              <textarea name={`copy[${entry.key}]`} defaultValue={value} rows={Math.min(8, Math.max(3, value.split("\n").length + 1))} className={field} />
            ) : (
              <input name={`copy[${entry.key}]`} defaultValue={value} className={field} />
            )}
            {hint ? <span className="mt-1 block text-xs leading-5 text-muted">{hint}</span> : null}
          </label>
        );
      })}
    </div>
  );
}

/** A text left equal to the original is sent empty, so it keeps following the original. */
export function blankDefaults(formData: FormData, groups: readonly CopyGroup[] = copyGroups) {
  groups.forEach((group) =>
    group.entries.forEach((entry) => {
      const name = `copy[${entry.key}]`;
      if (formData.has(name) && String(formData.get(name) ?? "").replace(/\r\n/g, "\n").trim() === copyDefault(entry.key).trim()) formData.set(name, "");
    }),
  );
  return formData;
}
