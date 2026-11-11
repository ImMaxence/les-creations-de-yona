import { capArticleToMarkdown } from './cap-markdown';

describe('capArticleToMarkdown', () => {
  it('writes the article from its blocks, links made absolute', () => {
    const markdown = capArticleToMarkdown({
      id: 1,
      slug: 'pate-feuilletee',
      title: 'Ma pâte feuilletée',
      subtitle: 'Six tours simples',
      happenedOn: '2026-11-11',
      updatedAt: '2026-11-11T10:00:00Z',
      style: 'CLASSIC',
      blocks: [
        { type: 'TEXT', text: 'Voir la [tarte](/recettes/tartes/tarte-fine).' },
        { type: 'STEPS', photos: [{ caption: 'Détrempe', imageId: 'a' }, { caption: 'Tourage' }] },
        { type: 'TIP', text: 'Un beurre trop froid casse' },
      ],
    });

    expect(markdown).toContain('# Ma pâte feuilletée');
    expect(markdown).toContain('*Six tours simples*');
    expect(markdown).toContain('11 novembre 2026');
    expect(markdown).toContain('/mon-cap/pate-feuilletee');
    expect(markdown).toMatch(/\[tarte\]\(https?:\/\/[^)]+\/recettes\/tartes\/tarte-fine\)/);
    expect(markdown).toContain('1. Détrempe');
    expect(markdown).toContain('2. Tourage');
    expect(markdown).toContain('> **Astuce** : Un beurre trop froid casse');
  });
});
