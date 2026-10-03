import { useEffect, useId, useState } from 'react';
import { Check, LoaderCircle, MapPin, X } from 'lucide-react';
import type { Suggestion } from '@fairtable/domain';
import { autocomplete } from '../api';
import { useI18n } from '../i18n/I18nProvider';
import type { PersonInput } from '../hooks/useMeeting';
export function AddressField({
  person,
  index,
  onChange,
}: {
  person: PersonInput;
  index: number;
  onChange: (person: PersonInput) => void;
}) {
  const { t } = useI18n();
  const listId = useId();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setSuggestions([]);
    setActive(-1);
    setError(false);
    setLoading(false);
    if (person.selected || person.text.trim().length < 3)
      return () => controller.abort();
    const timer = setTimeout(() => {
      setLoading(true);
      autocomplete(person.text.trim(), controller.signal)
        .then((items) => {
          if (!controller.signal.aborted) setSuggestions(items);
        })
        .catch(() => {
          if (!controller.signal.aborted) setError(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [person.text, person.selected, retry]);
  const choose = (item: Suggestion) => {
    onChange({ ...person, text: item.label, selected: item });
    setOpen(false);
    setSuggestions([]);
  };
  return (
    <div
      className="person-field"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <div className="person-label">
        <span className={`person-badge person-${index}`}>
          {String.fromCharCode(65 + index)}
        </span>
        <input
          className="name-input"
          aria-label={t.form.nameLabel(index + 1)}
          value={person.label ?? t.form.person(index + 1)}
          maxLength={60}
          onChange={(e) => onChange({ ...person, label: e.target.value })}
        />
        {person.selected && (
          <span className="selected-label">
            <Check size={12} /> {t.form.selected}
          </span>
        )}
      </div>
      <div className={`address-control ${person.selected ? 'is-valid' : ''}`}>
        <MapPin size={17} />
        <input
          id={`address-${person.id}`}
          role="combobox"
          aria-label={t.form.addressLabel(index + 1)}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open && suggestions.length > 0}
          aria-activedescendant={
            open && active >= 0 ? `${listId}-${active}` : undefined
          }
          aria-describedby={`${listId}-hint`}
          autoComplete="off"
          placeholder={
            index === 0 ? t.form.firstPlaceholder : t.form.otherPlaceholder
          }
          value={person.text}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange({ ...person, text: e.target.value, selected: undefined });
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, suggestions.length - 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            }
            if (e.key === 'Escape') setOpen(false);
            if (
              e.key === 'Enter' &&
              open &&
              active >= 0 &&
              suggestions[active]
            ) {
              e.preventDefault();
              choose(suggestions[active]);
            }
          }}
        />
        {loading ? (
          <LoaderCircle className="spin" size={16} />
        ) : (
          person.text && (
            <button
              type="button"
              className="clear-input"
              aria-label={t.form.clearAddress(index + 1)}
              onClick={() => {
                onChange({ ...person, text: '', selected: undefined });
                document.getElementById(`address-${person.id}`)?.focus();
              }}
            >
              <X size={15} />
            </button>
          )
        )}
      </div>
      <span id={`${listId}-hint`} className="sr-only">
        {t.form.addressHelp}
      </span>
      {open && suggestions.length > 0 && (
        <ul role="listbox" id={listId} className="suggestions">
          {suggestions.map((item, i) => (
            <li
              id={`${listId}-${i}`}
              key={`${item.label}-${i}`}
              role="option"
              aria-selected={i === active}
              onPointerDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(item)}
            >
              <MapPin size={15} />
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      )}
      {open && error && (
        <p className="field-error" role="status">
          {t.form.suggestionsError}{' '}
          <button type="button" onClick={() => setRetry((x) => x + 1)}>
            {t.form.retrySuggestions}
          </button>
        </p>
      )}
      {open &&
        !loading &&
        !error &&
        person.text.length >= 3 &&
        !person.selected &&
        suggestions.length === 0 && (
          <p className="input-hint">{t.form.addressHint}</p>
        )}
    </div>
  );
}
