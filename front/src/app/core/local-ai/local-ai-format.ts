/** One line of the list of what the AI is doing. */
export interface AiStage {
  label: string;
  detail?: string;
  state: 'done' | 'running' | 'waiting';
}

/** The models need a computer's graphics memory: a phone or a tablet has too little of it. */
export function isPhoneOrTablet(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  // An iPad says it is a Mac: only its touch screen gives it away
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function formatDuration(seconds: number): string {
  const rounded = Math.round(seconds);
  if (rounded < 60) {
    return `${rounded} s`;
  }
  const rest = rounded % 60;
  return `${Math.floor(rounded / 60)} min${rest ? ` ${String(rest).padStart(2, '0')}` : ''}`;
}

/** Over the last seconds only: a connection that slows down shows at once. */
const RATE_WINDOW_MS = 5000;

/** Bytes per second of a download, from its progress. */
export class TransferRate {
  private readonly samples: { at: number; bytes: number }[] = [];

  add(at: number, bytes: number): void {
    this.samples.push({ at, bytes });
    while (this.samples[0].at < at - RATE_WINDOW_MS) {
      this.samples.shift();
    }
  }

  /** Null until enough has been seen to tell. */
  perSecond(): number | null {
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    return last && last.at - first.at >= 500 ? ((last.bytes - first.bytes) * 1000) / (last.at - first.at) : null;
  }
}
