import { Injectable, computed } from '@angular/core';
import { NutritionFacts } from '../api/generated/models/nutrition-facts';
import { storedSignal } from './stored-signal';

const STORAGE_KEY = 'yona-daily-needs';

export type Sex = 'FEMALE' | 'MALE';
export type Activity = 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE';
export type Goal = 'LOSE' | 'KEEP' | 'GAIN';

/** What the calculator asks for: an adult's sex, age, height, weight, activity and goal. */
export interface NutritionProfile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goal: Goal;
}

export const LIMITS = {
  age: { min: 18, max: 100 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 30, max: 250 },
} as const;

/** Physical activity level: what a day burns, times the energy spent at rest. */
export const ACTIVITIES: { value: Activity; label: string; hint: string; factor: number }[] = [
  { value: 'SEDENTARY', label: 'Sédentaire', hint: 'Assis la plupart du temps, peu de marche', factor: 1.2 },
  { value: 'LIGHT', label: 'Peu actif', hint: 'Marche, sport 1 à 3 fois par semaine', factor: 1.375 },
  { value: 'MODERATE', label: 'Actif', hint: 'Sport 3 à 5 fois par semaine', factor: 1.55 },
  { value: 'ACTIVE', label: 'Très actif', hint: 'Sport 6 à 7 fois par semaine', factor: 1.725 },
  { value: 'VERY_ACTIVE', label: 'Sportif intensif', hint: 'Entraînement deux fois par jour, métier physique', factor: 1.9 },
];

/** A moderate change: 15 % less to lose weight, 10 % more to gain some (muscle). */
export const GOALS: { value: Goal; label: string; factor: number }[] = [
  { value: 'LOSE', label: 'Perdre du poids', factor: 0.85 },
  { value: 'KEEP', label: 'Garder mon poids', factor: 1 },
  { value: 'GAIN', label: 'Prendre du muscle', factor: 1.1 },
];

/** A main meal: about a third of the day (breakfast and snack sharing the rest). */
export const MEAL_SHARE = 1 / 3;
/** Under a quarter of the day, a light meal; over two fifths, a hearty one. */
const LIGHT_SHARE = 0.25;
const HEARTY_SHARE = 0.4;

export const PORTION_STEP = 0.25;
export const MIN_PORTION = 0.25;
export const MAX_PORTION = 4;

/**
 * Where the energy of a balanced diet comes from, for an adult (Anses, 2016): share of the energy, in percent.
 * Fibre and alcohol left aside.
 */
export const MACRO_REFERENCES = {
  proteins: { min: 10, max: 20 },
  carbohydrates: { min: 40, max: 55 },
  fat: { min: 35, max: 40 },
} as const;

export type Macro = keyof typeof MACRO_REFERENCES;

/** Energy spent at rest (Mifflin-St Jeor, 1990), in kcal a day. */
export function restingKcal(profile: NutritionProfile): number {
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age;
  return profile.sex === 'MALE' ? base + 5 : base - 161;
}

/** What a day needs, with the activity and the goal, rounded to 10 kcal. */
export function dailyKcal(profile: NutritionProfile): number {
  const activity = ACTIVITIES.find((item) => item.value === profile.activity)?.factor ?? 1.2;
  const goal = GOALS.find((item) => item.value === profile.goal)?.factor ?? 1;
  return Math.round((restingKcal(profile) * activity * goal) / 10) * 10;
}

export interface PortionAdvice {
  /** Of the day, for one portion: 0.2 for 20 %. */
  share: number;
  verdict: 'LIGHT' | 'BALANCED' | 'HEARTY';
  /** Portions making a main meal, by quarters. */
  portions: number;
}

/** One portion against the day: light, balanced or hearty, and how much of it makes a meal. */
export function portionAdvice(kcalPerPortion: number, daily: number): PortionAdvice | null {
  if (kcalPerPortion <= 0 || daily <= 0) {
    return null;
  }
  const share = kcalPerPortion / daily;
  const verdict = share < LIGHT_SHARE ? 'LIGHT' : share > HEARTY_SHARE ? 'HEARTY' : 'BALANCED';
  // A balanced portion is a meal as it is; otherwise, the part that makes a third of the day
  const portions = verdict === 'BALANCED' ? 1 : Math.round((daily * MEAL_SHARE) / kcalPerPortion / PORTION_STEP) * PORTION_STEP;
  return { share, verdict, portions: Math.min(MAX_PORTION, Math.max(MIN_PORTION, portions)) };
}

/** Where the energy comes from, in percent of what proteins, carbohydrates and fat give (4, 4 and 9 kcal a gram). */
export function energyShares(facts: NutritionFacts): Record<Macro, number> | null {
  const proteins = facts.proteins * 4;
  const carbohydrates = facts.carbohydrates * 4;
  const fat = facts.fat * 9;
  const total = proteins + carbohydrates + fat;
  if (total <= 0) {
    return null;
  }
  return {
    proteins: Math.round((proteins / total) * 100),
    carbohydrates: Math.round((carbohydrates / total) * 100),
    fat: Math.round((fat / total) * 100),
  };
}

/** "1,5 portion", "2 portions", "¾ de portion". */
export function formatPortions(portions: number): string {
  const quarters: Record<number, string> = { 0.25: '¼ de portion', 0.5: '½ portion', 0.75: '¾ de portion' };
  if (quarters[portions]) {
    return quarters[portions];
  }
  const number = portions.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  return `${number} portion${portions >= 2 ? 's' : ''}`;
}

function inRange(value: unknown, range: { min: number; max: number }): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= range.min && value <= range.max;
}

export function isProfile(value: unknown): value is NutritionProfile {
  const profile = value as Partial<NutritionProfile> | null;
  return (
    !!profile &&
    (profile.sex === 'FEMALE' || profile.sex === 'MALE') &&
    inRange(profile.age, LIMITS.age) &&
    inRange(profile.heightCm, LIMITS.heightCm) &&
    inRange(profile.weightKg, LIMITS.weightKg) &&
    ACTIVITIES.some((item) => item.value === profile.activity) &&
    GOALS.some((item) => item.value === profile.goal)
  );
}

/**
 * "Mes besoins du jour": the visitor's profile, kept in this browser only (health data, never sent to the
 * site), and the energy a day needs.
 */
@Injectable({ providedIn: 'root' })
export class DailyNeeds {
  private readonly stored = storedSignal<NutritionProfile | null>(STORAGE_KEY, null, (value): value is NutritionProfile | null =>
    value === null || isProfile(value),
  );

  readonly profile = this.stored.asReadonly();
  readonly kcal = computed(() => {
    const profile = this.stored();
    return profile ? dailyKcal(profile) : null;
  });

  save(profile: NutritionProfile): void {
    if (isProfile(profile)) {
      this.stored.set(profile);
    }
  }

  forget(): void {
    this.stored.set(null);
  }
}
