import { describe, expect, it } from 'vitest';
import { TextEdit, continueList, readLine, toggleInline, toggleLines, writeLine } from './markdown-edit';

const PLACEHOLDER = 'texte en gras';

/** The text with the selection drawn: "un [mot] ici". */
function shown(edit: TextEdit): string {
  return `${edit.text.slice(0, edit.start)}[${edit.text.slice(edit.start, edit.end)}]${edit.text.slice(edit.end)}`;
}

/** "un [mot] ici": the text, and what is selected between the brackets (a cursor: "[]"). */
function bold(marked: string): string {
  return shown(apply(marked, (text, start, end) => toggleInline(text, start, end, 'bold', PLACEHOLDER)));
}

function italic(marked: string): string {
  return shown(apply(marked, (text, start, end) => toggleInline(text, start, end, 'italic', 'texte en italique')));
}

function lines(marked: string, style: 'list' | 'title'): string {
  return shown(apply(marked, (text, start, end) => toggleLines(text, start, end, style)));
}

function apply(marked: string, edit: (text: string, start: number, end: number) => TextEdit): TextEdit {
  const start = marked.indexOf('[');
  const end = marked.indexOf(']') - 1;
  return edit(marked.replace('[', '').replace(']', ''), start, end);
}

describe('toggleInline', () => {
  it('puts the words selected in bold', () => {
    expect(bold('un [mot] ici')).toBe('un **[mot]** ici');
  });

  it('takes the bold off words already bold, without adding marks', () => {
    expect(bold('un **[mot]** ici')).toBe('un [mot] ici');
  });

  it('takes the bold off when the marks are selected too', () => {
    expect(bold('un [**mot**] ici')).toBe('un [mot] ici');
  });

  it('takes the bold off part of a bold passage only', () => {
    expect(bold('**il fait [beau] ce matin**')).toBe('**il fait** [beau] **ce matin**');
  });

  it('makes a selection partly bold bold in one passage', () => {
    expect(bold('[**un** deux **trois**]')).toBe('**[un deux trois]**');
    expect(bold('le **[beau** temps]')).toBe('le **[beau temps]**');
  });

  it('leaves the spaces around the selection outside the marks', () => {
    expect(bold('un[ mot ]ici')).toBe('un **[mot]** ici');
  });

  it('puts the word the cursor is in in bold, or takes it off', () => {
    expect(bold('un m[]ot ici')).toBe('un **[mot]** ici');
    expect(bold('un **m[]ot** ici')).toBe('un [mot] ici');
  });

  it('takes the bold off the passage the cursor touches', () => {
    expect(bold('un **mot**[] ici')).toBe('un [mot] ici');
  });

  it('writes the placeholder selected outside any word', () => {
    expect(bold('[]')).toBe('**[texte en gras]**');
    expect(bold('un mot []')).toBe('un mot **[texte en gras]**');
  });

  it('writes the placeholder after the marker of a list item', () => {
    expect(bold('[]- ')).toBe('- **[texte en gras]**');
  });

  it('keeps italics and bold together', () => {
    expect(italic('**[gras]**')).toBe('***[gras]***');
    expect(bold('*[penché]*')).toBe('***[penché]***');
    expect(bold('***[les deux]***')).toBe('*[les deux]*');
    expect(italic('***[les deux]***')).toBe('**[les deux]**');
  });

  it('takes italics off without touching the bold', () => {
    expect(italic('un *[mot]* ici')).toBe('un [mot] ici');
  });

  it('puts each line of a list in bold, its marker left out', () => {
    expect(bold('[- un\n- deux]')).toBe('- **[un**\n- **deux]**');
    expect(bold('- **[un**\n- **deux]**')).toBe('- [un\n- deux]');
  });

  it('leaves asterisks that are text as they are', () => {
    expect(bold('2 * 3 = [6]')).toBe('2 * 3 = **[6]**');
    expect(bold('un \\*[mot]\\*')).toBe('un \\***[mot]**\\*');
  });

  it('keeps the other lines as they are', () => {
    expect(bold('*un*\n[deux]\n**trois**')).toBe('*un*\n**[deux]**\n**trois**');
  });
});

describe('readLine and writeLine', () => {
  it('read the styles as CommonMark does', () => {
    const line = readLine('- **gras** *penché* ***les deux*** 2 * 3');

    expect(line.prefix).toBe('- ');
    expect(line.chars.map((styled) => styled.char).join('')).toBe('gras penché les deux 2 * 3');
    expect(line.chars.filter((styled) => styled.bold).map((styled) => styled.char).join('')).toBe('grasles deux');
    expect(line.chars.filter((styled) => styled.italic).map((styled) => styled.char).join('')).toBe('penchéles deux');
  });

  it('write a line back as it was read', () => {
    for (const text of ['un **mot** ici', '***a** b*', '**a *b* c**', 'sans rien', '2 * 3', '*un* **deux**']) {
      expect(writeLine(readLine(text).chars).text).toBe(text);
    }
  });

  it('keep styles off the spaces at their ends', () => {
    const chars = [...'un mot '].map((char, index) => ({ char, bold: index >= 2, italic: false }));

    expect(writeLine(chars).text).toBe('un **mot** ');
  });
});

describe('toggleLines', () => {
  it('makes a list of the lines selected', () => {
    expect(lines('[un\ndeux]', 'list')).toBe('[- un\n- deux]');
  });

  it('takes the lines out of the list when all are in it', () => {
    expect(lines('[- un\n- deux]', 'list')).toBe('[un\ndeux]');
  });

  it('completes a list partly made', () => {
    expect(lines('[- un\ndeux]', 'list')).toBe('[- un\n- deux]');
  });

  it('changes the line of the cursor, the cursor kept in its text', () => {
    expect(lines('un\nde[]ux\ntrois', 'list')).toBe('un\n- de[]ux\ntrois');
    expect(lines('un\n- de[]ux\ntrois', 'list')).toBe('un\nde[]ux\ntrois');
  });

  it('turns an intertitle or a numbered line into a list item', () => {
    expect(lines('[## Titre]', 'list')).toBe('[- Titre]');
    expect(lines('[1. un\n2. deux]', 'list')).toBe('[- un\n- deux]');
  });

  it('leaves empty lines alone, unless the line is empty', () => {
    expect(lines('[un\n\ndeux]', 'list')).toBe('[- un\n\n- deux]');
    expect(lines('[]', 'list')).toBe('- []');
  });

  it('leaves alone the line the selection ends at the start of', () => {
    expect(lines('[un\n]deux', 'list')).toBe('[- un\n]deux');
  });

  it('puts an intertitle on or off', () => {
    expect(lines('Ti[]tre', 'title')).toBe('## Ti[]tre');
    expect(lines('## Ti[]tre', 'title')).toBe('Ti[]tre');
    expect(lines('- it[]em', 'title')).toBe('## it[]em');
    expect(lines('### Pe[]tit', 'title')).toBe('## Pe[]tit');
  });
});

describe('continueList', () => {
  it('starts the next item', () => {
    expect(continueList('- un', 4, 4)).toEqual({ text: '- un\n- ', start: 7, end: 7 });
    expect(continueList('  * un', 6, 6)).toEqual({ text: '  * un\n  * ', start: 11, end: 11 });
  });

  it('counts a numbered list on', () => {
    expect(continueList('1. un', 5, 5)).toEqual({ text: '1. un\n2. ', start: 9, end: 9 });
    expect(continueList('9) neuf', 7, 7)).toEqual({ text: '9) neuf\n10) ', start: 12, end: 12 });
  });

  it('splits an item at the cursor', () => {
    expect(continueList('- undeux', 4, 4)).toEqual({ text: '- un\n- deux', start: 7, end: 7 });
  });

  it('ends the list on an empty item', () => {
    expect(continueList('- un\n- ', 7, 7)).toEqual({ text: '- un\n', start: 5, end: 5 });
  });

  it('does nothing outside a list, in a marker, or with words selected', () => {
    expect(continueList('du texte', 8, 8)).toBeNull();
    expect(continueList('- un', 1, 1)).toBeNull();
    expect(continueList('- un', 2, 4)).toBeNull();
  });
});
