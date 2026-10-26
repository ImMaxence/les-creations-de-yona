import { DOCUMENT } from '@angular/common';
import { Injectable, Injector, effect, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ADMIN_PATH } from '../../shared/routing/links';
import { Consent } from './consent';

/** Google Analytics 4 property of the site. */
export const GA_MEASUREMENT_ID = 'G-914Y0MV42H';
/** Only the production site is measured: local runs and test servers stay out of the figures. */
const MEASURED_HOSTS = ['les-creations-de-yona.fr', 'www.les-creations-de-yona.fr', 'localhost'];
const GA_SCRIPT = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;

type Gtag = (...args: unknown[]) => void;
/** What gtag.js reads on window: its queue, its function, and the opt-out switch of the property. */
type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: Gtag; [optOut: `ga-disable-${string}`]: boolean };

/**
 * Audience measurement with Google Analytics 4, only once the visitor has accepted it (Consent).
 * Before that, Google's script is not even downloaded, so no cookie is set. Page views are sent
 * on each navigation of the site (the property's "page changes based on browser history events"
 * must stay off, or they would count twice); the back-office is never measured.
 */
@Injectable({ providedIn: 'root' })
export class Analytics {
  private readonly consent = inject(Consent);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  // Only used in the browser (start() is called after the first render there)
  private readonly window = inject(DOCUMENT).defaultView as unknown as AnalyticsWindow;
  private loaded = false;
  private stopped = false;

  /** In the browser, once: follows the consent, then the navigations. */
  start(): void {
    if (!MEASURED_HOSTS.includes(this.window.location.hostname)) {
      return;
    }
    effect(
      () => {
        const choice = this.consent.choice();
        if (choice === 'granted') {
          this.resume();
        } else if (choice === 'denied') {
          this.stop();
        }
      },
      { injector: this.injector },
    );
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      // The page title is set during the navigation; sent right after it
      setTimeout(() => this.pageView());
    });
  }

  private resume(): void {
    this.window[`ga-disable-${GA_MEASUREMENT_ID}`] = false;
    this.stopped = false;
    if (!this.loaded) {
      this.load();
    }
    this.pageView();
  }

  private load(): void {
    this.loaded = true;
    const dataLayer = (this.window.dataLayer ??= []);
    this.window.gtag = function gtag() {
      // gtag.js expects the arguments object itself, not an array
      // eslint-disable-next-line prefer-rest-params
      dataLayer.push(arguments);
    };
    this.window.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    this.window.gtag('js', new Date());
    this.window.gtag('config', GA_MEASUREMENT_ID, { send_page_view: false });
    const script = this.window.document.createElement('script');
    script.async = true;
    script.src = GA_SCRIPT;
    this.window.document.head.append(script);
  }

  /** Refused after having accepted: measurement stops at once, and its cookies are deleted. */
  private stop(): void {
    this.stopped = true;
    this.window[`ga-disable-${GA_MEASUREMENT_ID}`] = true;
    this.window.gtag?.('consent', 'update', { analytics_storage: 'denied' });
    const domain = this.window.location.hostname.replace(/^www\./, '');
    for (const cookie of this.window.document.cookie.split('; ')) {
      const name = cookie.split('=')[0]!;
      if (name === '_ga' || name.startsWith('_ga_')) {
        for (const scope of ['', `; domain=${domain}`, `; domain=.${domain}`]) {
          this.window.document.cookie = `${name}=; Max-Age=0; path=/${scope}`;
        }
      }
    }
  }

  private pageView(): void {
    const path = this.window.location.pathname;
    if (!this.loaded || this.stopped || path === ADMIN_PATH || path.startsWith(`${ADMIN_PATH}/`)) {
      return;
    }
    this.window.gtag?.('event', 'page_view', {
      page_location: this.window.location.href,
      page_title: this.window.document.title,
    });
  }
}
