import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  booleanAttribute,
  computed,
  inject,
  input,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { InfiniteList } from './infinite-list';

/** The next page is asked for this far before the end of the list comes on screen. */
const LOAD_AHEAD = '800px 0px';

/**
 * Put after a list: loads its next page when the visitor gets near. Also what is said while it
 * loads or when it fails, and a link or button for browsers and readers that do not scroll.
 */
@Component({
  selector: 'yona-infinite-scroll',
  template: `
    @if (list().failed()) {
      <p class="note" role="alert">La suite n'a pas pu se charger</p>
      <button type="button" class="more" (click)="list().reload()">Réessayer</button>
    } @else if (list().isLoadingMore()) {
      <p class="note" role="status"><span class="spinner" aria-hidden="true"></span>Chargement…</p>
    } @else if (list().hasMore()) {
      @if (nextHref(); as href) {
        <a class="more" [href]="href" (click)="$event.preventDefault(); list().loadMore()">Afficher la suite</a>
      } @else {
        <button type="button" class="more" (click)="list().loadMore()">Afficher la suite</button>
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: var(--space-2) var(--space-3);
    }

    :host(:not(:empty)) {
      padding-block: var(--space-3);
    }

    .note {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding-block: var(--space-2);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    .spinner {
      width: 1.125rem;
      height: 1.125rem;
      border: 2px solid var(--color-line);
      border-top-color: var(--color-accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .more {
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-pill);
      box-shadow: inset 0 0 0 1px var(--color-line);
      font-size: var(--text-sm);
      font-weight: 600;
      text-decoration: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfiniteScroll {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly list = input.required<InfiniteList<any, any>>();
  /** Lists with an address of their own: a true link to ?page=n, for search engines. */
  readonly linked = input(false, { transform: booleanAttribute });

  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private observer?: IntersectionObserver;

  protected readonly nextHref = computed(() => {
    const next = this.list().nextPage();
    this.list().items(); // other filters give another address
    return this.linked() && next !== null
      ? this.router.serializeUrl(
          this.router.createUrlTree([], { relativeTo: this.route, queryParams: { page: next + 1 }, queryParamsHandling: 'merge' }),
        )
      : null;
  });

  constructor() {
    // An observer only speaks when something changes: with a page too short to fill the screen,
    // the list would stop there. Observing again after each load makes it report where it is.
    afterRenderEffect(() => {
      const list = this.list();
      list.items();
      this.observer?.disconnect();
      if (list.hasMore() && !list.isLoading() && !list.isLoadingMore() && !list.failed()) {
        this.observer ??= new IntersectionObserver(
          (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
              void this.list().loadMore();
            }
          },
          { rootMargin: LOAD_AHEAD },
        );
        this.observer.observe(this.host);
      }
    });
    inject(DestroyRef).onDestroy(() => this.observer?.disconnect());
  }
}
