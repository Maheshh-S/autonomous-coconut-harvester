import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  resolveLocale,
} from "./locales";

/**
 * next-intl request config — cookie-based locale, no URL routing.
 *
 * Routes, links, and data-testids stay exactly as they are; the locale travels
 * in the `locale` cookie (written by the setLocale server action). Missing or
 * unknown cookies fall back to English; a missing message file can never break
 * the render — English is the final fallback.
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = resolveLocale(store.get(LOCALE_COOKIE)?.value);

  let messages: Record<string, unknown>;
  try {
    messages = (await import(`../messages/${locale}.json`)).default;
  } catch {
    messages = (await import(`../messages/${DEFAULT_LOCALE}.json`)).default;
  }

  return { locale, messages };
});
