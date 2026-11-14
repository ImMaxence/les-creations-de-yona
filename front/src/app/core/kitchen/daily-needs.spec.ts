import { describe, expect, it } from 'vitest';
import {
  NutritionProfile,
  dailyKcal,
  energyShares,
  formatPortions,
  isProfile,
  portionAdvice,
  restingKcal,
} from './daily-needs';

const woman: NutritionProfile = { sex: 'FEMALE', age: 30, heightCm: 165, weightKg: 60, activity: 'MODERATE', goal: 'KEEP' };

describe('daily needs', () => {
  it('works out the energy spent at rest (Mifflin-St Jeor)', () => {
    // 600 + 1 031,25 - 150 - 161
    expect(restingKcal(woman)).toBe(1320.25);
    expect(restingKcal({ ...woman, sex: 'MALE', weightKg: 80, heightCm: 180 })).toBe(1780);
  });

  it('adds the activity and the goal, to 10 kcal', () => {
    // 1 320,25 × 1,55
    expect(dailyKcal(woman)).toBe(2050);
    expect(dailyKcal({ ...woman, activity: 'SEDENTARY' })).toBe(1580);
    expect(dailyKcal({ ...woman, goal: 'LOSE' })).toBe(1740);
    expect(dailyKcal({ ...woman, sex: 'MALE', weightKg: 80, heightCm: 180, activity: 'VERY_ACTIVE', goal: 'GAIN' })).toBe(3720);
  });

  it('says whether a portion is light, balanced or hearty, and how much makes a meal', () => {
    // A third of 2 050 kcal is 683 kcal: 1,63 portion of 420 kcal, by quarters
    expect(portionAdvice(420, 2050)).toEqual({ share: 420 / 2050, verdict: 'LIGHT', portions: 1.75 });
    expect(portionAdvice(650, 2050)).toEqual({ share: 650 / 2050, verdict: 'BALANCED', portions: 1 });
    // Balanced: one portion, even when a third of the day would be a little more
    expect(portionAdvice(526, 1820)).toEqual({ share: 526 / 1820, verdict: 'BALANCED', portions: 1 });
    expect(portionAdvice(1000, 2050)).toEqual({ share: 1000 / 2050, verdict: 'HEARTY', portions: 0.75 });
    // Never less than a quarter, nor more than 4
    expect(portionAdvice(50, 3000)?.portions).toBe(4);
    expect(portionAdvice(5000, 1500)?.portions).toBe(0.25);
    expect(portionAdvice(0, 2000)).toBeNull();
  });

  it('shares the energy between proteins, carbohydrates and fat', () => {
    // 20 g × 4, 50 g × 4, 10 g × 9: 80, 200 and 90 kcal
    expect(energyShares({ kcal: 370, proteins: 20, carbohydrates: 50, sugars: 5, fat: 10, saturatedFat: 3, fibre: 4, salt: 1 })).toEqual({
      proteins: 22,
      carbohydrates: 54,
      fat: 24,
    });
    expect(energyShares({ kcal: 0, proteins: 0, carbohydrates: 0, sugars: 0, fat: 0, saturatedFat: 0, fibre: 0, salt: 0 })).toBeNull();
  });

  it('writes portions as people say them', () => {
    expect(formatPortions(1)).toBe('1 portion');
    expect(formatPortions(1.5)).toBe('1,5 portion');
    expect(formatPortions(2)).toBe('2 portions');
    expect(formatPortions(0.5)).toBe('½ portion');
    expect(formatPortions(0.75)).toBe('¾ de portion');
  });

  it('keeps only a complete profile of an adult', () => {
    expect(isProfile(woman)).toBe(true);
    expect(isProfile({ ...woman, age: 15 })).toBe(false);
    expect(isProfile({ ...woman, weightKg: Number.NaN })).toBe(false);
    expect(isProfile({ ...woman, activity: 'SOMETIMES' })).toBe(false);
    expect(isProfile({ ...woman, goal: undefined })).toBe(false);
    expect(isProfile(null)).toBe(false);
  });
});
