import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  inject,
  input,
  signal,
} from '@angular/core';

type RevealState = 'visible' | 'pending' | 'revealed';

/**
 * Fades and lifts an element in the first time it scrolls into view.
 *
 * - Content already on screen when the page loads is left alone: the server-rendered page never
 *   hides anything, and there is no flash during hydration.
 * - Nothing moves with prefers-reduced-motion.
 * - Put it on a wrapper (section, list item), not on an element with its own hover transition:
 *   the reveal transition would slow it down.
 */
@Directive({
  selector: '[yonaReveal]',
  host: {
    '[class.reveal-pending]': "state() === 'pending'",
    '[class.reveal-done]': "state() === 'revealed'",
    '[style.--reveal-delay]': "revealDelay() + 'ms'",
  },
})
export class Reveal {
  /** Stagger between siblings, in milliseconds. */
  readonly revealDelay = input(0);

  protected readonly state = signal<RevealState>('visible');

  constructor() {
    const element: HTMLElement = inject(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const alreadyOnScreen = element.getBoundingClientRect().top < window.innerHeight;
      if (reducedMotion || alreadyOnScreen) {
        return;
      }

      this.state.set('pending');
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            this.state.set('revealed');
            observer.disconnect();
          }
        },
        { rootMargin: '0px 0px -8% 0px' },
      );
      observer.observe(element);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
