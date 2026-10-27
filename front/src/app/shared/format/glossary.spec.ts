import { GlossaryTermResponse } from '../../core/api/generated/models/glossary-term-response';
import { fold, glossaryMatcher, highlightTerms, termAt } from './glossary';

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
