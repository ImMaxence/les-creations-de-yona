export const MAX_NAME_LENGTH = 60;
export const MAX_DEFINITION_LENGTH = 600;
export const MAX_FORMS = 20;

/** "chemisez, chemisé" → ["chemisez", "chemisé"]. */
export function splitForms(text: string): string[] {
  return text
    .split(',')
    .map((form) => form.trim())
    .filter(Boolean);
}

/**
 * "chemiser" → chemisez, chemisé, chemisée, chemisés, chemisées, chemisant; "blanchir" →
 * blanchissez, blanchi…; "ganache" → ganaches. The bare stem ("chemise") is left out: it is often
 * another word.
 */
export function usualForms(word: string): string[] {
  const lower = word.toLocaleLowerCase('fr');
  if (!lower || lower.includes(' ')) {
    return [];
  }
  if (lower.endsWith('er') && lower.length > 3) {
    const stem = lower.slice(0, -2);
    return ['ez', 'é', 'ée', 'és', 'ées', 'ant'].map((ending) => stem + ending);
  }
  if (lower.endsWith('ir') && lower.length > 3) {
    const stem = lower.slice(0, -2);
    return ['issez', 'i', 'ie', 'is', 'ies', 'issant'].map((ending) => stem + ending);
  }
  return /[sxz]$/.test(lower) ? [] : [lower + 's'];
}

/** The forms typed, with the usual ones added, each once. */
export function withUsualForms(typed: string, word: string): string {
  return [...new Set([...splitForms(typed), ...usualForms(word.trim())])].join(', ');
}
