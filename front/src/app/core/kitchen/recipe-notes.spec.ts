import { TestBed } from '@angular/core/testing';
import { MAX_NOTE_LENGTH, RecipeNotes } from './recipe-notes';

describe('RecipeNotes', () => {
  let notes: RecipeNotes;

  beforeEach(() => {
    localStorage.clear();
    notes = TestBed.inject(RecipeNotes);
  });

  it('keeps a note by recipe, in the browser', () => {
    notes.write('tarte-au-citron', '10 min de plus dans mon four');
    expect(notes.of('tarte-au-citron')).toBe('10 min de plus dans mon four');
    expect(notes.of('brownies')).toBe('');
    expect(JSON.parse(localStorage.getItem('yona-recipe-notes')!)).toEqual({
      'tarte-au-citron': '10 min de plus dans mon four',
    });
  });

  it('forgets an emptied note', () => {
    notes.write('brownies', 'Moins de sucre');
    notes.write('brownies', '  ');
    expect(JSON.parse(localStorage.getItem('yona-recipe-notes')!)).toEqual({});
  });

  it('cuts a note too long', () => {
    notes.write('brownies', 'a'.repeat(MAX_NOTE_LENGTH + 10));
    expect(notes.of('brownies')).toHaveLength(MAX_NOTE_LENGTH);
  });

  it('keeps 200 notes at most, dropping the one written the longest ago', () => {
    for (let index = 0; index < 201; index++) {
      notes.write(`recette-${index}`, 'note');
    }
    expect(notes.of('recette-0')).toBe('');
    expect(notes.of('recette-1')).toBe('note');
    expect(notes.of('recette-200')).toBe('note');
  });
});
