import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, PLATFORM_ID, WritableSignal, afterNextRender, inject, signal } from '@angular/core';

/**
 * A signal kept in the visitor's browser (localStorage), for what the site remembers without any
 * account: favorites, shopping list. Read after the first render, so that the page rendered by
 * the server (which knows nothing of it) hydrates unchanged; written on each change; followed in
 * the other tabs of the site. A blocked storage (private browsing) keeps it for the visit only.
 * Call in an injection context.
 */
export function storedSignal<T>(key: string, empty: T, isValid: (value: unknown) => value is T): WritableSignal<T> {
  const state = signal<T>(empty);
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return state;
  }
  const read = (): T => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
      return isValid(value) ? value : empty;
    } catch {
      return empty;
    }
  };
  afterNextRender(() => state.set(read()));
  const onStorage = (event: StorageEvent) => {
    if (event.key === key) {
      state.set(read());
    }
  };
  window.addEventListener('storage', onStorage);
  inject(DestroyRef).onDestroy(() => window.removeEventListener('storage', onStorage));

  const set = state.set.bind(state);
  const write = (value: T) => {
    set(value);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage blocked or full: kept for this visit only
    }
  };
  return Object.assign(state, {
    set: write,
    update: (change: (value: T) => T) => write(change(state())),
  });
}
