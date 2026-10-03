import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
maplibregl.setWorkerUrl(workerUrl);
import type { Participant, RankedRestaurant } from '@fairtable/domain';
import { LocateFixed, MapPin, Plus, Minus } from 'lucide-react';
import { webConfig } from '../config';
import { useI18n } from '../i18n/I18nProvider';
import 'maplibre-gl/dist/maplibre-gl.css';
const reduced = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export default function MeetingMap({
  participants,
  restaurants,
  selected,
  onSelect,
}: {
  participants: Participant[];
  restaurants: RankedRestaurant[];
  selected: string | null;
  onSelect: (id: string, fromMap?: boolean) => void;
}) {
  const { t } = useI18n();
  const fittedCoordinates = useRef('');
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null),
    markers = useRef<maplibregl.Marker[]>([]),
    onSelectRef = useRef(onSelect);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    if (!container.current) return;
    try {
      const instance = new maplibregl.Map({
        container: container.current,
        style: webConfig.mapStyle,
        center: [2.3522, 48.861],
        zoom: 12.1,
        attributionControl: false,
      });
      map.current = instance;
      instance.addControl(
        new maplibregl.AttributionControl({
          compact: false,
          customAttribution:
            '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        }),
      );
      instance.on('load', () => setFailed(false));
      instance.on('error', () => setFailed(true));
      const observer = new ResizeObserver(() => instance.resize());
      observer.observe(container.current);
      setReady(true);
      return () => {
        observer.disconnect();
        instance.remove();
        map.current = null;
      };
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    if (!ready || !map.current) return;
    markers.current.forEach((m) => m.remove());
    markers.current = [];
    for (const p of participants) {
      const i = Number(p.id.slice(1)) - 1;
      const button = document.createElement('button');
      button.className = `map-marker participant person-${i}`;
      button.textContent = String.fromCharCode(65 + i);
      button.setAttribute(
        'aria-label',
        `${String.fromCharCode(65 + i)}: ${p.label}`,
      );
      const popup = new maplibregl.Popup({
        offset: 20,
        closeButton: false,
      }).setText(p.label);
      const close = document.createElement('button');
      close.className = 'popup-close';
      close.textContent = '×';
      close.setAttribute('aria-label', t.map.close);
      close.onclick = () => popup.remove();
      popup.on('open', () =>
        popup
          .getElement()
          .querySelector('.maplibregl-popup-content')
          ?.append(close),
      );
      markers.current.push(
        new maplibregl.Marker({ element: button })
          .setLngLat([p.coordinate.lon, p.coordinate.lat])
          .setPopup(popup)
          .addTo(map.current),
      );
    }
    for (const r of restaurants) {
      const button = document.createElement('button');
      button.className = 'map-marker restaurant';
      button.dataset.restaurantId = r.restaurant.id;
      button.textContent = String(r.rank);
      button.setAttribute(
        'aria-label',
        t.map.marker(r.rank, r.restaurant.name || t.restaurant.unnamed),
      );
      button.addEventListener('click', () =>
        onSelectRef.current(r.restaurant.id, true),
      );
      markers.current.push(
        new maplibregl.Marker({ element: button })
          .setLngLat([r.restaurant.coordinate.lon, r.restaurant.coordinate.lat])
          .addTo(map.current),
      );
    }
    const coordinates = [
      ...participants.map((p) => p.coordinate),
      ...restaurants.map((r) => r.restaurant.coordinate),
    ];
    const coordinateKey = JSON.stringify(coordinates);
    if (coordinates.length && coordinateKey !== fittedCoordinates.current) {
      fittedCoordinates.current = coordinateKey;
      const bounds = new maplibregl.LngLatBounds();
      coordinates.forEach((p) => bounds.extend([p.lon, p.lat]));
      map.current.fitBounds(bounds, {
        padding: { top: 90, bottom: 90, left: 70, right: 70 },
        maxZoom: 14,
        duration: reduced() ? 0 : 650,
      });
    }
  }, [participants, restaurants, ready, t]);
  useEffect(() => {
    if (!map.current) return;
    for (const marker of markers.current) {
      const el = marker.getElement();
      if (el.dataset.restaurantId) {
        el.dataset.selected = String(el.dataset.restaurantId === selected);
        el.setAttribute(
          'aria-pressed',
          String(el.dataset.restaurantId === selected),
        );
      }
    }
  }, [selected, restaurants, participants, ready, t]);
  useEffect(() => {
    if (!map.current) return;
    const restaurant = restaurants.find((r) => r.restaurant.id === selected);
    if (restaurant)
      map.current.easeTo({
        center: [
          restaurant.restaurant.coordinate.lon,
          restaurant.restaurant.coordinate.lat,
        ],
        duration: reduced() ? 0 : 500,
      });
  }, [selected, restaurants, ready]);
  useEffect(() => {
    map.current?.getCanvas().setAttribute('aria-label', t.map.title);
  }, [ready, t]);
  const fit = () => {
    const coordinates = [
      ...participants.map((p) => p.coordinate),
      ...restaurants.map((r) => r.restaurant.coordinate),
    ];
    if (map.current && coordinates.length) {
      const bounds = new maplibregl.LngLatBounds();
      coordinates.forEach((p) => bounds.extend([p.lon, p.lat]));
      map.current.fitBounds(bounds, {
        padding: 80,
        maxZoom: 14,
        duration: reduced() ? 0 : 500,
      });
    }
  };
  return (
    <section className="map-panel" aria-label={t.map.title}>
      <div className="map-canvas" ref={container} />
      <div className="map-location">
        <span className="live-dot" />
        {t.form.country} <span> / </span> {t.map.slogan}
      </div>
      {!participants.length && (
        <div className="map-welcome">
          <span className="welcome-icon">
            <MapPin size={23} />
          </span>
          <div>
            <strong>{t.map.welcome}</strong>
            <p>{t.map.welcomeHelp}</p>
          </div>
        </div>
      )}
      {failed && (
        <div className="map-error" role="status">
          {t.map.error}
        </div>
      )}
      <div className="map-zoom">
        <button
          aria-label={t.map.zoomIn}
          onClick={() => map.current?.zoomIn({ duration: reduced() ? 0 : 200 })}
        >
          <Plus size={18} />
        </button>
        <button
          aria-label={t.map.zoomOut}
          onClick={() =>
            map.current?.zoomOut({ duration: reduced() ? 0 : 200 })
          }
        >
          <Minus size={18} />
        </button>
      </div>
      <button className="fit-map" aria-label={t.map.fit} onClick={fit}>
        <LocateFixed size={20} />
      </button>
      <div className="map-legend">
        <span>
          <i className="legend-person" />
          {t.map.startingPoints}
        </span>
        <span>
          <i className="legend-restaurant" />
          {t.map.tables}
        </span>
      </div>
    </section>
  );
}
