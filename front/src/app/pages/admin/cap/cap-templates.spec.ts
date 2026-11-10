import { BLOCK_TYPES, CAP_TEMPLATES, blockLabel, emptyBlock, slugOf, templateOf } from './cap-templates';

describe('slugOf', () => {
  it('makes the address from the title, as the server does', () => {
    expect(slugOf('Mon premier examen blanc')).toBe('mon-premier-examen-blanc');
    expect(slugOf('  Pâte à choux : l’échec !  ')).toBe('pate-a-choux-l-echec');
    expect(slugOf('Œufs & cœur')).toBe('oeufs-coeur');
    expect(slugOf('Ex æquo')).toBe('ex-aequo');
    expect(slugOf('CAP 2027')).toBe('cap-2027');
  });

  it('falls back on "article" for a title without letters', () => {
    expect(slugOf('')).toBe('article');
    expect(slugOf('!!!')).toBe('article');
  });
});

describe('templateOf', () => {
  it('finds a model by its id, "Récit" otherwise', () => {
    expect(templateOf('carnet').name).toBe('Carnet');
    expect(templateOf('inconnu').name).toBe('Récit');
    expect(templateOf(null).name).toBe('Récit');
    expect(templateOf(undefined).name).toBe('Récit');
  });

  it('lays down new blocks each time, never shared between two articles', () => {
    const template = templateOf('pas-a-pas');
    const first = template.blocks();
    first[0]!.text = 'Changé';

    expect(template.blocks()[0]!.text).toBeUndefined();
  });

  it('gives each model what its card announces', () => {
    expect(CAP_TEMPLATES.map((template) => [template.id, template.blocks().map((block) => block.type)])).toEqual([
      ['recit', ['TEXT', 'IMAGE', 'TEXT']],
      ['pas-a-pas', ['TEXT', 'STEPS', 'TIP']],
      ['carnet', ['TEXT', 'IMAGE_TEXT', 'IMAGE_TEXT', 'IMAGE_TEXT']],
      ['vide', []],
    ]);
    // "Carnet": the photos alternate sides
    expect(templateOf('carnet').blocks().slice(1).map((block) => block.side)).toEqual(['LEFT', 'RIGHT', 'LEFT']);
  });
});

describe('emptyBlock', () => {
  it('prepares each type', () => {
    expect(emptyBlock('TEXT')).toEqual({ type: 'TEXT' });
    expect(emptyBlock('IMAGE_TEXT')).toEqual({ type: 'IMAGE_TEXT', side: 'LEFT' });
    expect(emptyBlock('IMAGE_TEXT', 'RIGHT')).toEqual({ type: 'IMAGE_TEXT', side: 'RIGHT' });
    // Three photos to fill: two at least are needed
    expect(emptyBlock('STEPS').photos).toHaveLength(3);
  });
});

describe('blockLabel', () => {
  it('names every type of block', () => {
    expect(BLOCK_TYPES.map((block) => blockLabel(block.type))).toEqual(['Texte', 'Grande photo', 'Photo + texte', 'Étapes en photos', 'Astuce à retenir']);
  });
});
