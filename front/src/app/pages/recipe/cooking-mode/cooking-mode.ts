import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, model, signal } from '@angular/core';
import {
  LucideChevronLeft,
  LucideChevronRight,
  LucideListChecks,
  LucidePause,
  LucidePlay,
  LucideRotateCcw,
  LucideTimer,
} from '@lucide/angular';
import { Step } from '../../../core/api/generated/models/step';
import { MarkdownPipe } from '../../../shared/format/markdown.pipe';
import { formatMinutes } from '../../../shared/format/units';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { IngredientList } from '../ingredient-list/ingredient-list';
import { ShownIngredient } from '../recipe-parts';

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

/**
 * Cooking mode: one step per screen in large type, to follow the recipe with a phone on the
 * counter. Steps with a duration get a timer, which keeps running while moving to another step,
 * and rings (sound and vibration) at the end. The screen is kept on while the mode is open, where
 * the browser allows it. Arrow keys and swipes move between steps.
 */
@Component({
  selector: 'yona-cooking-mode',
  imports: [
    Dialog,
    IngredientList,
    MarkdownPipe,
    LucideChevronLeft,
    LucideChevronRight,
    LucideListChecks,
    LucidePause,
    LucidePlay,
    LucideRotateCcw,
    LucideTimer,
  ],
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
  readonly open = model(false);

  protected readonly formatMinutes = formatMinutes;
  protected readonly steps = computed<CookingStep[]>(() =>
    this.parts().flatMap((part, partIndex) =>
      part.steps.map((step, index) => ({ part, partIndex, number: index + 1, step })),
    ),
  );
  protected readonly index = signal(0);
  protected readonly current = computed(() => this.steps()[this.index()] ?? null);
  protected readonly showIngredients = signal(false);
  protected readonly hasParts = computed(() => this.parts().length > 1 || !!this.parts()[0]?.title);
  /** The ingredients for the step shown: those of its part, or all of them. */
  protected readonly stepIngredients = computed(() =>
    this.hasParts() ? (this.current()?.part.ingredients ?? []) : this.ingredients(),
  );

  private readonly now = signal(Date.now());
  private readonly timers = signal<ReadonlyMap<number, StepTimer>>(new Map());
  /** Timers running or finished on other steps, to come back to them. */
  protected readonly otherTimers = computed(() =>
    [...this.timers().entries()]
      .filter(([stepIndex, timer]) => stepIndex !== this.index() && (timer.endsAt !== null || timer.remainingMs === 0))
      .map(([stepIndex]) => ({ stepIndex, remaining: this.remainingMs(stepIndex) })),
  );
  protected readonly ringing = signal<number | null>(null);

  private ticker: ReturnType<typeof setInterval> | undefined;
  private wakeLock: WakeLockSentinel | null = null;
  private audio: AudioContext | null = null;
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
      void this.audio?.close();
    });
  }

  /** From the start, or from the step given. */
  start(stepIndex = 0): void {
    this.index.set(Math.min(stepIndex, Math.max(0, this.steps().length - 1)));
    this.showIngredients.set(false);
    this.open.set(true);
  }

  protected go(delta: number): void {
    const next = this.index() + delta;
    if (next >= 0 && next < this.steps().length) {
      this.index.set(next);
      this.showIngredients.set(false);
    }
  }

  protected goTo(stepIndex: number): void {
    this.index.set(stepIndex);
    this.ringing.set(null);
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
    // Created on a tap: browsers only let a page play sound after the visitor acted
    this.audio ??= typeof AudioContext === 'undefined' ? null : new AudioContext();
    const minutes = this.steps()[stepIndex]?.step.durationMinutes ?? 0;
    const timer = this.timers().get(stepIndex) ?? { totalMs: minutes * 60_000, remainingMs: minutes * 60_000, endsAt: null };
    const running = timer.endsAt !== null;
    const remainingMs = running ? Math.max(0, timer.endsAt! - Date.now()) : timer.remainingMs || timer.totalMs;
    this.setTimer(stepIndex, { ...timer, remainingMs, endsAt: running ? null : Date.now() + remainingMs });
    this.tick();
  }

  protected resetTimer(stepIndex: number): void {
    const timers = new Map(this.timers());
    timers.delete(stepIndex);
    this.timers.set(timers);
    if (this.ringing() === stepIndex) {
      this.ringing.set(null);
    }
  }

  private setTimer(stepIndex: number, timer: StepTimer): void {
    this.timers.set(new Map(this.timers()).set(stepIndex, timer));
  }

  /** Runs while a timer does; rings each one once, at its end. */
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

  private ring(stepIndex: number): void {
    this.ringing.set(stepIndex);
    navigator.vibrate?.([300, 150, 300, 150, 300]);
    const audio = this.audio;
    if (!audio) {
      return;
    }
    // Three short beeps
    for (let beep = 0; beep < 3; beep++) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime + beep * 0.35;
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.4, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.3);
    }
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
