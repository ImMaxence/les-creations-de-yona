import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../../../core/api/generated/api';
import { AdminWatch } from '../layout/admin-watch';
import { MessageSound } from './message-sound';

/** The browser's audio, counting the notes played. */
class FakeAudio {
  static made: FakeAudio[] = [];
  state = 'running';
  currentTime = 0;
  destination = {};
  notes: number[] = [];

  constructor() {
    FakeAudio.made.push(this);
  }

  createOscillator() {
    const oscillator = {
      type: '',
      frequency: { value: 0 },
      connect: (node: unknown) => node,
      start: () => this.notes.push(oscillator.frequency.value),
      stop: () => undefined,
    };
    return oscillator;
  }

  createGain() {
    return { gain: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined }, connect: (node: unknown) => node };
  }

  resume(): Promise<void> {
    return Promise.resolve();
  }
}

const notes = () => FakeAudio.made.flatMap((audio) => audio.notes);

describe('MessageSound', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeAudio.made = [];
    vi.stubGlobal('AudioContext', FakeAudio);
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('plays two short notes for a message', () => {
    TestBed.inject(MessageSound).play();

    expect(notes()).toEqual([880, 1318.5]);
  });

  it('plays once for the signs of the same message close together', () => {
    const sound = TestBed.inject(MessageSound);

    sound.play();
    sound.play();
    vi.advanceTimersByTime(2_500);
    sound.play();

    expect(notes()).toHaveLength(4);
  });

  it('stays quiet once turned off, remembered in this browser, and plays when turned on again', () => {
    const sound = TestBed.inject(MessageSound);

    sound.toggle();
    sound.play();
    expect(notes()).toEqual([]);
    expect(localStorage.getItem('yona-message-sound')).toBe('off');

    sound.toggle();
    expect(notes()).toEqual([880, 1318.5]);
    expect(localStorage.getItem('yona-message-sound')).toBeNull();
  });

  it('rings on any page when the badge of "Messages" grows, not at its first count', async () => {
    const counts = [1, 1, 2, 0];
    TestBed.configureTestingModule({
      providers: [{ provide: Api, useValue: { invoke: () => Promise.resolve({ count: counts.shift(), since: '2026-11-12T10:00:00Z' }) } }],
    });
    const watch = TestBed.inject(AdminWatch);

    await watch.refreshMessages();
    await watch.refreshMessages();
    expect(notes()).toEqual([]);
    await watch.refreshMessages();
    expect(notes()).toEqual([880, 1318.5]);
    vi.advanceTimersByTime(2_500);
    await watch.refreshMessages();
    expect(notes()).toHaveLength(2);
  });
});
