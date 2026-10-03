import { lazy, Suspense, useState } from 'react';
import {
  ArrowRight,
  Utensils,
  Users,
  Car,
  ShieldCheck,
  Scale,
  LoaderCircle,
  RotateCcw,
} from 'lucide-react';
import { AddressField } from './components/AddressField';
import { Button } from './components/ui/button';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { SearchProgress } from './components/SearchProgress';
import { MeetingResults } from './components/MeetingResults';
import { useI18n } from './i18n/I18nProvider';
import { useMeeting } from './hooks/useMeeting';
const MeetingMap = lazy(() => import('./components/MeetingMap'));
export default function App() {
  const { t, format, errorMessage } = useI18n();
  const meeting = useMeeting(t.form.person);
  const [about, setAbout] = useState(false);
  const {
    people,
    participants,
    view,
    selected,
    service,
    search,
    valid,
    restaurants,
  } = meeting;
  const missingNames = people.flatMap((p, i) =>
    p.selected ? [] : [p.label?.trim() || t.form.person(i + 1)],
  );
  return (
    <div className={`app-shell ${view === 'results' ? 'results-view' : ''}`}>
      <div className="sidebar">
        <header className="brand-bar">
          <a href="/" className="brand" aria-label={t.common.home}>
            <span className="brand-icon">
              <Utensils size={20} />
            </span>
            FairTable<span className="brand-dot">.</span>
          </a>
          <div className="header-actions">
            <LanguageSwitcher />
            <button
              className="about-button"
              type="button"
              aria-expanded={about}
              onClick={() => setAbout((value) => !value)}
            >
              {t.common.howItWorks}
            </button>
          </div>
        </header>
        {about && (
          <div className="about-box">
            <strong>{t.common.tagline}</strong>
            <p>{t.common.about}</p>
            <p>{t.common.privacy}</p>
          </div>
        )}
        {service.data?.synthetic && (
          <div className="demo-banner">{t.common.demo}</div>
        )}
        <main className="sidebar-content">
          {view === 'results' && search.data ? (
            <MeetingResults
              data={search.data}
              participants={participants}
              selected={selected}
              onSelect={meeting.select}
              onEdit={meeting.edit}
            />
          ) : (
            <>
              <div className="intro">
                <span className="eyebrow">{t.form.eyebrow}</span>
                <h1>
                  {t.form.title}
                  <br />
                  <span>{t.form.titleAccent}</span>
                </h1>
                <p>
                  {t.form.subtitle}
                  <br />
                  {t.form.subtitleMore}
                </p>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void meeting.submit();
                }}
              >
                <fieldset
                  disabled={search.isPending}
                  className="participant-form"
                >
                  <div className="section-label">
                    <span id="people-label">
                      <Users size={17} />
                      {t.form.who}
                    </span>
                    <span>{t.form.countHint}</span>
                  </div>
                  <div
                    className="people-selector"
                    role="group"
                    aria-labelledby="people-label"
                  >
                    {[2, 3, 4, 5].map((count) => (
                      <button
                        key={count}
                        type="button"
                        aria-label={t.form.people(count)}
                        aria-pressed={people.length === count}
                        onClick={() => meeting.setCount(count)}
                      >
                        {count}
                        <span>{t.form.peopleSuffix}</span>
                      </button>
                    ))}
                  </div>
                  <div className="address-fields">
                    {people.map((person, index) => (
                      <AddressField
                        key={person.id}
                        person={person}
                        index={index}
                        onChange={meeting.updatePerson}
                      />
                    ))}
                  </div>
                  <div className="travel-mode">
                    <Car size={17} />
                    <span>{t.form.driving}</span>
                    <span className="mode-tag">{t.form.country}</span>
                  </div>
                  <Button
                    type="submit"
                    className="search-button w-full"
                    disabled={!valid || search.isPending}
                  >
                    {search.isPending ? (
                      <>
                        <LoaderCircle className="spin" size={17} />
                        {t.form.searching}
                      </>
                    ) : (
                      <>
                        {t.form.search}
                        <ArrowRight size={18} />
                      </>
                    )}
                  </Button>
                  {!search.isPending && (
                    <p className="form-hint">
                      {valid
                        ? t.form.ready
                        : t.form.missing(format.list(missingNames))}
                    </p>
                  )}
                </fieldset>
              </form>
              {search.isPending && <SearchProgress />}
              {search.isError && (
                <div role="alert" className="error-box">
                  <strong>{t.search.errorTitle}</strong>
                  <p>{errorMessage(search.error)}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void meeting.submit()}
                  >
                    <RotateCcw size={14} />
                    {t.common.retry}
                  </Button>
                </div>
              )}
              <div className="fair-note">
                <span>
                  <Scale size={21} />
                </span>
                <div>
                  <strong>{t.form.fairTitle}</strong>
                  <p>{t.form.fairDescription}</p>
                </div>
              </div>
            </>
          )}
        </main>
        <footer className="sidebar-footer">
          <ShieldCheck size={14} />
          <span>{t.common.footer}</span>
        </footer>
      </div>
      <Suspense
        fallback={
          <section className="map-panel map-loading">
            <LoaderCircle className="spin" />
            {t.map.loading}
          </section>
        }
      >
        <MeetingMap
          participants={participants}
          restaurants={restaurants}
          selected={selected}
          onSelect={meeting.select}
        />
      </Suspense>
    </div>
  );
}
