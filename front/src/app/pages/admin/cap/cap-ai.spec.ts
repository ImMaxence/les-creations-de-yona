import { CapBlock } from '../../../core/api/generated/models/cap-block';
import { CAP_AI_EXAMPLES, CAP_AI_FORMS, formOfTemplate, hasContent, withPhotosKept } from './cap-ai';
import { CAP_TEMPLATES } from './cap-templates';

describe('formOfTemplate', () => {
  it('asks the AI for the shape of the model chosen, its own choice otherwise', () => {
    expect(formOfTemplate('recit')).toBe('STORY');
    expect(formOfTemplate('pas-a-pas')).toBe('STEPS');
    expect(formOfTemplate('carnet')).toBe('NOTEBOOK');
    expect(formOfTemplate('vide')).toBe('AUTO');
    expect(formOfTemplate(null)).toBe('AUTO');
  });

  it('knows every model of "Nouvel article"', () => {
    const forms = CAP_AI_FORMS.map((option) => option.form);
    for (const template of CAP_TEMPLATES) {
      expect(forms).toContain(formOfTemplate(template.id));
    }
  });
});

describe('CAP_AI_EXAMPLES', () => {
  it('gives notes of a shape the window offers, under the length allowed', () => {
    for (const example of CAP_AI_EXAMPLES) {
      expect(CAP_AI_FORMS.some((option) => option.form === example.form)).toBe(true);
      expect(example.notes.length).toBeGreaterThan(100);
      expect(example.notes.length).toBeLessThan(20_000);
    }
  });
});

describe('withPhotosKept', () => {
  const written: CapBlock[] = [
    { type: 'TEXT', text: 'Ce matin' },
    { type: 'IMAGE', caption: 'La tarte' },
    { type: 'STEPS', photos: [{ caption: 'Détrempe' }, { caption: 'Tourage' }] },
    { type: 'TIP', text: 'Beurre souple' },
  ];

  it('leaves the places for photos empty when none was placed', () => {
    expect(withPhotosKept(written, [{ type: 'TEXT', text: 'Ancien' }, { type: 'STEPS', photos: [{}, {}, {}] }])).toEqual(written);
  });

  it('puts the photos placed in the places for photos, in order', () => {
    const previous: CapBlock[] = [
      { type: 'IMAGE', imageId: 'a' },
      { type: 'STEPS', photos: [{ imageId: 'b' }, {}, { imageId: 'c' }] },
    ];

    expect(withPhotosKept(written, previous)).toEqual([
      { type: 'TEXT', text: 'Ce matin' },
      { type: 'IMAGE', caption: 'La tarte', imageId: 'a' },
      { type: 'STEPS', photos: [{ caption: 'Détrempe', imageId: 'b' }, { caption: 'Tourage', imageId: 'c' }] },
      { type: 'TIP', text: 'Beurre souple' },
    ]);
  });

  it('adds the photos left over at the end, as big photos', () => {
    const previous: CapBlock[] = [
      { type: 'IMAGE_TEXT', imageId: 'a', text: 'x' },
      { type: 'IMAGE', imageId: 'b' },
      { type: 'IMAGE', imageId: 'c' },
      { type: 'IMAGE', imageId: 'd' },
    ];

    const blocks = withPhotosKept([{ type: 'TEXT', text: 'Ce matin' }, { type: 'IMAGE' }], previous);

    expect(blocks.map((block) => block.imageId)).toEqual([undefined, 'a', 'b', 'c', 'd']);
    expect(blocks.slice(2).every((block) => block.type === 'IMAGE')).toBe(true);
  });
});

describe('hasContent', () => {
  it('sees what the article written would replace', () => {
    expect(hasContent('', ' ', [{ type: 'TEXT' }, { type: 'STEPS', photos: [{}, {}] }])).toBe(false);
    expect(hasContent('Examen blanc', '', [])).toBe(true);
    expect(hasContent('', '', [{ type: 'IMAGE', caption: 'La tarte' }])).toBe(true);
    expect(hasContent('', '', [{ type: 'STEPS', photos: [{ caption: 'Détrempe' }, {}] }])).toBe(true);
  });
});
