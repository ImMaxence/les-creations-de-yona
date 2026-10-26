import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { GlossaryTermResponse } from '../../../core/api/generated/models/glossary-term-response';
import { GlossaryMatcher, termAt } from '../../format/glossary';
import { GLOSSARY_PATH } from '../../routing/links';
import { Icon } from '../icon/icon';

const GAP_PX = 8;
const MARGIN_PX = 12;

/**
 * The definition of a glossary word of the steps, under the word (above it near the bottom of the
 * screen). A popover in the top layer: shown above the cooking mode too, closed by a tap elsewhere,
 * Escape or scrolling. The steps call {@link handle} from their click and keydown events.
 */
@Component({
  selector: 'yona-glossary-popover',
  imports: [Icon, RouterLink],
  template: `
    <div #panel class="popover" popover="auto" role="dialog" [attr.aria-label]="term()?.name" (toggle)="onToggle($event)">
      @if (term(); as shown) {
        <p class="popover__name"><svg yonaIcon="book-a" [size]="16"></svg>{{ shown.name }}</p>
        <p class="popover__definition">{{ shown.definition }}</p>
        <a class="popover__link" [routerLink]="glossaryPath" [fragment]="shown.slug" (click)="hide()">Tout le glossaire</a>
      }
    </div>
  `,
  styleUrl: './glossary-popover.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlossaryPopover {
  protected readonly glossaryPath = GLOSSARY_PATH;
  protected readonly term = signal<GlossaryTermResponse | null>(null);
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly hideOnScroll = () => this.hide();

  constructor() {
    inject(DestroyRef).onDestroy(() => window.removeEventListener('scroll', this.hideOnScroll, true));
  }

  /** Opens the definition when the event is a tap, Enter or Space on a glossary word. */
  handle(event: Event, matcher: GlossaryMatcher): void {
    if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    const found = termAt(event, matcher);
    if (!found) {
      return;
    }
    event.preventDefault();
    // A tap on a step marks it as done elsewhere: not when it was meant for a word
    event.stopPropagation();
    this.show(found.term, found.element);
  }

  hide(): void {
    const panel = this.panel().nativeElement;
    if (panel.matches(':popover-open')) {
      panel.hidePopover();
    }
  }

  protected onToggle(event: Event): void {
    if ((event as ToggleEvent).newState === 'closed') {
      window.removeEventListener('scroll', this.hideOnScroll, true);
    }
  }

  private show(term: GlossaryTermResponse, anchor: HTMLElement): void {
    const panel = this.panel().nativeElement;
    if (typeof panel.showPopover !== 'function') {
      // Without the Popover API (old browsers): the definition stays in the word's title
      return;
    }
    this.term.set(term);
    if (!panel.matches(':popover-open')) {
      panel.showPopover();
    }
    // Placed once its content is known: under the word, inside the screen
    requestAnimationFrame(() => {
      const word = anchor.getBoundingClientRect();
      const box = panel.getBoundingClientRect();
      const left = Math.min(Math.max(MARGIN_PX, word.left + word.width / 2 - box.width / 2), innerWidth - box.width - MARGIN_PX);
      const below = word.bottom + GAP_PX;
      const top = below + box.height > innerHeight - MARGIN_PX ? word.top - box.height - GAP_PX : below;
      panel.style.left = `${Math.max(MARGIN_PX, left)}px`;
      panel.style.top = `${Math.max(MARGIN_PX, top)}px`;
    });
    window.addEventListener('scroll', this.hideOnScroll, { capture: true, passive: true, once: true });
  }
}
