const TIME_ZONE = 'Europe/Paris';

// "sv-SE" writes dates the ISO way ("2026-10-31 10:00"), whatever the browser's language
const PARIS_FIELDS = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const PARIS_CLOCK = new Intl.DateTimeFormat('fr-FR', { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit' });

const PARIS_DATE_TIME = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: 'numeric',
  minute: '2-digit',
});

/** "2026-10-31T09:00:00Z" → "2026-10-31T10:00": the value of an `<input type="datetime-local">`, Paris time. */
export function toParisInput(isoDate: string): string {
  return PARIS_FIELDS.format(new Date(isoDate)).replace(' ', 'T');
}

/**
 * "2026-10-31T10:00" (Paris time) → "2026-10-31T09:00:00.000Z", summer or winter time included;
 * null for an empty or invalid value.
 */
export function fromParisInput(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) {
    return null;
  }
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [number, number, number, number, number];
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  // Paris is ahead of UTC by its offset at that time: read it, and check it once more across a change
  let instant = asUtc - offsetMs(asUtc);
  instant = asUtc - offsetMs(instant);
  return new Date(instant).toISOString();
}

/** "14 h 30" → "14:30", the way a clock in Paris shows it. */
export function parisClock(date: Date): string {
  return PARIS_CLOCK.format(date);
}

/** "samedi 31 octobre à 10:00". */
export function parisDateTime(isoDate: string): string {
  return PARIS_DATE_TIME.format(new Date(isoDate));
}

function offsetMs(instant: number): number {
  const shown = PARIS_FIELDS.format(new Date(instant));
  const [date, time] = shown.split(' ') as [string, string];
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const [hour, minute] = time.split(':').map(Number) as [number, number];
  return Date.UTC(year, month - 1, day, hour, minute) - Math.floor(instant / 60_000) * 60_000;
}
