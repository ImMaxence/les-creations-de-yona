import { TestBed } from '@angular/core/testing';
import { ColorScheme } from './color-scheme';
import {
  DEFAULT_PREFERENCES,
  DisplayPreferencesStore,
  PREFERENCES_KEY,
  attributesOf,
  isDefault,
  prefersReducedMotion,
  readPreferences,
} from './display-preferences';

const ATTRIBUTES = ['data-text-size', 'data-contrast', 'data-motion', 'data-font', 'data-links', 'data-spacing'];

function clean(): void {
  localStorage.clear();
  ATTRIBUTES.forEach((name) => document.documentElement.removeAttribute(name));
}

describe('readPreferences', () => {
  it('starts from the defaults', () => {
    expect(readPreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(readPreferences('pas du JSON')).toEqual(DEFAULT_PREFERENCES);
    expect(readPreferences('[1, 2]')).toEqual(DEFAULT_PREFERENCES);
  });

  it('reads back what was kept', () => {
    expect(readPreferences(JSON.stringify({ textSize: 'larger', contrast: true, underlineLinks: true }))).toEqual({
      ...DEFAULT_PREFERENCES,
      textSize: 'larger',
      contrast: true,
      underlineLinks: true,
    });
  });

  it('leaves a choice that does not read at its default, the others kept', () => {
    expect(readPreferences(JSON.stringify({ textSize: 'huge', contrast: 'yes', reduceMotion: true }))).toEqual({
      ...DEFAULT_PREFERENCES,
      reduceMotion: true,
    });
  });
});

describe('attributesOf', () => {
  it('writes nothing for the defaults', () => {
    expect(Object.values(attributesOf(DEFAULT_PREFERENCES)).every((value) => value === null)).toBe(true);
  });

  it('writes an attribute for each choice made', () => {
    expect(
      attributesOf({ textSize: 'large', contrast: true, reduceMotion: true, readableFont: true, underlineLinks: true, textSpacing: true }),
    ).toEqual({
      'data-text-size': 'large',
      'data-contrast': 'more',
      'data-motion': 'reduce',
      'data-font': 'readable',
      'data-links': 'underline',
      'data-spacing': 'wide',
    });
  });
});

describe('isDefault', () => {
  it('tells when nothing was changed', () => {
    expect(isDefault({ ...DEFAULT_PREFERENCES })).toBe(true);
    expect(isDefault({ ...DEFAULT_PREFERENCES, textSpacing: true })).toBe(false);
  });
});

describe('DisplayPreferencesStore', () => {
  beforeEach(clean);
  afterEach(clean);

  it('applies a choice on the page at once, and keeps it in the browser', () => {
    const store = TestBed.inject(DisplayPreferencesStore);

    store.update({ textSize: 'larger', reduceMotion: true });

    expect(document.documentElement.getAttribute('data-text-size')).toBe('larger');
    expect(document.documentElement.getAttribute('data-motion')).toBe('reduce');
    expect(readPreferences(localStorage.getItem(PREFERENCES_KEY))).toEqual(store.preferences());
  });

  it('starts from what the browser kept', () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ contrast: true }));

    expect(TestBed.inject(DisplayPreferencesStore).preferences().contrast).toBe(true);
  });

  it('forgets everything once back to the defaults', () => {
    const store = TestBed.inject(DisplayPreferencesStore);
    store.update({ contrast: true, underlineLinks: true });

    store.reset();

    expect(localStorage.getItem(PREFERENCES_KEY)).toBeNull();
    expect(ATTRIBUTES.some((name) => document.documentElement.hasAttribute(name))).toBe(false);
  });

  it('goes back to the site as it comes, light or dark included', () => {
    const store = TestBed.inject(DisplayPreferencesStore);
    const colorScheme = TestBed.inject(ColorScheme);
    store.update({ textSize: 'large' });
    colorScheme.set('dark');
    expect(store.onSiteDefaults()).toBe(false);

    store.resetAll();

    expect(store.onSiteDefaults()).toBe(true);
    expect(colorScheme.preference()).toBe('auto');
    expect(document.documentElement.hasAttribute('data-color-scheme')).toBe(false);
    expect(localStorage.getItem('yona-color-scheme')).toBeNull();
  });

  it('still applies the choice when the browser refuses to store it', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota', 'QuotaExceededError');
    });

    TestBed.inject(DisplayPreferencesStore).update({ underlineLinks: true });

    expect(document.documentElement.getAttribute('data-links')).toBe('underline');
    setItem.mockRestore();
  });
});

describe('prefersReducedMotion', () => {
  afterEach(clean);

  it('follows the choice of the page Accessibilité', () => {
    document.documentElement.setAttribute('data-motion', 'reduce');

    expect(prefersReducedMotion(document)).toBe(true);
  });
});
