import { Injectable } from '@angular/core';
import { storedSignal } from './stored-signal';

const STORAGE_KEY = 'yona-recipe-notes';
export const MAX_NOTE_LENGTH = 2000;
const MAX_NOTES = 200;

/** By recipe slug, the last written last. */
type NotesBySlug = Record<string, string>;

function isNotes(value: unknown): value is NotesBySlug {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((text) => typeof text === 'string')
  );
}

/**
 * "Mes notes" on a recipe ("10 min de plus dans mon four"), without any account: kept in this
 * browser only, like the favorites. An emptied note is forgotten; past 200 recipes, the note
 * written the longest ago goes.
 */
@Injectable({ providedIn: 'root' })
export class RecipeNotes {
  private readonly notes = storedSignal<NotesBySlug>(STORAGE_KEY, {}, isNotes);

  of(slug: string): string {
    return this.notes()[slug] ?? '';
  }

  write(slug: string, text: string): void {
    const note = text.slice(0, MAX_NOTE_LENGTH);
    this.notes.update((notes) => {
      const { [slug]: _previous, ...others } = notes;
      if (!note.trim()) {
        return others;
      }
      const kept = Object.entries(others).slice(-(MAX_NOTES - 1));
      return { ...Object.fromEntries(kept), [slug]: note };
    });
  }
}
