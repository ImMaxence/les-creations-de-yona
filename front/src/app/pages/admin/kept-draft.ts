import { DestroyRef, inject } from '@angular/core';

/** A form typed and not saved yet, kept in this browser: a closed tab or a sleeping phone loses nothing. */
export interface KeptDraft<T> {
  savedAt: string;
  /** updatedAt of what it was typed on; null when it was new. */
  basedOn: string | null;
  draft: T;
}

/** Written this long after the last change; at once when the tab is hidden. */
export const KEEP_DELAY_MS = 800;

/** The draft kept under that key, if it is one (a key written by an older version is dropped). */
export function readKeptDraft<T>(key: string, isDraft: (value: unknown) => value is T): KeptDraft<T> | null {
  try {
    const kept = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<KeptDraft<unknown>> | null;
    if (kept && typeof kept.savedAt === 'string' && isDraft(kept.draft)) {
      return { savedAt: kept.savedAt, basedOn: typeof kept.basedOn === 'string' ? kept.basedOn : null, draft: kept.draft };
    }
  } catch {
    // Storage blocked, or not JSON: nothing to offer
  }
  return null;
}

export function writeKeptDraft<T>(key: string, kept: KeptDraft<T>): void {
  try {
    localStorage.setItem(key, JSON.stringify(kept));
  } catch {
    // Storage blocked or full: the form still works, it just isn't kept
  }
}

export function forgetKeptDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage blocked: nothing was kept
  }
}

/**
 * Keeps a form in this browser while it differs from what is saved: shortly after each change
 * (`changed()`), and at once when the tab is hidden (a phone locked, another app opened). Call in
 * an injection context; `current()` says what to keep, or null when there is nothing unsaved.
 */
export class DraftKeeper<T> {
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly key: () => string,
    private readonly current: () => KeptDraft<T> | null,
    /** False while the form must not be written (loading, or an older draft being offered). */
    private readonly active: () => boolean,
  ) {
    const flush = () => {
      if (document.visibilityState === 'hidden') {
        this.keepNow();
      }
    };
    document.addEventListener('visibilitychange', flush);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('visibilitychange', flush);
      clearTimeout(this.timer);
    });
  }

  /** The form changed: written a moment later, once the typing pauses. */
  changed(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.keepNow(), KEEP_DELAY_MS);
  }

  keepNow(): void {
    clearTimeout(this.timer);
    if (!this.active()) {
      return;
    }
    const kept = this.current();
    if (kept) {
      writeKeptDraft(this.key(), kept);
    } else {
      forgetKeptDraft(this.key());
    }
  }

  /** Saved or thrown away: nothing left to offer. */
  forget(key = this.key()): void {
    clearTimeout(this.timer);
    forgetKeptDraft(key);
  }
}
