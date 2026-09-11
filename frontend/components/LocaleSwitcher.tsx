"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Translate } from "@phosphor-icons/react";
import { setUserLocale } from "@/actions/locale";
import { SUPPORTED_LOCALES } from "@/i18n/locales";

/**
 * Language picker (V5.0). A native <select> with native language names —
 * deliberately boring: accessible, thumb-friendly, zero dropdown bugs, and it
 * renders every Indic script without custom font work.
 */
export default function LocaleSwitcher({ variant }: { variant: "rail" | "sheet" }) {
  const locale = useLocale();
  const t = useTranslations("nav");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(code: string) {
    if (code === locale) return;
    startTransition(async () => {
      await setUserLocale(code);
      router.refresh();
    });
  }

  return (
    <label
      className={`locale-switch locale-${variant}`}
      aria-label={t("language")}
      data-testid="locale-switcher"
    >
      <Translate size={17} weight="regular" aria-hidden className="locale-ico" />
      <select
        className="locale-select"
        value={locale}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        aria-label={t("language")}
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native} ({l.short})
          </option>
        ))}
      </select>
      <style jsx>{`
        .locale-switch {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--color-line);
          border-radius: 10px;
          padding: 7px 10px;
          background: var(--color-surface);
          color: var(--color-text-dim);
          cursor: pointer;
          transition: border-color 140ms var(--ease-out);
        }
        .locale-switch:hover {
          border-color: var(--color-accent-dim);
        }
        .locale-ico {
          flex: none;
          color: var(--color-accent);
        }
        .locale-select {
          flex: 1;
          min-width: 0;
          border: 0;
          background: transparent;
          color: var(--color-text);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          outline: none;
        }
        .locale-select:disabled {
          opacity: 0.55;
          cursor: default;
        }
        .locale-rail {
          margin-top: 10px;
          width: 100%;
        }
        .locale-sheet {
          margin: 4px 16px 16px;
        }
      `}</style>
    </label>
  );
}
