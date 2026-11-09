import { IngredientLine } from '../../core/api/generated/models/ingredient-line';
import { IngredientPiece } from '../../core/api/generated/models/ingredient-piece';
import { Mold } from '../../core/api/generated/models/mold';
import { Part } from '../../core/api/generated/models/part';
import { formatQuantity, roundForKitchen } from '../../shared/format/units';

/** An ingredient as shown on the recipe page, its quantity adjusted to the chosen servings. */
export interface ShownIngredient {
  name: string;
  /** "150 g", "2,5", or "150 g + 1 c. à soupe" in a total; null when the recipe gives no quantity. */
  amount: string | null;
  note: string | null;
  /** In the total of a recipe in parts: titles of the parts using it. */
  parts: string[];
  /** "≈ 8 œufs", for an ingredient weighed but bought by the piece. */
  equivalent?: string;
}

/** A recipe without parts has a single, untitled one: shown as before, without a part heading. */
export function hasParts(parts: Part[]): boolean {
  return parts.length > 1 || !!parts[0]?.title;
}

/** Anchor of the "Questions fréquentes" on the recipe page, also their address for search engines. */
export const QUESTIONS_ANCHOR = 'questions';

/**
 * Anchor of a step on the recipe page, also its address for Google: #etape-2, or #partie-1-etape-2
 * in a recipe in parts (numbers from 1).
 */
export function stepAnchor(step: number, part: number | null): string {
  return part === null ? `etape-${step}` : `partie-${part}-etape-${step}`;
}

/** Ingredients of a part, in its order. */
export function shownIngredients(lines: IngredientLine[], ratio: number): ShownIngredient[] {
  return lines.map((line) => ({
    name: line.name,
    amount: line.quantity == null ? null : amount(scale(line.quantity, ratio), line.unit),
    note: line.note || null,
    parts: [],
    equivalent: line.quantity == null ? undefined : equivalent(inGrams(line.quantity * ratio, line.unit), line.piece),
  }));
}

/**
 * Every ingredient of the recipe once, in order of first appearance. Quantities of the same unit
 * are added up (100 g of butter in the dough + 50 g in the filling: 150 g), other units follow
 * ("150 g + 1 c. à soupe"). A note is kept only for an ingredient listed once.
 */
export function totalIngredients(parts: Part[], ratio: number): ShownIngredient[] {
  const totals = new Map<string, IngredientTotal>();
  for (const part of parts) {
    for (const line of part.ingredients) {
      const key = line.name.toLocaleLowerCase('fr');
      const total: IngredientTotal = totals.get(key) ?? {
        name: line.name,
        quantities: new Map(),
        notes: [],
        parts: [],
        lines: 0,
        piece: line.piece,
      };
      totals.set(key, total);
      total.lines++;
      if (line.note) {
        total.notes.push(line.note);
      }
      if (part.title && !total.parts.includes(part.title)) {
        total.parts.push(part.title);
      }
      if (line.quantity != null) {
        const unit = line.unit?.trim() ?? '';
        const unitKey = unit.toLocaleLowerCase('fr');
        const sum = total.quantities.get(unitKey);
        if (sum) {
          sum.quantity += line.quantity;
        } else {
          total.quantities.set(unitKey, { unit, quantity: line.quantity });
        }
      }
    }
  }
  return [...totals.values()].map((total) => ({
    name: total.name,
    amount: total.quantities.size
      ? [...total.quantities.values()].map(({ unit, quantity }) => amount(scale(quantity, ratio), unit)).join(' + ')
      : null,
    note: total.lines === 1 ? (total.notes[0] ?? null) : null,
    parts: total.parts,
    equivalent: equivalent(totalGrams(total, ratio), total.piece),
  }));
}

interface IngredientTotal {
  name: string;
  /** By unit, case ignored ("" when the quantity has no unit, e.g. 3 eggs). */
  quantities: Map<string, { unit: string; quantity: number }>;
  notes: string[];
  parts: string[];
  lines: number;
  piece?: IngredientPiece;
}

/** Null as soon as one quantity is not a weight: "150 g + 2 c. à soupe" cannot be counted in pieces. */
function totalGrams(total: IngredientTotal, ratio: number): number | null {
  let sum = 0;
  for (const { unit, quantity } of total.quantities.values()) {
    const grams = inGrams(quantity * ratio, unit);
    if (grams === null) {
      return null;
    }
    sum += grams;
  }
  return total.quantities.size ? sum : null;
}

/** Only a weight can be counted in pieces: "3" eggs or "1 c. à soupe" have no equivalent. */
function inGrams(quantity: number, unit: string | null | undefined): number | null {
  switch (unit?.trim().toLocaleLowerCase('fr')) {
    case 'g':
    case 'gr':
    case 'gramme':
    case 'grammes':
      return quantity;
    case 'kg':
    case 'kilo':
    case 'kilos':
      return quantity * 1000;
    default:
      return null;
  }
}

/** To the nearest half piece: "≈ 8 œufs", "≈ 1,5 citron" (the French plural starts at 2). */
export function equivalent(grams: number | null, piece: IngredientPiece | null | undefined): string | undefined {
  if (grams === null || !piece || grams <= 0) {
    return undefined;
  }
  const count = Math.max(0.5, Math.round((grams / piece.grams) * 2) / 2);
  return `≈ ${formatQuantity(count)} ${count >= 2 ? piece.plural : piece.singular}`;
}

/** Quantities written in the recipe are shown as is; scaled ones are rounded to measurable values. */
function scale(quantity: number, ratio: number): number {
  return ratio === 1 ? quantity : roundForKitchen(quantity * ratio);
}

function amount(quantity: number, unit: string | null | undefined): string {
  return unit ? `${formatQuantity(quantity)} ${unit}` : formatQuantity(quantity);
}

const CENTIMETERS = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/** In cm²: what the quantities follow, the preparation keeping the same height. */
export function moldArea(mold: Mold): number {
  switch (mold.shape) {
    case 'ROUND':
      return Math.PI * (mold.lengthCm / 2) ** 2;
    case 'SQUARE':
      return mold.lengthCm ** 2;
    case 'RECTANGLE':
      return mold.lengthCm * (mold.widthCm ?? mold.lengthCm);
  }
}

/** "rond de 20 cm", "carré de 22 cm", "rectangulaire de 30 × 20 cm". */
export function describeMold(mold: Mold): string {
  const length = CENTIMETERS.format(mold.lengthCm);
  switch (mold.shape) {
    case 'ROUND':
      return `rond de ${length} cm`;
    case 'SQUARE':
      return `carré de ${length} cm`;
    case 'RECTANGLE':
      return `rectangulaire de ${length} × ${CENTIMETERS.format(mold.widthCm ?? mold.lengthCm)} cm`;
  }
}
