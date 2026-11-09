import { Location } from '@angular/common';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';

/** A page of a list, as every paged route of the API answers. */
export interface PageOf<T> {
  content: T[];
  /** From 0. */
  page: number;
  totalPages: number;
  totalElements: number;
}

export interface InfiniteListOptions<T, P> {
  /** One page of the list, the first being 0. */
  load: (page: number, params: P) => Promise<PageOf<T>>;
  /** Tells two items apart: one added while reading pushes the others on, and the next page repeats one. */
  key: (item: T) => unknown;
  /** What the list shows: a change starts it over. Undefined: nothing to load for now (a closed dialog). */
  params?: () => P | undefined;
  /** The first page when a resolver already holds it, for the server to render it. */
  first?: () => PageOf<T> | undefined;
}

interface Held<T> {
  items: T[];
  /** The page the list starts from: not 0 on an address such as ?page=3. */
  firstPage: number;
  pageCount: number;
  totalPages: number;
  totalElements: number;
}

const REMEMBERED_LISTS = 5;

/**
 * The lists read further than their first page. Back on one of them, its items must be there at
 * once for the router to scroll to where the visitor was.
 */
@Injectable({ providedIn: 'root' })
class InfiniteMemory {
  private readonly lists = new Map<string, unknown>();

  recall<T>(key: string): Held<T> | undefined {
    return this.lists.get(key) as Held<T> | undefined;
  }

  remember<T>(key: string, list: Held<T>): void {
    this.lists.delete(key);
    this.lists.set(key, list);
    if (this.lists.size > REMEMBERED_LISTS) {
      this.lists.delete(this.lists.keys().next().value as string);
    }
  }
}

/**
 * A paged list read as one long list: the pages add up as the visitor goes down (see
 * InfiniteScroll). Create it in a field of a component.
 */
export class InfiniteList<T, P = null> {
  private readonly memory = inject(InfiniteMemory);
  private readonly location = inject(Location);
  /** Back on the list with the browser's button: the first start finds it as it was left. */
  private comingBack = inject(Router).currentNavigation()?.trigger === 'popstate';

  private readonly held = signal<Held<T> | null>(null);
  /** Each start or reload gets its number: what comes back for an older one is ignored. */
  private run = 0;
  private firstShown: PageOf<T> | undefined;

  readonly items = computed<readonly T[]>(() => this.held()?.items ?? []);
  readonly totalElements = computed(() => this.held()?.totalElements ?? 0);
  /** From 0. */
  readonly firstPage = computed(() => this.held()?.firstPage ?? 0);
  /** From 0; null at the end of the list. */
  readonly nextPage = computed(() => {
    const held = this.held();
    const next = held ? held.firstPage + held.pageCount : 0;
    return held && next < held.totalPages ? next : null;
  });
  readonly hasMore = computed(() => this.nextPage() !== null);
  /** The list is starting or being refreshed; what it held stays on screen until then. */
  readonly isLoading = signal(false);
  readonly isLoadingMore = signal(false);
  readonly failed = signal(false);
  readonly isEmpty = computed(() => this.held()?.items.length === 0 && !this.isLoading() && !this.failed());

  constructor(private readonly options: InfiniteListOptions<T, P>) {
    effect(() => {
      const first = options.first?.();
      const params = this.params();
      untracked(() => this.start(params, first));
    });
  }

  async loadMore(): Promise<void> {
    const next = this.nextPage();
    const params = this.params();
    if (next === null || params === undefined || this.isLoading() || this.isLoadingMore() || this.failed()) {
      return;
    }
    const run = this.run;
    this.isLoadingMore.set(true);
    try {
      const page = await this.options.load(next, params);
      if (run === this.run) {
        const held = this.held()!;
        this.hold(params, {
          ...held,
          items: this.distinct([...held.items, ...page.content]),
          pageCount: held.pageCount + 1,
          totalPages: page.totalPages,
          totalElements: page.totalElements,
        });
      }
    } catch {
      if (run === this.run) {
        this.failed.set(true);
      }
    } finally {
      if (run === this.run) {
        this.isLoadingMore.set(false);
      }
    }
  }

  /** After a change or a failure: every page held is read again, and the list keeps its length. */
  reload(): void {
    const params = this.params();
    if (params === undefined) {
      return;
    }
    const held = this.held();
    const run = this.begin();
    this.isLoading.set(true);
    void this.fetch(params, held?.firstPage ?? 0, held?.pageCount ?? 1, run);
  }

  private start(params: P | undefined, first: PageOf<T> | undefined): void {
    // Only the number of people changed, for instance: the visitor keeps what they scrolled through
    if (first && this.isFirstShown(first)) {
      this.firstShown = first;
      return;
    }
    this.firstShown = first;
    const run = this.begin();

    const comingBack = this.comingBack;
    this.comingBack = false;
    const remembered = comingBack && params !== undefined ? this.memory.recall<T>(this.memoryKey(params)) : undefined;
    if (remembered) {
      this.held.set(remembered);
      if (!first) {
        // Without a word: it may have been changed from the page just left
        void this.fetch(params as P, remembered.firstPage, remembered.pageCount, run);
      }
    } else if (first) {
      this.held.set(this.holding([first]));
    } else if (params === undefined) {
      this.held.set(null);
    } else {
      this.isLoading.set(true);
      void this.fetch(params, 0, 1, run);
    }
  }

  private begin(): number {
    this.isLoading.set(false);
    this.isLoadingMore.set(false);
    this.failed.set(false);
    return ++this.run;
  }

  private async fetch(params: P, firstPage: number, count: number, run: number): Promise<void> {
    try {
      const pages = await Promise.all(Array.from({ length: count }, (_, index) => this.options.load(firstPage + index, params)));
      if (run === this.run) {
        this.hold(params, this.holding(pages));
      }
    } catch {
      if (run === this.run) {
        this.failed.set(true);
      }
    } finally {
      if (run === this.run) {
        this.isLoading.set(false);
      }
    }
  }

  private hold(params: P, held: Held<T>): void {
    this.held.set(held);
    if (held.pageCount > 1) {
      this.memory.remember(this.memoryKey(params), held);
    }
  }

  private holding(pages: PageOf<T>[]): Held<T> {
    const last = pages[pages.length - 1];
    return {
      items: this.distinct(pages.flatMap((page) => page.content)),
      firstPage: pages[0].page,
      pageCount: pages.length,
      totalPages: last.totalPages,
      totalElements: last.totalElements,
    };
  }

  private distinct(items: T[]): T[] {
    const seen = new Set<unknown>();
    return items.filter((item) => {
      const key = this.options.key(item);
      return !seen.has(key) && !!seen.add(key);
    });
  }

  private isFirstShown(first: PageOf<T>): boolean {
    const shown = this.firstShown;
    return (
      !!shown &&
      shown.page === first.page &&
      shown.totalElements === first.totalElements &&
      shown.content.length === first.content.length &&
      shown.content.every((item, index) => this.options.key(item) === this.options.key(first.content[index]))
    );
  }

  private params(): P | undefined {
    return this.options.params ? this.options.params() : (null as P);
  }

  private memoryKey(params: P): string {
    return `${this.location.path()} ${JSON.stringify(params)}`;
  }
}
