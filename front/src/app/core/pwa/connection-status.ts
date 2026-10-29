import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Toaster } from '../notifications/toaster';

/**
 * Says when the connection is lost, and when it comes back. Lost: a toast that stays, the pages
 * already opened remaining readable; back: it goes, and a short "Connexion retrouvée" follows.
 * The browser only knows the device is off the network, not a Wi-Fi without Internet.
 */
@Injectable({ providedIn: 'root' })
export class ConnectionStatus {
  private readonly document = inject(DOCUMENT);
  private readonly toaster = inject(Toaster);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  /** The toast "Hors connexion" while it is shown. */
  private offlineToast: number | null = null;

  listen(): void {
    const window = this.document.defaultView;
    if (!this.isBrowser || !window) {
      return;
    }
    window.addEventListener('offline', () => this.lost());
    window.addEventListener('online', () => this.back());
    if (!window.navigator.onLine) {
      this.lost();
    }
  }

  private lost(): void {
    if (this.offlineToast !== null) {
      return;
    }
    this.offlineToast = this.toaster.info('Hors connexion : les recettes déjà ouvertes restent lisibles', {
      icon: 'wifi-off',
      persistent: true,
    });
  }

  private back(): void {
    if (this.offlineToast === null) {
      return;
    }
    this.toaster.dismiss(this.offlineToast);
    this.offlineToast = null;
    this.toaster.success('Connexion retrouvée');
  }
}
