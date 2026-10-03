import { useEffect, useState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
export function SearchProgress() {
  const { t } = useI18n();
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const first = setTimeout(() => setStage(1), 1000);
    const second = setTimeout(() => setStage(2), 3500);
    return () => {
      clearTimeout(first);
      clearTimeout(second);
    };
  }, []);
  return (
    <div className="search-progress" role="status" aria-live="polite">
      <strong>{t.search.title}</strong>
      {t.search.stages.map((label, i) => (
        <p key={i} className={i === stage ? 'current' : ''}>
          {i < stage ? (
            <Check size={15} />
          ) : i === stage ? (
            <LoaderCircle size={15} className="spin" />
          ) : (
            <span className="stage-dot" />
          )}
          {label}
        </p>
      ))}
      <small>{t.search.hint}</small>
    </div>
  );
}
