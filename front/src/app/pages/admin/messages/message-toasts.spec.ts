import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../../../core/api/generated/api';
import { UnseenMessage } from '../../../core/api/generated/models/unseen-message';
import { AdminWatch } from '../layout/admin-watch';
import { MAX_TOASTS, MessageToasts, TOAST_MS, firstNameOf, toastText } from './message-toasts';

function message(id: number, groupId: number, text = 'La tarte est prête'): UnseenMessage {
  return { id, groupId, groupName: `Groupe ${groupId}`, authorName: 'Léa Martin', text, photos: 0, sentAt: '2026-11-14T10:00:00Z' };
}

describe('MessageToasts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // No audio in jsdom: the sound of the message stays silent
    vi.stubGlobal('AudioContext', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('says who wrote and the start of the message, or its photos', () => {
    expect(firstNameOf(message(1, 1))).toBe('Léa');
    expect(firstNameOf({ ...message(1, 1), authorName: 'lea@exemple.fr' })).toBe('lea@exemple.fr');
    expect(toastText(message(1, 1))).toBe('La tarte est prête');
    expect(toastText({ ...message(1, 1, ''), photos: 1 })).toBe('Une photo');
    expect(toastText({ ...message(1, 1, ''), photos: 3 })).toBe('3 photos');
  });

  it('shows the newest on top, one per group, three at most, each once', () => {
    const toasts = TestBed.inject(MessageToasts);

    toasts.show(message(1, 1));
    toasts.show(message(2, 2));
    toasts.show(message(3, 1));
    expect(toasts.shown().map((shown) => shown.id)).toEqual([3, 2]);
    toasts.show(message(4, 3));
    toasts.show(message(5, 4));
    expect(toasts.shown().map((shown) => shown.id)).toEqual([5, 4, 3]);
    expect(toasts.shown()).toHaveLength(MAX_TOASTS);
    // Asked again, the same message is not shown twice
    toasts.dismiss(5);
    toasts.show(message(5, 4));
    expect(toasts.shown().map((shown) => shown.id)).toEqual([4, 3]);
  });

  it('goes after a few seconds, unless pointed at', () => {
    const toasts = TestBed.inject(MessageToasts);

    toasts.show(message(1, 1));
    toasts.show(message(2, 2));
    toasts.hold(2);
    vi.advanceTimersByTime(TOAST_MS + 100);
    expect(toasts.shown().map((shown) => shown.id)).toEqual([2]);
    toasts.release(2);
    vi.advanceTimersByTime(TOAST_MS + 100);
    expect(toasts.shown()).toEqual([]);
  });

  it('tells a message of the others as it comes, not at the first count nor for the conversation read', async () => {
    const answers = [
      { count: 1, since: '2026-11-14T09:00:00Z', latest: message(1, 7) },
      { count: 2, since: '2026-11-14T09:00:00Z', latest: message(2, 7) },
      { count: 3, since: '2026-11-14T09:00:00Z', latest: message(3, 8) },
    ];
    TestBed.configureTestingModule({ providers: [{ provide: Api, useValue: { invoke: () => Promise.resolve(answers.shift()) } }] });
    const watch = TestBed.inject(AdminWatch);
    const toasts = TestBed.inject(MessageToasts);
    watch.readingGroup = () => 8;

    await watch.refreshMessages();
    expect(toasts.shown()).toEqual([]);
    await watch.refreshMessages();
    expect(toasts.shown().map((shown) => shown.id)).toEqual([2]);
    // Group 8 is open on the screen: read there
    await watch.refreshMessages();
    expect(toasts.shown().map((shown) => shown.id)).toEqual([2]);
  });
});
