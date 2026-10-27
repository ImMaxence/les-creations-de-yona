import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { Step } from '../../../core/api/generated/models/step';
import { KitchenTimer, KitchenTimers, formatClock, timerKey } from '../../../core/kitchen/kitchen-timers';
import { GlossaryMatcher, GlossaryPipe, NO_GLOSSARY } from '../../../shared/format/glossary';
import { MarkdownPipe } from '../../../shared/format/markdown.pipe';
import { parisClock } from '../../../shared/format/paris-time';
import { formatMinutes } from '../../../shared/format/units';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { GlossaryPopover } from '../../../shared/ui/glossary-popover/glossary-popover';
import { Icon } from '../../../shared/ui/icon/icon';
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

const SWIPE_PX = 60;
/** Free timer of a step without duration ("Laisser refroidir"): its first value, and its limits. */
const FREE_MINUTES = 5;
const MAX_FREE_MINUTES = 600;

/**
 * Cooking mode: one step per screen in large type, to follow the recipe with a phone on the
 * counter. It opens on the "mise en place", every ingredient (and the equipment) to get out and
 * weigh. The ingredients the step needs are shown with it, when the recipe says which. Steps with
 * a duration get a timer; the others a free one, of the minutes the visitor chooses. Timers belong
 * to the visit (KitchenTimers): they keep running on another step, another recipe or once the mode
 * is closed, and ring (sound and vibration) at the end until stopped. The screen is kept on while
 * the mode is open, where the browser allows it. Arrow keys and swipes move between steps.
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
  /** The recipe's slug and route: its timers are found again from any page. */
  readonly slug = input.required<string>();
  readonly link = input.required<string[]>();
  readonly parts = input.required<CookingPart[]>();
  /** The ingredients of the whole recipe, shown when it has a single part. */
  readonly ingredients = input.required<ShownIngredient[]>();
  /** Moule à tarte, fouet…: shown with the mise en place. */
  readonly equipment = input<string[]>([]);
  /** Preparation, rest and cooking: "prête vers…" from the moment the mode starts. */
  readonly totalMinutes = input(0);
  readonly glossary = input<GlossaryMatcher>(NO_GLOSSARY);
  /** The visitor's own notes on the recipe, shown with the mise en place. */
  readonly notes = input('');
  readonly open = model(false);

  protected readonly formatMinutes = formatMinutes;
  protected readonly clock = formatClock;
  protected readonly maxFreeMinutes = MAX_FREE_MINUTES;
  protected readonly timers = inject(KitchenTimers);
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
  /** The equipment, ticked off like the ingredients. */
  protected readonly equipmentLines = computed<ShownIngredient[]>(() =>
    this.equipment().map((name) => ({ name, amount: null, note: null, parts: [] })),
  );
  /** Something to get out before starting: the mise en place is worth a screen. */
  protected readonly hasMiseEnPlace = computed(() => this.ingredients().length > 0 || this.equipment().length > 0);

  /** "Commencé à 14:02 · prête vers 15:32": set when the mode starts. */
  protected readonly schedule = signal<{ startedAt: string; readyAt: string } | null>(null);
  /** Minutes of the free timer, chosen before starting it; back to 5 on another step. */
  protected readonly freeMinutes = signal(FREE_MINUTES);

  /** Timers running or finished elsewhere, this recipe's other steps or another recipe's. */
  protected readonly otherTimers = computed(() => {
    const here = timerKey(this.slug(), this.index());
    return this.timers
      .list()
      .filter((timer) => timer.key !== here && (timer.endsAt !== null || timer.remainingMs === 0))
      .map((timer) => ({ timer, label: this.labelOf(timer), remaining: this.timers.remainingMs(timer) }));
  });
  protected readonly ringingLabel = computed(() => {
    const ringing = this.timers.ringing();
    return ringing ? this.labelOf(ringing) : null;
  });

  private wakeLock: WakeLockSentinel | null = null;
  private swipeStartX: number | null = null;

  constructor() {
    effect(() => {
      const open = this.open();
      untracked(() => this.timers.modeOpen.set(open));
      if (open) {
        void this.keepScreenOn();
      } else {
        void this.wakeLock?.release();
        this.wakeLock = null;
      }
    });
    // "Reprendre" in the bar of the pages, for this recipe
    effect(() => {
      const request = this.timers.resumeRequest();
      if (request?.slug === this.slug()) {
        untracked(() => {
          this.timers.resumeRequest.set(null);
          this.resume(request.stepIndex);
        });
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.timers.modeOpen.set(false);
      void this.wakeLock?.release();
    });
  }

  /** From the mise en place (when there is something to get out), or from the step given. */
  start(stepIndex = 0): void {
    this.index.set(Math.min(stepIndex, Math.max(0, this.steps().length - 1)));
    this.miseEnPlace.set(stepIndex === 0 && this.hasMiseEnPlace());
    this.showIngredients.set(false);
    this.freeMinutes.set(FREE_MINUTES);
    // Opened by a tap: the moment to let the timers ring later
    this.timers.unlock();
    const total = this.totalMinutes();
    const now = new Date();
    this.schedule.set(
      total > 0 ? { startedAt: parisClock(now), readyAt: parisClock(new Date(now.getTime() + total * 60_000)) } : null,
    );
    this.open.set(true);
  }

  /** Back in the mode, from a timer: at its step, the schedule kept. */
  protected resume(stepIndex: number): void {
    this.timers.unlock();
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
      this.freeMinutes.set(FREE_MINUTES);
    } else if (next < 0 && this.hasMiseEnPlace()) {
      this.miseEnPlace.set(true);
    }
  }

  protected goTo(stepIndex: number): void {
    this.index.set(stepIndex);
    this.miseEnPlace.set(false);
    this.freeMinutes.set(FREE_MINUTES);
    this.timers.stopRinging();
  }

  /** A timer of the list: this recipe's, at its step; another recipe's, on its page. */
  protected openTimer(timer: KitchenTimer): void {
    if (timer.slug === this.slug()) {
      this.goTo(timer.stepIndex);
    } else {
      this.timers.resume(timer);
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

  // Timers of this recipe's steps

  protected timerOf(stepIndex: number): KitchenTimer | undefined {
    return this.timers.get(this.slug(), stepIndex);
  }

  protected remainingMs(stepIndex: number): number {
    const timer = this.timerOf(stepIndex);
    return timer ? this.timers.remainingMs(timer) : this.durationMs(stepIndex);
  }

  protected isRinging(stepIndex: number): boolean {
    return this.timers.ringing()?.key === timerKey(this.slug(), stepIndex);
  }

  protected toggleTimer(stepIndex: number): void {
    this.timers.toggle(
      { slug: this.slug(), title: this.title(), link: this.link(), stepIndex },
      this.durationMs(stepIndex),
    );
  }

  protected addMinute(stepIndex: number): void {
    this.timers.addMinute(timerKey(this.slug(), stepIndex));
  }

  protected resetTimer(stepIndex: number): void {
    this.timers.reset(timerKey(this.slug(), stepIndex));
  }

  /** + and − of the free timer: a minute at a time up to 10 minutes, five beyond. */
  protected changeFreeMinutes(direction: 1 | -1): void {
    this.freeMinutes.update((minutes) => {
      const step = (direction > 0 ? minutes >= 10 : minutes > 10) ? 5 : 1;
      return Math.min(MAX_FREE_MINUTES, Math.max(1, minutes + direction * step));
    });
  }

  /** The step's own duration, or the free timer's. */
  private durationMs(stepIndex: number): number {
    return (this.steps()[stepIndex]?.step.durationMinutes ?? this.freeMinutes()) * 60_000;
  }

  /** "Étape 3", or "Tarte au citron · étape 3" for another recipe. */
  private labelOf(timer: KitchenTimer): string {
    return timer.slug === this.slug() ? `Étape ${timer.stepIndex + 1}` : `${timer.title} · étape ${timer.stepIndex + 1}`;
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
