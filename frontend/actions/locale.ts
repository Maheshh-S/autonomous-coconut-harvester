"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  LOCALE_COOKIE,
  SUPPORTED_LOCALE_CODES,
} from "@/i18n/locales";

/**
 * Persist the farmer's language choice (V5.0).
 *
 * Writes the `locale` cookie (1 year, lax) and revalidates the whole layout so
 * every server-rendered page re-resolves next-intl messages on the next render.
 * Only allowlisted codes are accepted — an unknown value can never poison the
 * catalog lookup in i18n/request.ts.
 */
export async function setUserLocale(code: string): Promise<void> {
  if (!SUPPORTED_LOCALE_CODES.includes(code)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, code, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
