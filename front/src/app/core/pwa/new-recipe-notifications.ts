import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, PLATFORM_ID, afterNextRender, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { Api } from '../api/generated/api';
import { getPushPublicKey } from '../api/generated/fn/notifications/get-push-public-key';
import { subscribeToNotifications } from '../api/generated/fn/notifications/subscribe-to-notifications';
import { unsubscribeFromNotifications } from '../api/generated/fn/notifications/unsubscribe-from-notifications';
import { PushSubscriptionForm } from '../api/generated/models/push-subscription-form';
import { Toaster } from '../notifications/toaster';

/** Where the browser stands: decided after the first render, the server knowing nothing of it. */
export type NotificationsState =
  /** Not known yet (server rendering, first render). */
  | 'unknown'
  /** No Web Push here (old browser, service worker off in development). */
  | 'unsupported'
  /** iPhone or iPad: only the app added to the home screen receives notifications. */
  | 'install-first'
  /** Refused in the browser settings: only the visitor can change it there. */
  | 'blocked'
  | 'off'
  | 'on';

/**
 * "Me prévenir des nouvelles recettes" (Web Push): the browser subscribes to its push service with
 * the site's public key, and the backend keeps the subscription, nothing about the visitor. The
 * notification is shown by Angular's service worker, even with the site closed; a tap opens the
 * recipe.
 */
@Injectable({ providedIn: 'root' })
export class NewRecipeNotifications {
  private readonly swPush = inject(SwPush);
  private readonly api = inject(Api);
  private readonly toaster = inject(Toaster);

  readonly state = signal<NotificationsState>('unknown');
  readonly busy = signal(false);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) {
      return;
    }
    afterNextRender(() => {
      if (!this.swPush.isEnabled || !('PushManager' in window) || !('Notification' in window)) {
        this.state.set(isAppleMobile() && !isStandalone() ? 'install-first' : 'unsupported');
        return;
      }
      this.swPush.subscription.subscribe((subscription) => {
        if (subscription) {
          this.state.set('on');
        } else {
          this.state.set(Notification.permission === 'denied' ? 'blocked' : 'off');
        }
      });
    });
  }

  async subscribe(): Promise<void> {
    this.busy.set(true);
    try {
      const { publicKey } = await this.api.invoke(getPushPublicKey);
      const subscription = await this.swPush.requestSubscription({ serverPublicKey: publicKey });
      await this.api.invoke(subscribeToNotifications, { body: subscriptionForm(subscription) });
      this.toaster.success("C'est noté : vous serez prévenu·e de chaque nouvelle recette.");
    } catch (error) {
      if (Notification.permission === 'denied') {
        this.state.set('blocked');
        this.toaster.error('Les notifications sont bloquées pour ce site : autorisez-les dans les réglages du navigateur.');
      } else {
        // The API's own message when it refused (subscriptions full…)
        const detail = error instanceof HttpErrorResponse ? (error.error as { detail?: string } | null)?.detail : null;
        this.toaster.error(detail ?? "Impossible d'activer les notifications sur cet appareil pour le moment.");
      }
      await this.swPush.unsubscribe().catch(() => undefined);
    } finally {
      this.busy.set(false);
    }
  }

  async unsubscribe(): Promise<void> {
    this.busy.set(true);
    try {
      const subscription = await firstValueFrom(this.swPush.subscription);
      if (subscription) {
        // Forgotten by the server even if the browser fails to unsubscribe, and the other way round
        await this.api.invoke(unsubscribeFromNotifications, { endpoint: subscription.endpoint }).catch(() => undefined);
        await this.swPush.unsubscribe();
      }
      this.toaster.success('Vous ne recevrez plus de notification.');
    } catch {
      this.toaster.error('Impossible de désactiver les notifications pour le moment.');
    } finally {
      this.busy.set(false);
    }
  }
}

/** What the backend keeps: the push service address and the browser's keys. */
function subscriptionForm(subscription: PushSubscription): PushSubscriptionForm {
  const { endpoint, keys } = subscription.toJSON();
  return { endpoint: endpoint ?? subscription.endpoint, keys: { p256dh: keys?.['p256dh'] ?? '', auth: keys?.['auth'] ?? '' } };
}

function isAppleMobile(): boolean {
  // iPadOS presents itself as a Mac with a touch screen
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}
