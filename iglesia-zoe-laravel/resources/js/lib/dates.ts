/** The church's timezone: every "today" and calendar day on the site is counted in Lima. */
export const LIMA = "America/Lima";

/** Calendar day in Lima as YYYY-MM-DD, whatever the visitor's own timezone is. */
export function limaDate(ms: number = Date.now()) {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: LIMA });
}
