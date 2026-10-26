import { Pipe, PipeTransform } from '@angular/core';
import { GlossaryTermResponse } from '../../core/api/generated/models/glossary-term-response';

/** Finds the glossary words in a text, whatever their case and accents. */
export interface GlossaryMatcher {
  pattern: RegExp | null;
  /** By folded spelling (name or other form). */
  terms: ReadonlyMap<string, GlossaryTermResponse>;
}

export const NO_GLOSSARY: GlossaryMatcher = { pattern: null, terms: new Map() };

/** Each base letter matches its accented forms: "emulsionner" finds "émulsionner" and the other way round. */
const ACCENTS: Record<string, string> = {
  a: 'aàâä',
  c: 'cç',
  e: 'eéèêë',
  i: 'iîï',
  o: 'oôö',
  u: 'uùûü',
  y: 'yÿ',
};

/** "Émulsionnez" → "emulsionnez". */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr');
}

export function glossaryMatcher(terms: GlossaryTermResponse[]): GlossaryMatcher {
  const byForm = new Map<string, GlossaryTermResponse>();
  for (const term of terms) {
    for (const form of [term.name, ...term.forms]) {
      const key = fold(form.trim());
      if (key && !byForm.has(key)) {
        byForm.set(key, term);
      }
    }
  }
  if (!byForm.size) {
    return NO_GLOSSARY;
  }
  // Longest first: "pâte à choux" before "pâte"
  const alternatives = [...byForm.keys()].sort((a, b) => b.length - a.length).map(spellings);
  try {
    // Whole words only: "sabler" is not found inside "ensabler"
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives.join('|')})(?![\\p{L}\\p{N}])`, 'giu');
    return { pattern, terms: byForm };
  } catch {
    // A browser without lookbehind (Safari before 16.4): steps are shown without the glossary
    return NO_GLOSSARY;
  }
}

/**
 * Wraps the first occurrence of each glossary word of a rendered step in a `<dfn>`, tapped to show
 * its definition (see GlossaryPopover). Only text is touched: tags, links and code are left as
 * they are. The definition is also in `title`, read by screen readers and shown on hover.
 */
export function highlightTerms(html: string, matcher: GlossaryMatcher): string {
  const pattern = matcher.pattern;
  if (!pattern) {
    return html;
  }
  const seen = new Set<number>();
  let skipped = 0;
  return html
    .split(/(<[^>]*>)/)
    .map((chunk) => {
      if (chunk.startsWith('<')) {
        const tag = /^<(\/?)(a|code|pre|dfn)\b/i.exec(chunk);
        if (tag) {
          skipped += tag[1] ? -1 : 1;
        }
        return chunk;
      }
      if (skipped > 0) {
        return chunk;
      }
      return chunk.replace(pattern, (word) => {
        const term = matcher.terms.get(fold(word));
        if (!term || seen.has(term.id)) {
          return word;
        }
        seen.add(term.id);
        return `<dfn class="glossary-term" role="button" tabindex="0" title="${escapeAttribute(term.definition)}">${word}</dfn>`;
      });
    })
    .join('');
}

/** The glossary word a click or a key press landed on, if any. */
export function termAt(event: Event, matcher: GlossaryMatcher): { term: GlossaryTermResponse; element: HTMLElement } | null {
  const element = (event.target as Element | null)?.closest?.('dfn.glossary-term');
  const term = element ? matcher.terms.get(fold(element.textContent ?? '')) : undefined;
  return element && term ? { term, element: element as HTMLElement } : null;
}

/** `[innerHTML]="step.description | markdown | glossary: matcher"`. */
@Pipe({ name: 'glossary' })
export class GlossaryPipe implements PipeTransform {
  transform(html: string, matcher: GlossaryMatcher): string {
    return highlightTerms(html, matcher);
  }
}

function spellings(folded: string): string {
  return [...folded]
    .map((char) => {
      if (ACCENTS[char]) {
        return `[${ACCENTS[char]}]`;
      }
      if (/\s/.test(char)) {
        return '\\s+';
      }
      // Apostrophes are typed either way
      if (char === "'" || char === '’') {
        return "['’]";
      }
      return char.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
    })
    .join('');
}

function escapeAttribute(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
