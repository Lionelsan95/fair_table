import { locales, supportedLocales } from '../i18n/config';
import { useI18n } from '../i18n/I18nProvider';
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div
      className="language-switcher"
      role="group"
      aria-label={t.common.language}
    >
      {supportedLocales.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-label={locales[code].label}
          aria-pressed={locale === code}
          onClick={() => setLocale(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
