import { TestBed } from '@angular/core/testing';
import { DraftKeeper, KEEP_DELAY_MS, KeptDraft, forgetKeptDraft, readKeptDraft, writeKeptDraft } from './kept-draft';

const KEY = 'yona-test-draft';
const isText = (value: unknown): value is string => typeof value === 'string';

function kept(draft: string): KeptDraft<string> {
  return { savedAt: '2026-11-10T09:00:00.000Z', basedOn: '2026-11-09T18:00:00Z', draft };
}

describe('kept drafts', () => {
  afterEach(() => localStorage.clear());

  it('reads back what was written', () => {
    writeKeptDraft(KEY, kept('Bonjour'));

    expect(readKeptDraft(KEY, isText)).toEqual(kept('Bonjour'));
  });

  it('has nothing to offer once forgotten', () => {
    writeKeptDraft(KEY, kept('Bonjour'));
    forgetKeptDraft(KEY);

    expect(readKeptDraft(KEY, isText)).toBeNull();
  });

  it('drops what is not a draft of the kind expected', () => {
    localStorage.setItem(KEY, 'pas du JSON');
    expect(readKeptDraft(KEY, isText)).toBeNull();

    localStorage.setItem(KEY, JSON.stringify({ savedAt: '2026-11-10T09:00:00Z', draft: 42 }));
    expect(readKeptDraft(KEY, isText)).toBeNull();

    localStorage.setItem(KEY, JSON.stringify({ draft: 'Bonjour' }));
    expect(readKeptDraft(KEY, isText)).toBeNull();
  });

  it('takes a draft without its base as one typed on something new', () => {
    localStorage.setItem(KEY, JSON.stringify({ savedAt: '2026-11-10T09:00:00Z', draft: 'Bonjour' }));

    expect(readKeptDraft(KEY, isText)?.basedOn).toBeNull();
  });

  it('keeps working when the browser refuses to store', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota', 'QuotaExceededError');
    });

    expect(() => writeKeptDraft(KEY, kept('Bonjour'))).not.toThrow();
    setItem.mockRestore();
  });
});

describe('DraftKeeper', () => {
  let form: string;
  let saved: string;
  let active: boolean;
  let keeper: DraftKeeper<string>;

  beforeEach(() => {
    vi.useFakeTimers();
    form = 'Bonjour';
    saved = 'Bonjour';
    active = true;
    keeper = TestBed.runInInjectionContext(
      () =>
        new DraftKeeper<string>(
          () => KEY,
          () => (form !== saved ? { savedAt: new Date().toISOString(), basedOn: null, draft: form } : null),
          () => active,
        ),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('writes the form a moment after the typing stops', () => {
    form = 'Bonjour à tous';
    keeper.changed();
    expect(readKeptDraft(KEY, isText)).toBeNull();

    vi.advanceTimersByTime(KEEP_DELAY_MS);
    expect(readKeptDraft(KEY, isText)?.draft).toBe('Bonjour à tous');
  });

  it('waits for the last change', () => {
    form = 'B';
    keeper.changed();
    vi.advanceTimersByTime(KEEP_DELAY_MS - 100);
    form = 'Bo';
    keeper.changed();
    vi.advanceTimersByTime(KEEP_DELAY_MS - 100);
    expect(readKeptDraft(KEY, isText)).toBeNull();

    vi.advanceTimersByTime(100);
    expect(readKeptDraft(KEY, isText)?.draft).toBe('Bo');
  });

  it('writes at once when the tab is hidden', () => {
    form = 'Bonjour à tous';
    keeper.changed();
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    visibility.mockRestore();

    expect(readKeptDraft(KEY, isText)?.draft).toBe('Bonjour à tous');
  });

  it('forgets the draft once the form is back to what is saved', () => {
    writeKeptDraft(KEY, kept('Ancien'));
    keeper.changed();
    vi.advanceTimersByTime(KEEP_DELAY_MS);

    expect(readKeptDraft(KEY, isText)).toBeNull();
  });

  it('writes nothing while inactive (loading, or an older draft offered)', () => {
    writeKeptDraft(KEY, kept('Ancien'));
    active = false;
    form = 'Nouveau';
    keeper.changed();
    vi.advanceTimersByTime(KEEP_DELAY_MS);

    expect(readKeptDraft(KEY, isText)?.draft).toBe('Ancien');
  });

  it('forgets a draft for good, a pending write included', () => {
    form = 'Nouveau';
    keeper.changed();
    keeper.forget();
    vi.advanceTimersByTime(KEEP_DELAY_MS);

    expect(readKeptDraft(KEY, isText)).toBeNull();
  });

  it('stops listening once its page is gone', () => {
    form = 'Nouveau';
    keeper.changed();
    TestBed.resetTestingModule();
    vi.advanceTimersByTime(KEEP_DELAY_MS);

    expect(readKeptDraft(KEY, isText)).toBeNull();
  });
});
