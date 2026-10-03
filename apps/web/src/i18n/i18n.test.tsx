import { expect, it } from 'vitest';
import { locales, resolveLocale } from './config';
import { createFormatters } from './format';
it('resolves explicit locale before browser preferences and configured fallback', () => {
  expect(resolveLocale('?lang=fr', ['en-US'])).toBe('fr');
  expect(resolveLocale('?lang=en', ['fr-FR'])).toBe('en');
  expect(resolveLocale('?lang=unsupported', ['de-DE', 'en-US'])).toBe('en');
  expect(resolveLocale('', ['fr-CA'])).toBe('fr');
  expect(resolveLocale('', ['de-DE'], 'fr')).toBe('fr');
  expect(resolveLocale('', [], 'en')).toBe('en');
});
it('formats distances, short journeys and name lists for the active locale', () => {
  const fr = createFormatters('fr'),
    en = createFormatters('en');
  expect(fr.distance(1250)).toMatch(/^1,3\s+km$/);
  expect(en.distance(1250)).toMatch(/^1.3\s+km$/);
  expect(fr.list(['Alice', 'Bob'])).toBe('Alice et Bob');
  expect(en.list(['Alice', 'Bob'])).toBe('Alice and Bob');
  expect(fr.duration(20)).toBe('<1 min');
  expect(en.duration(0)).toBe('0 min');
  expect(fr.metadata('vegetarian')).toBe('Végétarien');
  expect(fr.metadata('Cuisine du chef')).toBe('Cuisine du chef');
});
it('keeps complete catalogs with explicit singular and plural copy', () => {
  for (const section of Object.keys(
    locales.en.messages,
  ) as (keyof typeof locales.en.messages)[]) {
    expect(Object.keys(locales.fr.messages[section]).sort()).toEqual(
      Object.keys(locales.en.messages[section]).sort(),
    );
  }
  expect(locales.fr.messages.results.count(1)).toBe(
    '1 table choisie en pensant à chacun.',
  );
  expect(locales.en.messages.results.count(2)).toBe(
    '2 tables, chosen with everyone in mind.',
  );
});
