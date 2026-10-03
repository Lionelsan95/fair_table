import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { locales, resolveLocale } from './config';
import type { Locale } from './config';
import { createFormatters } from './format';
import { ApiError } from '../api';
function useLocaleValue(initialLocale?: Locale) {
  const [locale, setLocaleState] = useState<Locale>(
    () =>
      initialLocale ??
      resolveLocale(window.location.search, navigator.languages),
  );
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    const url = new URL(window.location.href);
    url.searchParams.set('lang', next);
    window.history.replaceState(window.history.state, '', url);
  }, []);
  useEffect(() => {
    const onPopState = () =>
      setLocaleState(
        resolveLocale(window.location.search, navigator.languages),
      );
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const t = locales[locale].messages;
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t.common.pageTitle;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', t.common.description);
  }, [locale, t]);
  return useMemo(
    () => ({
      locale,
      setLocale,
      t,
      format: createFormatters(locale),
      errorMessage: (error: unknown) =>
        t.errors[
          error instanceof ApiError ? error.code : 'service_unavailable'
        ],
    }),
    [locale, setLocale, t],
  );
}
const I18nContext = createContext<ReturnType<typeof useLocaleValue> | null>(
  null,
);
export function I18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const value = useLocaleValue(initialLocale);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n requires I18nProvider');
  return value;
}
