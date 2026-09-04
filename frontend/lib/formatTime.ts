export const IST_TIMEZONE = "Asia/Kolkata"

// Backend stores timestamps as naive UTC (datetime.utcnow().isoformat(), no "Z"
// and no offset). `new Date(iso)` on a naive string would interpret it as the
// browser's LOCAL time — wrong by the UTC<->local offset. To render these
// correctly as Indian Standard Time we must first tell JS the string is UTC by
// appending "Z", then format in Asia/Kolkata. This is the single source of
// truth for all wall-clock rendering across the app.
export function fmtIST(
  iso: string | null | undefined,
  dateStyle: "medium" | "long" | "short" | "full" = "medium",
  timeStyle: "short" | "medium" | "long" | "full" = "short"
): string {
  if (!iso) return "—"
  const z = iso.endsWith("Z") ? iso : `${iso}Z`
  const d = new Date(z)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace("T", " ")
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIMEZONE,
    dateStyle,
    timeStyle,
  }).format(d)
}

// Compact wall-clock for tight cells (timeline/log rows): "07:22 AM".
export function fmtISTTimeOnly(iso: string | null | undefined): string {
  if (!iso) return "—"
  const z = iso.endsWith("Z") ? iso : `${iso}Z`
  const d = new Date(z)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace("T", " ")
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIMEZONE,
    timeStyle: "short",
  }).format(d)
}

// Short date for compact contexts: "18 Jul 2026".
export function fmtISTDateOnly(iso: string | null | undefined): string {
  if (!iso) return "—"
  const z = iso.endsWith("Z") ? iso : `${iso}Z`
  const d = new Date(z)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace("T", " ")
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIMEZONE,
    dateStyle: "medium",
  }).format(d)
}
