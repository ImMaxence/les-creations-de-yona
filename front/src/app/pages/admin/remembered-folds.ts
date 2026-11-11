import { signal } from '@angular/core';

/**
 * The parts of a back-office page folded away (<details class="admin-fold">), opened or closed at
 * will and remembered in this browser: the page comes back as it was left.
 */
export class RememberedFolds {
  private readonly open = signal<ReadonlySet<string>>(new Set());

  constructor(
    private readonly key: string,
    /** Open the first time. */
    openFirst: readonly string[] = [],
  ) {
    this.open.set(this.read(openFirst));
  }

  isOpen(id: string): boolean {
    return this.open().has(id);
  }

  /** The (toggle) of a <details>: what it says it is now. */
  onToggle(id: string, event: Event): void {
    const open = (event.target as HTMLDetailsElement).open;
    if (open === this.isOpen(id)) {
      return;
    }
    const next = new Set(this.open());
    if (open) {
      next.add(id);
    } else {
      next.delete(id);
    }
    this.open.set(next);
    try {
      localStorage.setItem(this.key, JSON.stringify([...next]));
    } catch {
      // Storage blocked: kept for this visit only
    }
  }

  private read(openFirst: readonly string[]): ReadonlySet<string> {
    try {
      const stored = localStorage.getItem(this.key);
      const ids: unknown = stored === null ? openFirst : JSON.parse(stored);
      return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : openFirst);
    } catch {
      return new Set(openFirst);
    }
  }
}
