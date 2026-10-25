import { Injectable, signal } from '@angular/core';

export type ConsentChoice = 'granted' | 'denied';

const STORAGE_KEY = 'yona-analytics-consent';
/** As the CNIL recommends, the choice (yes or no) is asked again after about 6 months. */
const VALIDITY_MS = 182 * 24 * 60 * 60 * 1000;

interface StoredChoice {
  choice: ConsentChoice;
  /** Epoch milliseconds. */
  at: number;
}

/**
 * The visitor's choice about the audience measurement (Google Analytics), kept in the browser.
 * Until there is one, nothing is measured and the banner asks. Browser only: read by init().
 */
@Injectable({ providedIn: 'root' })
export class Consent {
  private readonly choiceState = signal<ConsentChoice | null>(null);
  private readonly bannerState = signal(false);

  readonly choice = this.choiceState.asReadonly();
  readonly bannerOpen = this.bannerState.asReadonly();

  /** In the browser, after the first render: the server knows nothing of the stored choice. */
  init(): void {
    const stored = read();
    if (stored && Date.now() - stored.at < VALIDITY_MS) {
      this.choiceState.set(stored.choice);
    } else {
      this.bannerState.set(true);
    }
  }

  accept(): void {
    this.decide('granted');
  }

  refuse(): void {
    this.decide('denied');
  }

  /** "Gestion des cookies": the banner again, to change one's mind. */
  reopen(): void {
    this.bannerState.set(true);
  }

  private decide(choice: ConsentChoice): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice, at: Date.now() } satisfies StoredChoice));
    } catch {
      // Storage blocked (private browsing): the choice holds for this visit only
    }
    this.choiceState.set(choice);
    this.bannerState.set(false);
  }
}

function read(): StoredChoice | null {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as StoredChoice | null;
    return stored && (stored.choice === 'granted' || stored.choice === 'denied') && typeof stored.at === 'number'
      ? stored
      : null;
  } catch {
    return null;
  }
}
