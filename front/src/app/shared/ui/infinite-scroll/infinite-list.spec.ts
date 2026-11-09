import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { InfiniteList, InfiniteListOptions, PageOf } from './infinite-list';

interface Item {
  id: number;
}

function pageOf(page: number, ids: number[], totalPages = 3): PageOf<Item> {
  return { content: ids.map((id) => ({ id })), page, totalPages, totalElements: totalPages * 2 };
}

const ids = (list: InfiniteList<Item, string>) => list.items().map((item) => item.id);

describe('InfiniteList', () => {
  let trigger: string | undefined;

  beforeEach(() => {
    trigger = undefined;
    TestBed.configureTestingModule({
      providers: [
        { provide: Location, useValue: { path: () => '/recettes' } },
        { provide: Router, useValue: { currentNavigation: () => (trigger ? { trigger } : null) } },
      ],
    });
  });

  function create(load: InfiniteListOptions<Item, string>['load'], options: Partial<InfiniteListOptions<Item, string>> = {}) {
    return TestBed.runInInjectionContext(
      () => new InfiniteList<Item, string>({ load, key: (item) => item.id, params: () => 'all', ...options }),
    );
  }

  async function settled(): Promise<void> {
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
  }

  it('adds the next pages up, and stops at the last one', async () => {
    const list = create(async (page) => pageOf(page, [page * 2, page * 2 + 1]));
    await settled();
    expect(ids(list)).toEqual([0, 1]);
    expect(list.nextPage()).toBe(1);

    await list.loadMore();
    await list.loadMore();
    expect(ids(list)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(list.hasMore()).toBe(false);
  });

  it('shows once an item pushed onto the next page', async () => {
    const list = create(async (page) => (page === 0 ? pageOf(0, [1, 2]) : pageOf(1, [2, 3])));
    await settled();
    await list.loadMore();
    expect(ids(list)).toEqual([1, 2, 3]);
  });

  it('starts over when the filters change, ignoring a page still on its way', async () => {
    const filter = signal('a');
    let answerLate: (page: PageOf<Item>) => void = () => undefined;
    const list = create(
      (page, params) => {
        if (params === 'a' && page === 1) {
          return new Promise((resolve) => (answerLate = resolve));
        }
        return Promise.resolve(pageOf(page, params === 'a' ? [1, 2] : [8, 9]));
      },
      { params: filter },
    );
    await settled();
    const late = list.loadMore();

    filter.set('b');
    await settled();
    answerLate(pageOf(1, [3, 4]));
    await late;
    expect(ids(list)).toEqual([8, 9]);
    expect(list.isLoadingMore()).toBe(false);
  });

  it('loads nothing while it has nothing to show', async () => {
    const load = vi.fn(async (page: number) => pageOf(page, [1]));
    const open = signal(false);
    const list = create(load, { params: () => (open() ? 'all' : undefined) });
    await settled();
    expect(load).not.toHaveBeenCalled();

    open.set(true);
    await settled();
    expect(ids(list)).toEqual([1]);
    open.set(false);
    await settled();
    expect(ids(list)).toEqual([]);
    expect(list.isEmpty()).toBe(false);
  });

  it('says when the list is empty', async () => {
    const list = create(async () => ({ content: [], page: 0, totalPages: 0, totalElements: 0 }));
    await settled();
    expect(list.isEmpty()).toBe(true);
    expect(list.hasMore()).toBe(false);
  });

  describe('with its first page from a resolver', () => {
    it('starts from it, without loading it again', async () => {
      const load = vi.fn(async (page: number) => pageOf(page, [3, 4]));
      const list = create(load, { first: () => pageOf(0, [1, 2]) });
      await settled();
      expect(ids(list)).toEqual([1, 2]);
      expect(load).not.toHaveBeenCalled();

      await list.loadMore();
      expect(load).toHaveBeenCalledExactlyOnceWith(1, 'all');
      expect(ids(list)).toEqual([1, 2, 3, 4]);
    });

    it('continues from the page of the address', async () => {
      const list = create(async (page) => pageOf(page, [page]), { first: () => pageOf(2, [2], 4) });
      await settled();
      expect(list.firstPage()).toBe(2);
      expect(list.nextPage()).toBe(3);
    });

    it('keeps what was scrolled through when the same page comes back', async () => {
      const first = signal(pageOf(0, [1, 2]));
      const list = create(async (page) => pageOf(page, [3, 4]), { first });
      await settled();
      await list.loadMore();

      first.set(pageOf(0, [1, 2]));
      await settled();
      expect(ids(list)).toEqual([1, 2, 3, 4]);

      first.set(pageOf(0, [7]));
      await settled();
      expect(ids(list)).toEqual([7]);
    });
  });

  it('reads again every page held on a reload', async () => {
    let version = 0;
    const list = create(async (page) => pageOf(page, [version + page * 10]));
    await settled();
    await list.loadMore();
    expect(ids(list)).toEqual([0, 10]);

    version = 1;
    list.reload();
    await settled();
    expect(ids(list)).toEqual([1, 11]);
    expect(list.isLoading()).toBe(false);
  });

  it('says a failure, stops, and starts again on a retry', async () => {
    let broken = false;
    const list = create(async (page) => {
      if (broken) {
        throw new Error('network');
      }
      return pageOf(page, [page]);
    });
    await settled();
    broken = true;
    await list.loadMore();
    expect(list.failed()).toBe(true);
    expect(ids(list)).toEqual([0]);

    await list.loadMore();
    expect(list.failed()).toBe(true);

    broken = false;
    list.reload();
    await settled();
    expect(list.failed()).toBe(false);
    expect(list.hasMore()).toBe(true);
  });

  describe('back on the list', () => {
    async function leftAfterTwoPages(): Promise<void> {
      const list = create(async (page) => pageOf(page, [page]));
      await settled();
      await list.loadMore();
    }

    it('finds at once the pages left, then refreshes them', async () => {
      await leftAfterTwoPages();

      trigger = 'popstate';
      let answer: (page: PageOf<Item>) => void = () => undefined;
      const list = create((page) => new Promise((resolve) => (answer = () => resolve(pageOf(page, [page + 100])))));
      TestBed.tick();
      expect(ids(list)).toEqual([0, 1]);
      expect(list.isLoading()).toBe(false);

      answer(pageOf(0, []));
      await settled();
      expect(list.nextPage()).toBe(2);
    });

    it('starts from the top on a new visit', async () => {
      await leftAfterTwoPages();
      const list = create(async (page) => pageOf(page, [page]));
      await settled();
      expect(ids(list)).toEqual([0]);
    });

    it('does not mistake another list for it', async () => {
      await leftAfterTwoPages();
      trigger = 'popstate';
      const list = create(async (page) => pageOf(page, [50]), { params: () => 'other' });
      await settled();
      expect(ids(list)).toEqual([50]);
    });
  });
});
