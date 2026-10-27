import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { KitchenAlarm } from './kitchen-alarm';

const TICK_MS = 250;
/** "+ 1 min": the cake is not quite done. */
export const EXTRA_MS = 60_000;

/** The step of a recipe a timer belongs to. */
export interface TimerTarget {
  slug: string;
  /** Recipe title, shown in the bar of the other pages. */
  title: string;
  /** Route of the recipe, to go back to it from any page. */
  link: string[];
  /** In the whole recipe (all parts), from 0. */
  stepIndex: number;
}

/** A countdown: running while endsAt is set; done once it reached 0. */
export interface KitchenTimer extends TimerTarget {
  key: string;
  totalMs: number;
  remainingMs: number;
  endsAt: number | null;
}

export function timerKey(slug: string, stepIndex: number): string {
  return `${slug}#${stepIndex}`;
}

/** "4:12", "1:05:00": seconds rounded up, so that a 1 min timer starts at 1:00. */
export function formatClock(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

/**
 * The timers of the cooking mode, for the whole visit: they keep running while the visitor goes
 * to another recipe or another page, shown in a bar at the bottom of every page (TimersBar) when
 * no cooking mode is open. At the end, a ring (sound scheduled on the audio clock, see
 * KitchenAlarm) and a vibration, until stopped. Lost when the tab is closed or reloaded.
 */
@Injectable({ providedIn: 'root' })
export class KitchenTimers {
  private readonly router = inject(Router);
  private readonly alarm = new KitchenAlarm();
  private readonly now = signal(Date.now());
  private readonly timers = signal<ReadonlyMap<string, KitchenTimer>>(new Map());
  private ticker: ReturnType<typeof setInterval> | undefined;

  readonly list = computed(() => [...this.timers().values()]);
  readonly running = computed(() => this.list().filter((timer) => timer.endsAt !== null));
  /** The timer ringing, until "Arrêter" (one at a time: the last one to end). */
  readonly ringing = signal<KitchenTimer | null>(null);
  /** A cooking mode is open: it shows the timers itself, the bar of the pages stands aside. */
  readonly modeOpen = signal(false);
  /** "Reprendre" from the bar: the cooking mode of that recipe opens at that step. */
  readonly resumeRequest = signal<{ slug: string; stepIndex: number } | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearInterval(this.ticker);
      this.alarm.close();
    });
  }

  get(slug: string, stepIndex: number): KitchenTimer | undefined {
    return this.timers().get(timerKey(slug, stepIndex));
  }

  /** Follows the clock: read in a template, it updates four times a second while running. */
  remainingMs(timer: KitchenTimer): number {
    return timer.endsAt === null ? timer.remainingMs : Math.max(0, timer.endsAt - this.now());
  }

  /** To call on a tap: browsers only let a page play sound after the visitor acted. */
  unlock(): void {
    this.alarm.unlock();
  }

  /** Starts (for durationMs the first time), pauses, or starts again after a pause or the end. */
  toggle(target: TimerTarget, durationMs: number): void {
    this.unlock();
    // The clock shown is the one of the last tick, up to a quarter of a second old: brought up to
    // date, or a 1:00 timer would first show 1:01
    const now = Date.now();
    this.now.set(now);
    const key = timerKey(target.slug, target.stepIndex);
    const timer = this.timers().get(key) ?? { ...target, key, totalMs: durationMs, remainingMs: durationMs, endsAt: null };
    const running = timer.endsAt !== null;
    const remainingMs = running ? Math.max(0, timer.endsAt! - now) : timer.remainingMs || timer.totalMs;
    this.set({ ...timer, remainingMs, endsAt: running ? null : now + remainingMs });
    if (running) {
      this.alarm.cancel(key);
    } else {
      this.alarm.schedule(key, remainingMs);
      this.silence(key);
    }
    this.tick();
  }

  /** "+ 1 min" on a timer that has ended (or is ending): it rings again a minute later. */
  addMinute(key: string): void {
    const timer = this.timers().get(key);
    if (!timer) {
      return;
    }
    this.unlock();
    const now = Date.now();
    this.now.set(now);
    const left = timer.endsAt !== null ? Math.max(0, timer.endsAt - now) : timer.remainingMs;
    const remainingMs = left + EXTRA_MS;
    this.set({ ...timer, remainingMs, endsAt: now + remainingMs });
    this.alarm.schedule(key, remainingMs);
    this.silence(key);
    this.tick();
  }

  reset(key: string): void {
    const timers = new Map(this.timers());
    timers.delete(key);
    this.timers.set(timers);
    this.alarm.cancel(key);
    this.silence(key);
  }

  /** "Arrêter la sonnerie": the timer stays at 0, shown as done. */
  stopRinging(): void {
    const ringing = this.ringing();
    if (ringing) {
      this.alarm.cancel(ringing.key);
      this.silence(ringing.key);
    }
  }

  /** "Reprendre": back to the recipe if needed, its cooking mode open at the timer's step. */
  resume(timer: KitchenTimer): void {
    this.unlock();
    this.resumeRequest.set({ slug: timer.slug, stepIndex: timer.stepIndex });
    // Already on the recipe: the same URL, the router does nothing and the open page takes the request
    void this.router.navigate(timer.link);
  }

  /** The banner and the vibration stop, if this timer is the one ringing; the sound is the alarm's. */
  private silence(key: string): void {
    if (this.ringing()?.key === key) {
      this.ringing.set(null);
      this.alarm.stopVibrating();
    }
  }

  private set(timer: KitchenTimer): void {
    this.timers.set(new Map(this.timers()).set(timer.key, timer));
  }

  /** Runs while a timer does; shows each one as ringing once, at its end. */
  private tick(): void {
    if (this.ticker !== undefined) {
      return;
    }
    this.ticker = setInterval(() => {
      const now = Date.now();
      this.now.set(now);
      let running = false;
      for (const timer of this.timers().values()) {
        if (timer.endsAt === null) {
          continue;
        }
        if (timer.endsAt <= now) {
          const done = { ...timer, remainingMs: 0, endsAt: null };
          this.set(done);
          this.ring(done);
        } else {
          running = true;
        }
      }
      if (!running) {
        clearInterval(this.ticker);
        this.ticker = undefined;
      }
    }, TICK_MS);
  }

  /** The sound was scheduled when the timer started: only played here if it fell behind. */
  private ring(timer: KitchenTimer): void {
    this.ringing.set(timer);
    this.alarm.vibrate();
    this.alarm.ringNow(timer.key);
  }
}
