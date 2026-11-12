import { DOCUMENT, Injectable, inject, signal } from '@angular/core';

/** Remembered in this browser: "off" when the admin turned the sound off. */
const STORAGE_KEY = 'yona-message-sound';

/** Several signs of the same message (the badge, the conversation) give one sound. */
const QUIET_MS = 2_000;

/** Two short notes, a fifth apart, as a messaging app: their pitch (Hz) and when each starts (s). */
const NOTES: readonly (readonly [frequency: number, start: number])[] = [
  [880, 0],
  [1318.5, 0.11],
];

/**
 * The little sound of a message another admin wrote, on any page of the back-office (AdminWatch, when
 * the badge of "Messages" grows) and in the conversation open. Made by the browser (Web Audio), no
 * file to load. Browsers let a page play a sound only once it has been touched: it is made ready at
 * the first click or key. Turned off or on from "Messages", remembered in this browser.
 */
@Injectable({ providedIn: 'root' })
export class MessageSound {
  private readonly document = inject(DOCUMENT);
  readonly enabled = signal(readEnabled());
  private context: AudioContext | null = null;
  private lastPlayed = 0;

  constructor() {
    const ready = (): void => void this.ready();
    this.document.addEventListener('pointerdown', ready, { once: true, capture: true });
    this.document.addEventListener('keydown', ready, { once: true, capture: true });
  }

  /** On or off; turned on, it plays once, so that the admin hears it. */
  toggle(): void {
    const enabled = !this.enabled();
    this.enabled.set(enabled);
    try {
      if (enabled) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, 'off');
      }
    } catch {
      // Storage blocked: the choice holds until the page is closed
    }
    if (enabled) {
      this.lastPlayed = 0;
      this.play();
    }
  }

  /** A message of another admin came. */
  play(): void {
    const now = Date.now();
    if (!this.enabled() || now - this.lastPlayed < QUIET_MS) {
      return;
    }
    const context = this.ready();
    if (!context) {
      return;
    }
    this.lastPlayed = now;
    const at = context.currentTime;
    for (const [frequency, start] of NOTES) {
      const oscillator = context.createOscillator();
      const volume = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      // A soft attack, then a fade: a "ding", not a beep
      volume.gain.setValueAtTime(0.0001, at + start);
      volume.gain.exponentialRampToValueAtTime(0.16, at + start + 0.015);
      volume.gain.exponentialRampToValueAtTime(0.0001, at + start + 0.4);
      oscillator.connect(volume).connect(context.destination);
      oscillator.start(at + start);
      oscillator.stop(at + start + 0.45);
    }
  }

  /** The audio of the page, woken up if the browser put it to sleep; null without Web Audio. */
  private ready(): AudioContext | null {
    if (typeof AudioContext === 'undefined') {
      return null;
    }
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') {
        this.context.resume().catch(() => undefined);
      }
      return this.context;
    } catch {
      return null;
    }
  }
}

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}
