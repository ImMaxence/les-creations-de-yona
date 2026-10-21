const QUANTITY = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

/** 20 → "20 min", 60 → "1 h", 75 → "1 h 15". */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${rest} min`;
  }
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

/** ISO 8601 duration for schema.org: 75 → "PT1H15M". */
export function isoDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `PT${hours ? `${hours}H` : ''}${rest || !hours ? `${rest}M` : ''}`;
}

/** 2.5 → "2,5", 0.333 → "0,33". */
export function formatQuantity(quantity: number): string {
  return QUANTITY.format(quantity);
}

/**
 * Rounds a scaled quantity to what one can measure in a kitchen: 116.67 g → 115, 46.67 g → 47,
 * 4.67 apples → 4.5. Quantities written in the recipe are never rounded.
 */
export function roundForKitchen(quantity: number): number {
  if (quantity >= 100) {
    return Math.round(quantity / 5) * 5;
  }
  if (quantity >= 10) {
    return Math.round(quantity);
  }
  const step = quantity < 0.5 ? 0.25 : 0.5;
  return Math.max(step, Math.round(quantity / step) * step);
}
