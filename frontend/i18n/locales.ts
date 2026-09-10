/**
 * Supported UI locales (V5.0 multilingual platform).
 *
 * Codes are Sarvam/ICU region codes (`hi-IN`, not bare `hi`) so the locale id,
 * the message filename (`messages/<code>.json`), and the Sarvam translation
 * target are always the same string. No mapping layer, no drift.
 */

export const LOCALE_COOKIE = "locale";

export const DEFAULT_LOCALE = "en-IN";

export interface AppLocaleMeta {
  code: string;
  /** English label (for docs / fallbacks). */
  label: string;
  /** Native label (shown in the language picker). */
  native: string;
}

export const SUPPORTED_LOCALES: AppLocaleMeta[] = [
  { code: "en-IN", label: "English", native: "English" },
  { code: "hi-IN", label: "Hindi", native: "हिन्दी" },
  { code: "ta-IN", label: "Tamil", native: "தமிழ்" },
  { code: "te-IN", label: "Telugu", native: "తెలుగు" },
  { code: "kn-IN", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml-IN", label: "Malayalam", native: "മലയാളം" },
  { code: "mr-IN", label: "Marathi", native: "मराठी" },
];

export const SUPPORTED_LOCALE_CODES: string[] = SUPPORTED_LOCALES.map(
  (l) => l.code
);

export function resolveLocale(raw: string | null | undefined): string {
  if (raw && SUPPORTED_LOCALE_CODES.includes(raw)) return raw;
  return DEFAULT_LOCALE;
}
