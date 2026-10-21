import { Pipe, PipeTransform } from '@angular/core';

// Intl rather than DatePipe: DatePipe only takes fixed offsets, not an IANA time zone, so it
// cannot follow French summer and winter time.
const PARIS_LONG_DATE = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeZone: 'Europe/Paris',
});

/** "2026-10-21T22:30:00Z" → "22 octobre 2026" (date in Paris, where the day has already changed). */
@Pipe({ name: 'parisDate' })
export class ParisDatePipe implements PipeTransform {
  transform(isoDate: string): string {
    return PARIS_LONG_DATE.format(new Date(isoDate));
  }
}
