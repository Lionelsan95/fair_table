import { en } from './en';
import { fr } from './fr';
import type { Messages } from './en';
export const supportedLocales = ['fr', 'en'] as const;
export type Locale = (typeof supportedLocales)[number];
export const locales: Record<
  Locale,
  { label: string; intl: string; messages: Messages }
> = {
  fr: { label: 'Français', intl: 'fr-FR', messages: fr },
  en: { label: 'English', intl: 'en-GB', messages: en },
};
export function isLocale(value: unknown): value is Locale {
  return supportedLocales.some((locale) => locale === value);
}
const configuredDefault: unknown = import.meta.env.VITE_DEFAULT_LOCALE;
export const defaultLocale: Locale = isLocale(configuredDefault)
  ? configuredDefault
  : 'fr';
/** URL preference > supported browser language > configured fallback. No storage. */
export function resolveLocale(
  search: string,
  languages: readonly string[],
  fallback: Locale = defaultLocale,
): Locale {
  const explicit = new URLSearchParams(search).get('lang');
  if (isLocale(explicit)) return explicit;
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return fallback;
}
