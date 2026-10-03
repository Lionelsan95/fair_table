import { ArrowLeft, ArrowRight, Car, MapPin } from 'lucide-react';
import type { Participant, SearchResponse } from '@fairtable/domain';
import { useI18n } from '../i18n/I18nProvider';
import { RestaurantCard } from './RestaurantCard';
import { Button } from './ui/button';
export function MeetingResults({
  data,
  participants,
  selected,
  onSelect,
  onEdit,
}: {
  data: SearchResponse;
  participants: Participant[];
  selected: string | null;
  onSelect: (id: string) => void;
  onEdit: () => void;
}) {
  const { t, format } = useI18n();
  return (
    <>
      <div className="results-heading">
        <button className="text-button" onClick={onEdit}>
          <ArrowLeft size={15} />
          {t.results.edit}
        </button>
        <span className="eyebrow">{t.results.eyebrow}</span>
        <h1>
          {data.restaurants.length ? t.results.title : t.results.emptyTitle}
        </h1>
        <p aria-live="polite">
          {data.restaurants.length
            ? t.results.count(data.restaurants.length)
            : t.results.empty}
        </p>
      </div>
      {data.metricSource === 'geodesic' && (
        <div className="approximate-note" role="status">
          {t.results.approximate}
        </div>
      )}
      {data.restaurants.length ? (
        <>
          <div className="results-meta">
            <Car size={15} />
            {data.metricSource === 'routing'
              ? t.results.driving
              : t.results.geodesic}
            <span>{t.form.people(participants.length)}</span>
          </div>
          <div className="restaurant-list">
            {data.restaurants.map((result) => (
              <RestaurantCard
                key={result.restaurant.id}
                result={result}
                participants={participants}
                routing={data.metricSource === 'routing'}
                selected={selected === result.restaurant.id}
                onSelect={() => onSelect(result.restaurant.id)}
              />
            ))}
          </div>
          <p className="result-footnote">{t.results.footnote}</p>
        </>
      ) : (
        <div className="empty-state">
          <MapPin size={32} />
          <p>{t.results.emptyHelp(format.distance(data.radiusMeters))}</p>
          <Button onClick={onEdit}>
            {t.results.adjust}
            <ArrowRight size={16} />
          </Button>
        </div>
      )}
    </>
  );
}
