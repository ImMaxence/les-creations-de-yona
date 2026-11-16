import { DestroyRef, Signal, inject, signal } from '@angular/core';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * What is left before a moment, as a countdown: "6 j 23 h 05 min" for days, then the seconds too
 * within the last day ("23 h 05 min 07 s", "42 min 07 s", "7 s"). Null once it has passed.
 */
export function remaining(until: string, now: number): string | null {
  const left = Date.parse(until) - now;
  if (!(left > 0)) {
    return null;
  }
  const days = Math.floor(left / DAY);
  const hours = Math.floor((left % DAY) / HOUR);
  const minutes = Math.floor((left % HOUR) / MINUTE);
  const seconds = Math.floor((left % MINUTE) / SECOND);
  const pad = (value: number) => String(value).padStart(2, '0');
  if (days > 0) {
    return `${days} j ${hours} h ${pad(minutes)} min`;
  }
  if (hours > 0) {
    return `${hours} h ${pad(minutes)} min ${pad(seconds)} s`;
  }
  return minutes > 0 ? `${minutes} min ${pad(seconds)} s` : `${seconds} s`;
}

/** Date.now(), again every second while the component lives: for a countdown. In an injection context. */
export function tickingNow(): Signal<number> {
  const now = signal(Date.now());
  const timer = setInterval(() => now.set(Date.now()), SECOND);
  inject(DestroyRef).onDestroy(() => clearInterval(timer));
  return now.asReadonly();
}
