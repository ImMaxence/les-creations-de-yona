/** "12345678900012" → "123 456 789 00012", as written on the invoices; anything else as given. */
export function formatSiret(siret: string): string {
  const digits = siret.replace(/\s/g, '');
  return /^\d{14}$/.test(digits) ? `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}` : siret;
}

/**
 * What the amount of an order changed from its lines: a discount (negative) or an extra
 * (positive), null when it is the total of the lines. To the cent, so that 0.1 + 0.2 counts as 0.3.
 */
export function adjustment(amount: number, linesTotal: number): { label: string; value: number } | null {
  const difference = Math.round((amount - linesTotal) * 100) / 100;
  if (difference === 0) {
    return null;
  }
  return { label: difference < 0 ? 'Remise' : 'Supplément', value: difference };
}

/** "Facture 2026-0001": the page's title, and so the name a PDF is saved under. */
export function invoiceTitle(number: string): string {
  return `Facture ${number}`;
}
