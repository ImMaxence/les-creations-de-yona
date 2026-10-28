import { ChangeDetectionStrategy, Component, input, linkedSignal } from '@angular/core';
import { Step } from '../../../core/api/generated/models/step';
import { GlossaryMatcher, GlossaryPipe, NO_GLOSSARY } from '../../../shared/format/glossary';
import { MarkdownPipe } from '../../../shared/format/markdown.pipe';
import { formatMinutes } from '../../../shared/format/units';
import { Reveal } from '../../../shared/motion/reveal';
import { GlossaryPopover } from '../../../shared/ui/glossary-popover/glossary-popover';
import { Icon } from '../../../shared/ui/icon/icon';
import { stepAnchor } from '../recipe-parts';

/**
 * Numbered timeline of the steps of a part; a tap on a number marks the step as done, a tap on an
 * underlined word shows its definition from the glossary.
 */
@Component({
  selector: 'yona-recipe-steps',
  imports: [Icon, GlossaryPipe, GlossaryPopover, MarkdownPipe, Reveal],
  templateUrl: './recipe-steps.html',
  styleUrl: './recipe-steps.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeSteps {
  readonly steps = input.required<Step[]>();
  readonly glossary = input<GlossaryMatcher>(NO_GLOSSARY);
  /** Its number (from 1) in a recipe in parts, for the anchors of the steps; null without parts. */
  readonly part = input<number | null>(null);

  protected readonly formatMinutes = formatMinutes;
  protected readonly stepAnchor = stepAnchor;
  protected readonly done = linkedSignal<Step[], ReadonlySet<number>>({
    source: this.steps,
    computation: () => new Set(),
  });

  protected toggle(index: number): void {
    this.done.update((current) => {
      const next = new Set(current);
      if (!next.delete(index)) {
        next.add(index);
      }
      return next;
    });
  }
}
