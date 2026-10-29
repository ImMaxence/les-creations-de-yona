import { GlossaryTermResponse } from '../../core/api/generated/models/glossary-term-response';
import { fold, glossaryKey, glossaryMatcher, highlightTerms, termAt } from './glossary';

const TERMS: GlossaryTermResponse[] = [
  { id: 1, name: 'Sabler', slug: 'sabler', definition: 'Frotter le beurre et la farine', forms: ['sablez'] },
  { id: 2, name: 'Émulsionner', slug: 'emulsionner', definition: 'Fouetter vivement', forms: [] },
  { id: 3, name: 'Pâte', slug: 'pate', definition: 'Mélange de farine', forms: [] },
  { id: 4, name: 'Pâte à choux', slug: 'pate-a-choux', definition: 'Pâte cuite deux fois', forms: [] },
];

function words(html: string): string[] {
  return [...html.matchAll(/<dfn[^>]*>([^<]*)<\/dfn>/g)].map((match) => match[1]);
}

describe('fold', () => {
  it('ignores case and accents', () => {
    expect(fold('Émulsionnez')).toBe('emulsionnez');
  });
});

describe('glossaryKey', () => {
  it('ignores case, accents, separators and the kind of apostrophe', () => {
    expect(glossaryKey('Pâte-à-Choux')).toBe('pate a choux');
    expect(glossaryKey('pâte_à  choux')).toBe('pate a choux');
    expect(glossaryKey('Chemiser')).toBe(glossaryKey('chemiser'));
    expect(glossaryKey('l’appareil')).toBe("l'appareil");
  });
});

describe('highlightTerms', () => {
  const matcher = glossaryMatcher(TERMS);

  it('finds a word whatever its case and accents', () => {
    expect(words(highlightTerms('<p>Emulsionner, puis SABLEZ.</p>', matcher))).toEqual(['Emulsionner', 'SABLEZ']);
  });

  it('finds whole words only', () => {
    expect(words(highlightTerms('<p>Ensabler le moule.</p>', matcher))).toEqual([]);
  });

  it('marks the first occurrence of each word only', () => {
    expect(words(highlightTerms('<p>Sabler, puis sabler encore.</p>', matcher))).toEqual(['Sabler']);
  });

  it('prefers the longest form', () => {
    expect(words(highlightTerms('<p>Préparer la pâte à choux.</p>', matcher))).toEqual(['pâte à choux']);
  });

  it('leaves links and code alone', () => {
    const html = '<p><a href="/x">Sabler</a> <code>pâte</code> puis émulsionner.</p>';
    expect(words(highlightTerms(html, matcher))).toEqual(['émulsionner']);
  });

  it('puts the definition in the title, escaped', () => {
    const quoted = glossaryMatcher([{ ...TERMS[0], definition: 'Le "sablage" <vite>' }]);
    expect(highlightTerms('<p>Sabler</p>', quoted)).toContain('title="Le &quot;sablage&quot; &lt;vite&gt;"');
  });

  it('treats hyphens, underscores and spaces alike', () => {
    const matcher = glossaryMatcher([
      { id: 5, name: 'Beurre-noisette', slug: 'beurre-noisette', definition: 'Beurre cuit', forms: [] },
      { id: 6, name: 'Chemiser', slug: 'chemiser', definition: 'Garnir le moule', forms: ['chemisez'] },
    ]);
    expect(words(highlightTerms('<p>Faire un beurre noisette.</p>', matcher))).toEqual(['beurre noisette']);
    expect(words(highlightTerms('<p>Un beurre_noisette, puis chemiser.</p>', matcher))).toEqual(['beurre_noisette', 'chemiser']);
  });

  it('keeps every word underlined when one of them has a hyphen', () => {
    // An escaped hyphen made the whole pattern invalid: no word was underlined at all
    const matcher = glossaryMatcher([...TERMS, { id: 7, name: 'Pâte-à-bombe', slug: 'pate-a-bombe', definition: 'Jaunes et sucre cuit', forms: [] }]);
    expect(matcher.pattern).not.toBeNull();
    expect(words(highlightTerms('<p>Chemiser, sabler puis la pâte à bombe.</p>', matcher))).toEqual(['sabler', 'pâte à bombe']);
  });

  it('changes nothing without a glossary', () => {
    expect(highlightTerms('<p>Sabler</p>', glossaryMatcher([]))).toBe('<p>Sabler</p>');
  });
});

describe('termAt', () => {
  it('finds the term of the word tapped', () => {
    const matcher = glossaryMatcher(TERMS);
    const step = document.createElement('div');
    step.innerHTML = highlightTerms('<p>Puis sablez.</p>', matcher);
    const word = step.querySelector('dfn')!;
    const event = new MouseEvent('click', { bubbles: true });
    word.dispatchEvent(event);
    expect(termAt(event, matcher)?.term.slug).toBe('sabler');
    expect(termAt(new MouseEvent('click'), matcher)).toBeNull();
  });
});
