import {
  ArrowUpRight,
  ChevronDown,
  Clock,
  MapPin,
  Phone,
  Leaf,
  Accessibility,
  Sun,
} from 'lucide-react';
import type { Participant, RankedRestaurant } from '@fairtable/domain';
import { safeWebsite } from '@fairtable/domain';
import { useI18n } from '../i18n/I18nProvider';
export function RestaurantCard({
  result,
  participants,
  routing,
  selected,
  onSelect,
}: {
  result: RankedRestaurant;
  participants: Participant[];
  routing: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t, format } = useI18n();
  const r = result.restaurant,
    website = safeWebsite(r.website);
  return (
    <article
      id={`card-${r.id}`}
      className={`restaurant-card ${selected ? 'selected' : ''}`}
      data-selected={selected}
    >
      <button
        type="button"
        className="card-select"
        onClick={onSelect}
        onFocus={onSelect}
        aria-expanded={selected}
        aria-controls={`details-${r.id}`}
        aria-label={t.restaurant.select(
          result.rank,
          r.name || t.restaurant.unnamed,
        )}
      >
        <div className="card-heading">
          <span className="rank-badge">{result.rank}</span>
          <div>
            <h3>{r.name || t.restaurant.unnamed}</h3>
            <p>
              {r.cuisine.map(format.metadata).join(' · ') ||
                t.restaurant.cuisineMissing}
            </p>
          </div>
          <span className="fairness" title={t.restaurant.balanceHelp}>
            {format.number(result.fairnessScore)}
            <small>{t.restaurant.balance}</small>
          </span>
        </div>
        <div className="journeys">
          {result.journeys.map((j) => {
            const i = participants.findIndex((p) => p.id === j.participantId);
            return (
              <div className="journey" key={j.participantId}>
                <span className={`person-badge person-${i}`}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span>{participants[i]?.label}</span>
                <strong>
                  {format.journey(
                    routing ? (j.durationSeconds ?? 0) : j.distanceMeters,
                    routing,
                  )}
                </strong>
              </div>
            );
          })}
        </div>
        <div className="spread">
          <span>{t.restaurant.spread}</span>
          <strong>{format.journey(result.statistics.spread, routing)}</strong>
        </div>
        <div className="card-bottom">
          <span>{r.address || t.restaurant.addressMissing}</span>
          <ChevronDown className={selected ? 'rotate' : ''} size={16} />
        </div>
      </button>
      {selected && (
        <div className="restaurant-details" id={`details-${r.id}`}>
          <p className="detail-eyebrow">{t.restaurant.details}</p>
          {r.openingHours && (
            <p>
              <Clock size={15} />
              <span>
                {r.openingHours}
                <small>{t.restaurant.hoursNote}</small>
              </span>
            </p>
          )}
          {r.address && (
            <p>
              <MapPin size={15} />
              {r.address}
            </p>
          )}
          {r.wheelchair && (
            <p>
              <Accessibility size={15} />
              {t.restaurant.wheelchair}: {format.metadata(r.wheelchair)}
            </p>
          )}
          {r.outdoorSeating && (
            <p>
              <Sun size={15} />
              {t.restaurant.outdoor}: {format.metadata(r.outdoorSeating)}
            </p>
          )}
          {r.dietaryOptions.length > 0 && (
            <p>
              <Leaf size={15} />
              {r.dietaryOptions.map(format.metadata).join(' · ')}
            </p>
          )}
          {r.reservation && (
            <p>
              {t.restaurant.reservations}: {format.metadata(r.reservation)}
            </p>
          )}
          <div className="distance-detail">
            {result.journeys.map((j) => (
              <span key={j.participantId}>
                {participants.find((p) => p.id === j.participantId)?.label}:{' '}
                {format.distance(j.distanceMeters)}{' '}
                {routing ? t.restaurant.byRoad : t.restaurant.straightLine}
              </span>
            ))}
          </div>
          <div className="detail-links">
            {website && (
              <a href={website} target="_blank" rel="noopener noreferrer">
                {t.restaurant.website} <ArrowUpRight size={15} />
              </a>
            )}
            {r.phone && (
              <a href={`tel:${r.phone.replace(/[^+0-9]/g, '')}`}>
                <Phone size={15} />
                {r.phone}
              </a>
            )}
          </div>
          <small className="source-note">
            {r.source === 'synthetic'
              ? t.restaurant.synthetic
              : t.restaurant.source}
          </small>
        </div>
      )}
    </article>
  );
}
