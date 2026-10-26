/** Three rising notes (C6, E6, G6), repeated: heard over a running hood. */
const NOTES_HZ = [1046.5, 1318.5, 1568];
const NOTE_GAP_S = 0.16;
const REPEAT_EVERY_S = 1.5;
/** Half a minute of ringing, unless stopped earlier. */
const REPEATS = 20;
const VOLUME = 0.7;

/**
 * The ring of the cooking mode timers, with the Web Audio API. Each ring is scheduled on the audio
 * clock as soon as its timer starts: it plays on time even when the browser slows down the page's
 * own timers (screen dimmed, another tab). It rings until stopped, half a minute at most.
 */
export class KitchenAlarm {
  private context: AudioContext | null = null;
  private readonly scheduled = new Map<number, { at: number; notes: OscillatorNode[] }>();

  /**
   * To call on a tap: browsers, Safari on iPhone above all, only let a page start its sound then.
   * On iPhone, the ring is also heard with the silent switch on, like a kitchen timer.
   */
  unlock(): void {
    if (typeof AudioContext === 'undefined') {
      return;
    }
    const session = (navigator as { audioSession?: { type: string } }).audioSession;
    if (session) {
      try {
        session.type = 'playback';
      } catch {
        // Older Safari: the silent switch still applies
      }
    }
    this.context ??= new AudioContext();
    if (this.context.state !== 'running') {
      void this.context.resume();
    }
    // A silent instant, which some browsers need before they really start the output
    const silence = this.context.createBufferSource();
    silence.buffer = this.context.createBuffer(1, 1, this.context.sampleRate);
    silence.connect(this.context.destination);
    silence.start();
  }

  /** Rings {@code delayMs} from now; replaces what was scheduled for the same timer. */
  schedule(id: number, delayMs: number): void {
    this.cancel(id);
    const context = this.context;
    if (!context) {
      return;
    }
    const at = context.currentTime + Math.max(0, delayMs) / 1000;
    this.scheduled.set(id, { at, notes: this.chimes(context, at) });
  }

  /**
   * The timer has ended: rings now, unless its scheduled ring has started already. When the audio
   * was suspended meanwhile (phone locked), its schedule fell behind: it rings now instead.
   */
  ringNow(id: number): void {
    const context = this.context;
    const planned = this.scheduled.get(id);
    if (!context || (planned && planned.at <= context.currentTime + 0.5)) {
      return;
    }
    this.schedule(id, 0);
  }

  cancel(id: number): void {
    const planned = this.scheduled.get(id);
    if (!planned) {
      return;
    }
    for (const note of planned.notes) {
      try {
        note.stop();
      } catch {
        // Already stopped
      }
      note.disconnect();
    }
    this.scheduled.delete(id);
  }

  close(): void {
    for (const id of [...this.scheduled.keys()]) {
      this.cancel(id);
    }
    void this.context?.close();
    this.context = null;
  }

  private chimes(context: AudioContext, start: number): OscillatorNode[] {
    const notes: OscillatorNode[] = [];
    for (let repeat = 0; repeat < REPEATS; repeat++) {
      NOTES_HZ.forEach((frequency, index) => {
        const at = start + repeat * REPEAT_EVERY_S + index * NOTE_GAP_S;
        const note = context.createOscillator();
        const gain = context.createGain();
        note.type = 'triangle';
        note.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(VOLUME, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
        note.connect(gain).connect(context.destination);
        note.start(at);
        note.stop(at + 0.5);
        notes.push(note);
      });
    }
    return notes;
  }
}
