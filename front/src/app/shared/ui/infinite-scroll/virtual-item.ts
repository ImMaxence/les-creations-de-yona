import { DestroyRef, Directive, ElementRef, Injectable, afterNextRender, inject, signal } from '@angular/core';

/** Rendered one and a half screens above and below: scrolling never reaches an empty item. */
const NEAR_SCREEN = '150% 0px';

type Reaction = (entry: IntersectionObserverEntry) => void;

/** One observer for the whole list. */
@Injectable({ providedIn: 'root' })
class NearScreen {
  private readonly reactions = new WeakMap<Element, Reaction>();
  private observer?: IntersectionObserver;

  watch(element: Element, reaction: Reaction): void {
    this.observer ??= new IntersectionObserver((entries) => entries.forEach((entry) => this.reactions.get(entry.target)?.(entry)), {
      rootMargin: NEAR_SCREEN,
    });
    this.reactions.set(element, reaction);
    this.observer.observe(element);
  }

  unwatch(element: Element): void {
    this.observer?.unobserve(element);
  }
}

/**
 * Virtual scrolling for a grid of any shape: the item stays in the list at its height, what it
 * holds is only rendered near the screen. `<li yonaVirtualItem #item="virtualItem">`, then
 * `@if (item.near()) { … }`. Everything is rendered on the server and on arrival.
 */
@Directive({
  selector: '[yonaVirtualItem]',
  exportAs: 'virtualItem',
  host: { '[style.min-height.px]': 'height()' },
})
export class VirtualItem {
  private readonly element: HTMLElement = inject(ElementRef).nativeElement;

  readonly near = signal(true);
  protected readonly height = signal<number | null>(null);

  constructor() {
    const nearScreen = inject(NearScreen);
    afterNextRender(() => nearScreen.watch(this.element, (entry) => this.react(entry)));
    inject(DestroyRef).onDestroy(() => nearScreen.unwatch(this.element));
  }

  private react(entry: IntersectionObserverEntry): void {
    // The field or button in use stays, however far the page is scrolled
    if (!entry.isIntersecting && this.element.contains(this.element.ownerDocument.activeElement)) {
      return;
    }
    this.height.set(entry.isIntersecting ? null : entry.boundingClientRect.height);
    this.near.set(entry.isIntersecting);
  }
}
