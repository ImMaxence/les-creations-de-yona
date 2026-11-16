import { formatBytes } from '../../../shared/format/units';

/** Units of the server curves: one per chart, never two on the same axis. */
export type ChartUnit = '%' | 'Mo' | 'W' | 'Ko/s' | 'Mo/h';

/** Tops of the axis per unit: each halves into a round tick. */
const STEPS: Record<ChartUnit, number[]> = {
  '%': [10, 25, 50, 100],
  Mo: [100, 200, 300, 400, 500, 600, 800, 1000, 1500, 2000, 4000],
  W: [10, 20, 30, 40, 50, 60, 80, 100],
  'Ko/s': [2, 4, 10, 20, 40, 100, 200, 400, 1000, 2000, 4000, 10000, 20000, 40000, 100000],
  'Mo/h': [2, 4, 10, 20, 40, 100, 200, 400, 1000, 2000, 4000, 10000, 20000, 40000, 100000],
};

const ONE_DECIMAL = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/** The first step at or above the highest value, with some room above the curve. */
export function niceMax(values: readonly (number | null)[], unit: ChartUnit): number {
  const top = Math.max(0, ...values.map((value) => value ?? 0));
  const steps = STEPS[unit];
  return steps.find((step) => step >= top * 1.15) ?? steps[steps.length - 1]!;
}

/** "12,5 %", "380 Mo", "8,4 W", "12 Ko/s"; "—" when unknown. */
export function formatValue(value: number | null, unit: ChartUnit): string {
  if (value === null) {
    return '—';
  }
  if (unit === 'Mo') {
    return `${Math.round(value)} Mo`;
  }
  // Small figures keep a decimal, large ones are rounded
  const shown = unit === '%' || unit === 'W' || value < 10 ? ONE_DECIMAL.format(value) : Math.round(value).toLocaleString('fr-FR');
  return `${shown} ${unit}`;
}

/** 1536 → "1,5 Ko/s": a rate in bytes per second. */
export function formatRate(bytesPerSecond: number | null | undefined): string {
  return bytesPerSecond == null ? '—' : `${formatBytes(bytesPerSecond)}/s`;
}

/** 850 Wh → "850 Wh", 1 400 Wh → "1,4 kWh". */
export function formatEnergy(kwh: number): string {
  return kwh < 1 ? `${Math.round(kwh * 1000)} Wh` : `${ONE_DECIMAL.format(kwh)} kWh`;
}

/** 8.43 → "8,4 W". */
export function formatWatts(watts: number | null | undefined): string {
  return watts == null ? '—' : `${ONE_DECIMAL.format(watts)} W`;
}
