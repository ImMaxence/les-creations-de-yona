import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, model, signal } from '@angular/core';
import { Step } from '../../../core/api/generated/models/step';
import { GlossaryMatcher, GlossaryPipe, NO_GLOSSARY } from '../../../shared/format/glossary';
import { MarkdownPipe } from '../../../shared/format/markdown.pipe';
import { parisClock } from '../../../shared/format/paris-time';
import { formatMinutes } from '../../../shared/format/units';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { GlossaryPopover } from '../../../shared/ui/glossary-popover/glossary-popover';
import { Icon } from '../../../shared/ui/icon/icon';
import { IngredientList } from '../ingredient-list/ingredient-list';
import { ShownIngredient } from '../recipe-parts';
import { KitchenAlarm } from './kitchen-alarm';

/** A part of the recipe as the page shows it: its ingredients already adjusted to the servings. */
export interface CookingPart {
  title: string;
  ingredients: ShownIngredient[];
  steps: Step[];
}

interface CookingStep {
  part: CookingPart;
  partIndex: number;
  /** In its part, from 1. */
  number: number;
  step: Step;
}

/** A countdown of a step: running while endsAt is set; done once it reached 0. */
interface StepTimer {
  totalMs: number;
  remainingMs: number;
  endsAt: number | null;
}

const TICK_MS = 250;
const SWIPE_PX = 60;
/** "+ 1 min": the cake is not quite done. */
const EXTRA_MS = 60_000;

/**
 * Cooking mode: one step per screen in large type, to follow the recipe with a phone on the
 * counter. It opens on the "mise en place", every ingredient to tick off once out and weighed.
 * The ingredients the step needs are shown with it, when the recipe says which. Steps with a
 * duration get a timer, which keeps running while moving to another step or once the mode is
 * closed (a bar on the page then shows it), and rings (sound and vibration) at the end until
 * stopped. The screen is kept on while the mode is open, where the browser allows it. Arrow keys
 * and swipes move between steps.
 */
@Component({
  selector: 'yona-cooking-mode',
  imports: [Icon, Dialog, GlossaryPipe, GlossaryPopover, IngredientList, MarkdownPipe],
  templateUrl: './cooking-mode.html',
  styleUrl: './cooking-mode.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:keydown)': 'onKeydown($event)' },
})
export class CookingMode {
  readonly title = input.required<string>();
  readonly parts = input.required<CookingPart[]>();
  /** The ingredients of the whole recipe, shown when it has a single part. */
  readonly ingredients = input.required<ShownIngredient[]>();
  /** Preparation, rest and cooking: "prête vers…" from the moment the mode starts. */
  readonly totalMinutes = input(0);
  readonly glossary = input<GlossaryMatcher>(NO_GLOSSARY);
  /** The visitor's own notes on the recipe, shown with the mise en place. */
  readonly notes = input('');
  readonly open = model(false);

  protected readonly formatMinutes = formatMinutes;
  protected readonly steps = computed<CookingStep[]>(() =>
    this.parts().flatMap((part, partIndex) =>
      part.steps.map((step, index) => ({ part, partIndex, number: index + 1, step })),
    ),
  );
  protected readonly index = signal(0);
  /** The screen before the first step: every ingredient of the recipe, to tick off. */
  protected readonly miseEnPlace = signal(false);
  protected readonly current = computed(() => this.steps()[this.index()] ?? null);
  protected readonly showIngredients = signal(false);
  protected readonly hasParts = computed(() => this.parts().length > 1 || !!this.parts()[0]?.title);
  /** The ingredients of the step's part, or of the whole recipe. */
  protected readonly allIngredients = computed(() =>
    this.hasParts() ? (this.current()?.part.ingredients ?? []) : this.ingredients(),
  );
  /** Those the step needs, when the recipe says which: shown with the step, without a tap. */
  protected readonly stepIngredients = computed(() => {
    const shown = this.current();
    return (
      shown?.step.ingredientPositions
        .map((position) => shown.part.ingredients[position])
        .filter((line): line is ShownIngredient => !!line) ?? []
    );
  });

  /** "Commencé à 14:02 · prête vers 15:32": set when the mode starts. */
  protected readonly schedule = signal<{ startedAt: string; readyAt: string } | null>(null);

  private readonly now = signal(Date.now());
  private readonly timers = signal<ReadonlyMap<number, StepTimer>>(new Map());
  /** Timers running or finished on other steps, to come back to them. */
  protected readonly otherTimers = computed(() =>
    [...this.timers().entries()]
      .filter(([stepIndex, timer]) => stepIndex !== this.index() && (timer.endsAt !== null || timer.remainingMs === 0))
      .map(([stepIndex]) => ({ stepIndex, remaining: this.remainingMs(stepIndex) })),
  );
  /** Once the mode is closed: the timers still running, shown in a bar on the page. */
  protected readonly runningTimers = computed(() =>
    [...this.timers().entries()]
      .filter(([, timer]) => timer.endsAt !== null)
      .map(([stepIndex]) => ({ stepIndex, remaining: this.remainingMs(stepIndex) })),
  );
  protected readonly ringing = signal<number | null>(null);

  private ticker: ReturnType<typeof setInterval> | undefined;
  private wakeLock: WakeLockSentinel | null = null;
  private readonly alarm = new KitchenAlarm();
  private swipeStartX: number | null = null;

  constructor() {
    effect(() => {
      if (this.open()) {
        void this.keepScreenOn();
      } else {
        void this.wakeLock?.release();
        this.wakeLock = null;
      }
    });
    inject(DestroyRef).onDestroy(() => {
      clearInterval(this.ticker);
      void this.wakeLock?.release();
      this.alarm.close();
    });
  }

  /** From the mise en place (when there are ingredients), or from the step given. */
  start(stepIndex = 0): void {
    this.index.set(Math.min(stepIndex, Math.max(0, this.steps().length - 1)));
    this.miseEnPlace.set(stepIndex === 0 && this.ingredients().length > 0);
    this.showIngredients.set(false);
    // Opened by a tap: the moment to let the timers ring later
    this.alarm.unlock();
    const total = this.totalMinutes();
    const now = new Date();
    this.schedule.set(
      total > 0 ? { startedAt: parisClock(now), readyAt: parisClock(new Date(now.getTime() + total * 60_000)) } : null,
    );
    this.open.set(true);
  }

  /** Back in the mode, from the bar of the page: where it was left, the schedule kept. */
  protected resume(stepIndex: number): void {
    this.alarm.unlock();
    this.goTo(stepIndex);
    this.open.set(true);
  }

  protected go(delta: number): void {
    if (this.miseEnPlace()) {
      if (delta > 0) {
        this.miseEnPlace.set(false);
      }
      return;
    }
    const next = this.index() + delta;
    if (next >= 0 && next < this.steps().length) {
      this.index.set(next);
      this.showIngredients.set(false);
    } else if (next < 0 && this.ingredients().length) {
      this.miseEnPlace.set(true);
    }
  }

  protected goTo(stepIndex: number): void {
    this.index.set(stepIndex);
    this.miseEnPlace.set(false);
    this.stopRinging();
  }

  /** "Arrêter la sonnerie": the timer stays at 0, shown as done. */
  protected stopRinging(): void {
    const ringing = this.ringing();
    if (ringing !== null) {
      this.alarm.cancel(ringing);
      this.silence();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.open()) {
      return;
    }
    if (event.key === 'ArrowRight') {
      this.go(1);
    } else if (event.key === 'ArrowLeft') {
      this.go(-1);
    }
  }

  protected onPointerDown(event: PointerEvent): void {
    this.swipeStartX = event.clientX;
  }

  protected onPointerUp(event: PointerEvent): void {
    if (this.swipeStartX === null) {
      return;
    }
    const distance = event.clientX - this.swipeStartX;
    this.swipeStartX = null;
    if (Math.abs(distance) >= SWIPE_PX) {
      this.go(distance < 0 ? 1 : -1);
    }
  }

  // Timers

  protected timerOf(stepIndex: number): StepTimer | undefined {
    return this.timers().get(stepIndex);
  }

  protected remainingMs(stepIndex: number): number {
    const timer = this.timers().get(stepIndex);
    if (!timer) {
      return (this.steps()[stepIndex]?.step.durationMinutes ?? 0) * 60_000;
    }
    return timer.endsAt === null ? timer.remainingMs : Math.max(0, timer.endsAt - this.now());
  }

  protected clock(ms: number): string {
    const seconds = Math.ceil(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = String(seconds % 60).padStart(2, '0');
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
  }

  protected toggleTimer(stepIndex: number): void {
    // A tap: browsers only let a page play sound after the visitor acted
    this.alarm.unlock();
    // The clock shown is the one of the last tick, up to a quarter of a second old: brought up to
    // date, or a 1:00 timer would first show 1:01
    const now = Date.now();
    this.now.set(now);
    const minutes = this.steps()[stepIndex]?.step.durationMinutes ?? 0;
    const timer = this.timers().get(stepIndex) ?? { totalMs: minutes * 60_000, remainingMs: minutes * 60_000, endsAt: null };
    const running = timer.endsAt !== null;
    const remainingMs = running ? Math.max(0, timer.endsAt! - now) : timer.remainingMs || timer.totalMs;
    this.setTimer(stepIndex, { ...timer, remainingMs, endsAt: running ? null : now + remainingMs });
    if (running) {
      this.alarm.cancel(stepIndex);
    } else {
      this.alarm.schedule(stepIndex, remainingMs);
      if (this.ringing() === stepIndex) {
        this.silence();
      }
    }
    this.tick();
  }

  /** "+ 1 min" on a timer that has ended (or is ending): it rings again a minute later. */
  protected addMinute(stepIndex: number): void {
    this.alarm.unlock();
    const now = Date.now();
    this.now.set(now);
    const timer = this.timers().get(stepIndex);
    const left = timer?.endsAt != null ? Math.max(0, timer.endsAt - now) : (timer?.remainingMs ?? 0);
    const remainingMs = left + EXTRA_MS;
    this.setTimer(stepIndex, { totalMs: timer?.totalMs ?? EXTRA_MS, remainingMs, endsAt: now + remainingMs });
    this.alarm.schedule(stepIndex, remainingMs);
    if (this.ringing() === stepIndex) {
      this.silence();
    }
    this.tick();
  }

  protected resetTimer(stepIndex: number): void {
    const timers = new Map(this.timers());
    timers.delete(stepIndex);
    this.timers.set(timers);
    this.alarm.cancel(stepIndex);
    if (this.ringing() === stepIndex) {
      this.silence();
    }
  }

  /** The banner and the vibration stop; the sound is the alarm's. */
  private silence(): void {
    this.ringing.set(null);
    this.alarm.stopVibrating();
  }

  private setTimer(stepIndex: number, timer: StepTimer): void {
    this.timers.set(new Map(this.timers()).set(stepIndex, timer));
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
      for (const [stepIndex, timer] of this.timers()) {
        if (timer.endsAt === null) {
          continue;
        }
        if (timer.endsAt <= now) {
          this.setTimer(stepIndex, { ...timer, remainingMs: 0, endsAt: null });
          this.ring(stepIndex);
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
  private ring(stepIndex: number): void {
    this.ringing.set(stepIndex);
    this.alarm.vibrate();
    this.alarm.ringNow(stepIndex);
  }

  private async keepScreenOn(): Promise<void> {
    if (!('wakeLock' in navigator) || this.wakeLock) {
      return;
    }
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.wakeLock.addEventListener('release', () => (this.wakeLock = null));
    } catch {
      // Refused (battery saver…): the mode still works, the screen may just dim
    }
  }
}
