import { computed, signal } from '@angular/core';

/** Items ticked in a back-office list, for a bulk action. Read in templates: it is signal based. */
export class Selection<K> {
  private readonly keys = signal<ReadonlySet<K>>(new Set());

  readonly size = computed(() => this.keys().size);
  readonly ids = computed(() => [...this.keys()]);

  has(key: K): boolean {
    return this.keys().has(key);
  }

  /** Every one of these is ticked (false for none at all). */
  hasAll(keys: readonly K[]): boolean {
    return keys.length > 0 && keys.every((key) => this.keys().has(key));
  }

  toggle(key: K): void {
    this.keys.update((current) => {
      const next = new Set(current);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  }

  /** Ticks all of these, or unticks them when they all are already. */
  toggleAll(keys: readonly K[]): void {
    const untick = this.hasAll(keys);
    this.keys.update((current) => {
      const next = new Set(current);
      keys.forEach((key) => (untick ? next.delete(key) : next.add(key)));
      return next;
    });
  }

  clear(): void {
    this.keys.set(new Set());
  }
}
