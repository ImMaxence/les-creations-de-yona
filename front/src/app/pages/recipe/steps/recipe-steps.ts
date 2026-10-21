import { ChangeDetectionStrategy, Component, input, linkedSignal } from '@angular/core';
import { LucideCheck, LucideTimer } from '@lucide/angular';
import { Step } from '../../../core/api/generated/models/step';
import { MarkdownPipe } from '../../../shared/format/markdown.pipe';
import { formatMinutes } from '../../../shared/format/units';
import { Reveal } from '../../../shared/motion/reveal';

/** Numbered timeline of the steps; a tap on a number marks the step as done. */
@Component({
  selector: 'yona-recipe-steps',
  imports: [LucideCheck, LucideTimer, MarkdownPipe, Reveal],
  templateUrl: './recipe-steps.html',
  styleUrl: './recipe-steps.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeSteps {
  readonly steps = input.required<Step[]>();

  protected readonly formatMinutes = formatMinutes;
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
