import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';

type PageItem = { kind: 'page'; page: number } | { kind: 'gap'; key: string };

/**
 * Numbered pagination made of real links (?page=n), so that every page can be crawled and opened
 * in a new tab. The current query parameters are kept; page 1 has no parameter at all.
 * With "buttons" (a list without a URL of its own, in a dialog), the page chosen comes out of
 * (pageChange) instead.
 */
@Component({
  selector: 'yona-pagination',
  imports: [RouterLink, LucideChevronLeft, LucideChevronRight],
  templateUrl: './pagination.html',
  styleUrl: './pagination.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pagination {
  /** Current page, starting at 1. */
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly buttons = input(false, { transform: booleanAttribute });
  /** With "buttons": the page chosen, starting at 1. */
  readonly pageChange = output<number>();

  protected readonly items = computed(() => pageItems(this.page(), this.totalPages()));

  protected queryParams(page: number): { page: number | null } {
    return { page: page === 1 ? null : page };
  }
}

/** 1 … 4 5 6 … 12: first, last, and the neighbours of the current page. */
function pageItems(current: number, total: number): PageItem[] {
  const pages = [...new Set([1, current - 1, current, current + 1, total])]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);

  const items: PageItem[] = [];
  pages.forEach((page, index) => {
    const previous = pages[index - 1];
    if (previous !== undefined && page - previous === 2) {
      items.push({ kind: 'page', page: previous + 1 });
    } else if (previous !== undefined && page - previous > 2) {
      items.push({ kind: 'gap', key: `gap-${page}` });
    }
    items.push({ kind: 'page', page });
  });
  return items;
}
