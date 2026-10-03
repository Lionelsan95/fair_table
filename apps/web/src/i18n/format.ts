import { locales } from './config';
import type { Locale } from './config';
import type { Messages } from './en';
/** Presentation only: API and domain metrics remain metres and seconds. */
export function createFormatters(locale: Locale) {
  const number = new Intl.NumberFormat(locales[locale].intl, {
    maximumFractionDigits: 0,
  });
  const distance = new Intl.NumberFormat(locales[locale].intl, {
    style: 'unit',
    unit: 'kilometer',
    unitDisplay: 'short',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const list = new Intl.ListFormat(locales[locale].intl, {
    style: 'long',
    type: 'conjunction',
  });
  const duration = (seconds: number) =>
    seconds > 0 && seconds < 60
      ? locales[locale].messages.restaurant.lessThanMinute
      : `${number.format(Math.round(seconds / 60))} min`;
  return {
    number: (value: number) => number.format(value),
    distance: (meters: number) => distance.format(meters / 1000),
    duration,
    journey: (value: number, routing: boolean) =>
      routing ? duration(value) : distance.format(value / 1000),
    list: (values: string[]) => list.format(values),
    metadata: (value: string) => {
      const key = value.toLowerCase() as keyof Messages['metadata'];
      return Object.hasOwn(locales[locale].messages.metadata, key)
        ? locales[locale].messages.metadata[key]
        : value;
    },
  };
}
