import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Icon } from '../../../shared/ui/icon/icon';

/**
 * The arrow behind a message slid toward the middle with a finger, as on Instagram: shown while it slides
 * (.is-swiping on the message), coloured once far enough to answer it (.is-swiped).
 */
@Component({
  selector: 'yona-swipe-hint',
  imports: [Icon],
  template: `<svg yonaIcon="reply" [size]="18"></svg>`,
  styles: `
    :host {
      position: absolute;
      top: 50%;
      left: 0.25rem;
      display: grid;
      place-items: center;
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      background-color: color-mix(in srgb, var(--color-text) 8%, var(--color-surface));
      color: var(--color-text-muted);
      opacity: 0;
      transform: translateY(-50%) scale(0.6);
      transition:
        opacity var(--duration-fast) var(--ease-out),
        transform var(--duration-fast) var(--ease-out);
      pointer-events: none;
    }

    /* One's own messages slide to the left: the arrow on the right */
    :host-context(.is-mine) {
      right: 0.25rem;
      left: auto;
    }

    :host-context(.is-swiping) {
      opacity: 1;
    }

    :host-context(.is-swiped) {
      background-color: var(--color-accent);
      color: var(--color-on-accent);
      transform: translateY(-50%) scale(1);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class SwipeHint {}
