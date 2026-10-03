import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  Participant,
  RankedRestaurant,
  Suggestion,
} from '@fairtable/domain';
import { health, searchMeeting } from '../api';
export type PersonInput = {
  id: string;
  label?: string;
  text: string;
  selected?: Suggestion;
};
const emptyRestaurants: RankedRestaurant[] = [];
const createPerson = (index: number): PersonInput => ({
  id: `p${index + 1}`,
  text: '',
});
/** Owns this ephemeral meeting, not translations or persisted user data. */
export function useMeeting(defaultName: (index: number) => string) {
  const [people, setPeople] = useState<PersonInput[]>([
    createPerson(0),
    createPerson(1),
  ]);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'form' | 'results'>('form');
  const controller = useRef<AbortController | null>(null);
  const service = useQuery({ queryKey: ['health'], queryFn: health });
  const search = useMutation({
    mutationFn: (body: Parameters<typeof searchMeeting>[0]) =>
      searchMeeting(body, controller.current?.signal),
  });
  const participants = useMemo<Participant[]>(
    () =>
      people.flatMap((p, i) =>
        p.selected
          ? [
              {
                id: p.id,
                label: p.label?.trim() || defaultName(i + 1),
                coordinate: p.selected.coordinate,
              },
            ]
          : [],
      ),
    [people, defaultName],
  );
  const valid = participants.length === people.length;
  const restaurants =
    view === 'results'
      ? (search.data?.restaurants ?? emptyRestaurants)
      : emptyRestaurants;
  useEffect(() => () => controller.current?.abort(), []);
  const select = useCallback((id: string, fromMap = false) => {
    setSelected(id);
    if (fromMap)
      document.getElementById(`card-${id}`)?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
        block: 'nearest',
      });
  }, []);
  const submit = async () => {
    if (!valid || search.isPending) return;
    controller.current?.abort();
    controller.current = new AbortController();
    setSelected(null);
    try {
      await search.mutateAsync({ participants, travelMode: 'driving' });
      setView('results');
    } catch {
      /* The view renders the localized error; input stays available. */
    }
  };
  return {
    people,
    participants,
    selected,
    view,
    service,
    search,
    valid,
    restaurants,
    select,
    submit,
    setCount: (count: number) =>
      setPeople((old) =>
        Array.from({ length: count }, (_, i) => old[i] ?? createPerson(i)),
      ),
    updatePerson: (updated: PersonInput) =>
      setPeople((old) =>
        old.map((person) => (person.id === updated.id ? updated : person)),
      ),
    edit: () => {
      setView('form');
      setSelected(null);
      search.reset();
    },
  };
}
