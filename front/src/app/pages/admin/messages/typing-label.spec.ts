import { describe, expect, it } from 'vitest';
import { typingLabel } from './admin-messages';

const yona = { group: 1, email: 'yona@site.fr', name: 'Yona Martin' };
const lea = { group: 1, email: 'lea@site.fr', name: 'Léa' };
const sam = { group: 1, email: 'sam@site.fr', name: null };

describe('typingLabel', () => {
  it('names one or two writers, and counts more', () => {
    expect(typingLabel([])).toBeNull();
    expect(typingLabel([yona])).toBe('Yona est en train d’écrire…');
    expect(typingLabel([yona, lea])).toBe('Yona et Léa sont en train d’écrire…');
    expect(typingLabel([yona, lea, sam])).toBe('3 personnes sont en train d’écrire…');
  });

  it('says it shorter in the list of the groups', () => {
    expect(typingLabel([yona], true)).toBe('Yona écrit…');
    expect(typingLabel([yona, lea], true)).toBe('Yona et Léa écrivent…');
    expect(typingLabel([yona, lea, sam], true)).toBe('3 personnes écrivent…');
  });
});
