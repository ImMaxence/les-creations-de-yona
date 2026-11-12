import { describe, expect, it } from 'vitest';
import { MessageMention, firstLink, mentionLabel, mentionQuery, parseMessage, plainMessage, shownLink, withMentions } from './message-format';

const TARTE: MessageMention = { kind: 'RECIPE', id: 12, label: 'Tarte au citron' };
const EXAMEN: MessageMention = { kind: 'CAP_ENTRY', id: 7, label: 'Examen blanc' };

describe('message-format', () => {
  it('reads the text and the mentions of a message', () => {
    expect(parseMessage('Tu as vu @[Tarte au citron](RECIPE:12) et @[Examen blanc](CAP_ENTRY:7) ?')).toEqual([
      { text: 'Tu as vu ' },
      { mention: TARTE },
      { text: ' et ' },
      { mention: EXAMEN },
      { text: ' ?' },
    ]);
  });

  it('leaves as text what only looks like a mention', () => {
    expect(parseMessage('@[Rien](VIDEO:3) et @[Pas fermé](RECIPE:x)')).toEqual([{ text: '@[Rien](VIDEO:3) et @[Pas fermé](RECIPE:x)' }]);
    expect(parseMessage('')).toEqual([]);
  });

  it('reads a message as plain text', () => {
    expect(plainMessage('Vu @[Tarte au citron](RECIPE:12) !')).toBe('Vu @Tarte au citron !');
  });

  it('finds the name being typed after "@", spaces included', () => {
    expect(mentionQuery('Regarde @tarte au')).toEqual({ start: 8, query: 'tarte au' });
    expect(mentionQuery('@')).toEqual({ start: 0, query: '' });
    expect(mentionQuery('(@crè')).toEqual({ start: 1, query: 'crè' });
    expect(mentionQuery('yona@example.fr')).toBeNull();
    expect(mentionQuery('@tarte\nau')).toBeNull();
  });

  it('writes the mentions chosen and still in the text', () => {
    expect(withMentions('Vu @Tarte au citron et @Examen blanc ?', [TARTE, EXAMEN])).toBe(
      'Vu @[Tarte au citron](RECIPE:12) et @[Examen blanc](CAP_ENTRY:7) ?',
    );
  });

  it('leaves as text a mention removed or changed by hand', () => {
    expect(withMentions('Vu @Tarte au citronnade', [TARTE])).toBe('Vu @Tarte au citronnade');
    expect(withMentions('Plus rien', [TARTE])).toBe('Plus rien');
  });

  it('writes the same thing mentioned twice', () => {
    expect(withMentions('@Tarte au citron, encore @Tarte au citron', [TARTE, TARTE])).toBe(
      '@[Tarte au citron](RECIPE:12), encore @[Tarte au citron](RECIPE:12)',
    );
  });

  it('takes the brackets out of a name', () => {
    expect(mentionLabel(' Pâte [sucrée]\n ')).toBe('Pâte sucrée');
  });
  it('reads the web addresses of a message, its punctuation left out', () => {
    expect(parseMessage('Vu https://www.marmiton.org/tarte.aspx, et toi ?')).toEqual([
      { text: 'Vu ' },
      { link: 'https://www.marmiton.org/tarte.aspx' },
      { text: ', et toi ?' },
    ]);
    expect(parseMessage('(https://fr.wikipedia.org/wiki/Tarte_(cuisine))')).toEqual([
      { text: '(' },
      { link: 'https://fr.wikipedia.org/wiki/Tarte_(cuisine)' },
      { text: ')' },
    ]);
  });

  it('finds the first web address, outside the mentions', () => {
    expect(firstLink('@[Tarte](RECIPE:2) puis https://site.fr/a et https://site.fr/b')).toBe('https://site.fr/a');
    expect(firstLink('Rien à lire')).toBeNull();
  });

  it('shows a web address shorter', () => {
    expect(shownLink('https://www.marmiton.org/recettes')).toBe('marmiton.org/recettes');
    expect(shownLink('https://site.fr/' + 'a'.repeat(80))).toHaveLength(58);
  });
});
