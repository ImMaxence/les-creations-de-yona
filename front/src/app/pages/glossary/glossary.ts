import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GlossaryTermResponse } from '../../core/api/generated/models/glossary-term-response';
import { fold } from '../../shared/format/glossary';
import { Reveal } from '../../shared/motion/reveal';
import { RECIPES_PATH } from '../../shared/routing/links';

interface Letter {
  letter: string;
  terms: GlossaryTermResponse[];
}

/**
 * "Glossaire de pâtisserie": every word explained in the recipe steps, by letter. Each word has
 * its anchor (/glossaire#chemiser), the target of "Tout le glossaire" in the steps.
 */
@Component({
  selector: 'yona-glossary',
  imports: [RouterLink, Reveal],
  templateUrl: './glossary.html',
  styleUrl: './glossary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Glossary {
  /** From glossaryResolver, sorted by name. */
  readonly terms = input<GlossaryTermResponse[]>([]);

  protected readonly recipesPath = RECIPES_PATH;
  /** "É" files under "E", as in a dictionary. */
  protected readonly letters = computed<Letter[]>(() => {
    const byLetter = new Map<string, GlossaryTermResponse[]>();
    for (const term of this.terms()) {
      const letter = fold(term.name).charAt(0).toUpperCase() || '#';
      byLetter.set(letter, [...(byLetter.get(letter) ?? []), term]);
    }
    return [...byLetter.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'fr'))
      .map(([letter, terms]) => ({ letter, terms }));
  });
}
