import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { NutritionFacts } from '../../../core/api/generated/models/nutrition-facts';
import {
  ACTIVITIES,
  Activity,
  DailyNeeds,
  GOALS,
  Goal,
  LIMITS,
  MACRO_REFERENCES,
  MAX_PORTION,
  MEAL_SHARE,
  MIN_PORTION,
  Macro,
  PORTION_STEP,
  Sex,
  energyShares,
  formatPortions,
  isProfile,
  portionAdvice,
} from '../../../core/kitchen/daily-needs';
import { formatKcal } from '../../../shared/format/nutrition';
import { Icon } from '../../../shared/ui/icon/icon';
import { Segmented } from '../../../shared/ui/segmented/segmented';
import { Select, SelectOption } from '../../../shared/ui/select/select';

const MACROS: { key: Macro; label: string }[] = [
  { key: 'proteins', label: 'Protéines' },
  { key: 'carbohydrates', label: 'Glucides' },
  { key: 'fat', label: 'Lipides' },
];

/**
 * "Mes besoins du jour", under the nutrition facts of a recipe: the energy the visitor needs a day, a serving
 * against it, the part that makes a meal, and where the energy comes from. Their profile stays in their browser.
 * Loaded on its own, once the visitor scrolls to it (@defer in RecipeNutrition).
 */
@Component({
  selector: 'yona-recipe-daily-needs',
  imports: [Icon, Segmented, Select],
  templateUrl: './recipe-daily-needs.html',
  styleUrl: './recipe-daily-needs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeDailyNeeds {
  /** What a serving holds; the whole recipe when it gives no servings. */
  readonly portion = input.required<NutritionFacts>();
  readonly byServing = input(true);

  protected readonly macros = MACROS;
  protected readonly references = MACRO_REFERENCES;
  protected readonly limits = LIMITS;
  protected readonly goalOptions: SelectOption<Goal>[] = GOALS.map(({ value, label }) => ({ value, label }));
  protected readonly activityOptions: SelectOption<Activity>[] = ACTIVITIES.map(({ value, label, hint }) => ({
    value,
    label: `${label} · ${hint}`,
  }));
  protected readonly mealPercent = Math.round(MEAL_SHARE * 100);
  protected readonly portionStep = PORTION_STEP;
  protected readonly minPortion = MIN_PORTION;
  protected readonly maxPortion = MAX_PORTION;
  protected readonly formatKcal = formatKcal;
  protected readonly formatPortions = formatPortions;

  private readonly needs = inject(DailyNeeds);
  protected readonly profile = this.needs.profile;
  protected readonly daily = this.needs.kcal;

  protected readonly shares = computed(() => energyShares(this.portion()));
  protected readonly advice = computed(() => {
    const daily = this.daily();
    return daily ? portionAdvice(this.portion().kcal, daily) : null;
  });
  /** "Ma part": the advised one first, then as the visitor changes it. */
  protected readonly myPortions = linkedSignal(() => (this.byServing() ? (this.advice()?.portions ?? 1) : 1));
  protected readonly myKcal = computed(() => Math.round(this.portion().kcal * this.myPortions()));
  protected readonly myPercent = computed(() => {
    const daily = this.daily();
    return daily ? Math.round((this.myKcal() / daily) * 100) : 0;
  });

  // The form of the profile: shown when none is kept, or to change it.
  protected readonly editing = signal(false);
  protected readonly sex = signal<Sex>('FEMALE');
  protected readonly age = signal<number | null>(null);
  protected readonly heightCm = signal<number | null>(null);
  protected readonly weightKg = signal<number | null>(null);
  protected readonly activity = signal<Activity>('LIGHT');
  protected readonly goal = signal<Goal>('KEEP');
  protected readonly invalid = signal(false);
  protected readonly showForm = computed(() => this.editing() || this.profile() == null);

  /** Inside the recommended share of the energy, under it or over it. */
  protected macroStatus(key: Macro, percent: number): 'LOW' | 'OK' | 'HIGH' {
    const reference = MACRO_REFERENCES[key];
    return percent < reference.min ? 'LOW' : percent > reference.max ? 'HIGH' : 'OK';
  }

  protected readNumber(event: Event): number | null {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    return Number.isFinite(value) ? value : null;
  }

  protected edit(): void {
    const profile = this.profile();
    if (profile) {
      this.sex.set(profile.sex);
      this.age.set(profile.age);
      this.heightCm.set(profile.heightCm);
      this.weightKg.set(profile.weightKg);
      this.activity.set(profile.activity);
      this.goal.set(profile.goal);
    }
    this.invalid.set(false);
    this.editing.set(true);
  }

  protected save(event: Event): void {
    event.preventDefault();
    const profile = {
      sex: this.sex(),
      age: this.age(),
      heightCm: this.heightCm(),
      weightKg: this.weightKg(),
      activity: this.activity(),
      goal: this.goal(),
    };
    if (!isProfile(profile)) {
      this.invalid.set(true);
      return;
    }
    this.invalid.set(false);
    this.needs.save(profile);
    this.editing.set(false);
  }

  protected forget(): void {
    this.needs.forget();
    this.age.set(null);
    this.heightCm.set(null);
    this.weightKg.set(null);
    this.editing.set(false);
  }

  protected changePortions(delta: number): void {
    this.myPortions.update((portions) =>
      Math.min(MAX_PORTION, Math.max(MIN_PORTION, Math.round((portions + delta) / PORTION_STEP) * PORTION_STEP)),
    );
  }
}
