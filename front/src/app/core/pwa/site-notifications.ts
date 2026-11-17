import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, PLATFORM_ID, afterNextRender, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { safeParse } from '../api/admin-errors.interceptor';
import { Api } from '../api/generated/api';
import { chooseNotificationTopics } from '../api/generated/fn/notifications/choose-notification-topics';
import { getNotificationTopics } from '../api/generated/fn/notifications/get-notification-topics';
import { getPushPublicKey } from '../api/generated/fn/notifications/get-push-public-key';
import { sendTestNotification } from '../api/generated/fn/notifications/send-test-notification';
import { unsubscribeFromNotifications } from '../api/generated/fn/notifications/unsubscribe-from-notifications';
import { NotificationTopics } from '../api/generated/models/notification-topics';
import { PushSubscriptionForm } from '../api/generated/models/push-subscription-form';
import { Toaster } from '../notifications/toaster';
import { ServiceWorkerGate } from './service-worker-gate';

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
  /** No subscription in this browser. */
  | 'off'
  /** A subscription in this browser: what it is told of is in {@link SiteNotifications.topics}. */
  | 'on';

/** What a visitor may be told of (2.24): the new recipes, the new articles of "Mon CAP". */
export type NotificationTopic = keyof NotificationTopics;

const NOTHING: NotificationTopics = { recipes: false, articles: false };

/** The toast once a topic is turned on. */
const TURNED_ON: Record<NotificationTopic, string> = {
  recipes: "C'est noté : vous serez prévenu·e de chaque nouvelle recette",
  articles: "C'est noté : vous serez prévenu·e de chaque nouvel article de Mon CAP",
};

/**
 * The notifications of the site (Web Push), without any account: the browser subscribes to its push service with
 * the site's public key, and the backend keeps the subscription, nothing about the visitor. "Me prévenir des
 * nouvelles recettes", "Me prévenir des nouveaux articles" (2.24), and "Mes notifications" to choose both, ask for
 * a test or stop everything. Shown by the service worker, even with the site closed; a tap opens the recipe or the
 * article.
 */
@Injectable({ providedIn: 'root' })
export class SiteNotifications {
  private readonly swPush = inject(SwPush);
  private readonly api = inject(Api);
  private readonly toaster = inject(Toaster);
  private readonly serviceWorker = inject(ServiceWorkerGate);

  readonly state = signal<NotificationsState>('unknown');
  /** What this device is told of; null while not known (being read, or the API out of reach). */
  readonly topics = signal<NotificationTopics | null>(null);
  readonly busy = signal(false);
  readonly testing = signal(false);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) {
      return;
    }
    afterNextRender(() => {
      if (!this.swPush.isEnabled || !('PushManager' in window) || !('Notification' in window)) {
        this.state.set(isAppleMobile() && !isStandalone() ? 'install-first' : 'unsupported');
        return;
      }
      void this.readState();
    });
  }

  /** Whether this device is told of {@code topic}. */
  isOn(topic: NotificationTopic): boolean {
    return this.state() === 'on' && !!this.topics()?.[topic];
  }

  private async readState(): Promise<void> {
    // A browser tab without the app nor notifications has no service worker (ServiceWorkerGate): nothing to read
    if (!(await this.serviceWorker.kept())) {
      this.state.set(Notification.permission === 'denied' ? 'blocked' : 'off');
      return;
    }
    this.swPush.subscription.subscribe((subscription) => {
      if (subscription) {
        this.state.set('on');
        void this.readTopics(subscription.endpoint);
      } else {
        this.state.set(Notification.permission === 'denied' ? 'blocked' : 'off');
        this.topics.set(NOTHING);
      }
    });
  }

  /** Asked to the backend: a device subscribed by an admin only is told of none of these. */
  async readTopics(endpoint?: string): Promise<void> {
    const address = endpoint ?? (await currentSubscription())?.endpoint;
    if (!address) {
      return;
    }
    try {
      this.topics.set(await this.api.invoke(getNotificationTopics, { endpoint: address }));
    } catch {
      // Not known: the buttons say the notifications are on, "Mes notifications" asks again
    }
  }

  /**
   * "Me prévenir…": the browser asks for the permission on this tap if it has not been given yet; the other topic
   * stays as it was.
   */
  async enable(topic: NotificationTopic): Promise<void> {
    this.busy.set(true);
    let created = false;
    try {
      let subscription = this.state() === 'on' ? await currentSubscription() : null;
      if (!subscription) {
        // Asked on the tap itself: installing the service worker can take a few seconds, and the
        // browser only shows its question right after a tap
        await askPermission();
        await this.serviceWorker.register();
        const { publicKey } = await this.api.invoke(getPushPublicKey);
        subscription = await this.swPush.requestSubscription({ serverPublicKey: publicKey });
        created = true;
      }
      const topics = { ...(this.topics() ?? NOTHING), [topic]: true };
      await this.api.invoke(chooseNotificationTopics, { body: { subscription: subscriptionForm(subscription), ...topics } });
      this.topics.set(topics);
      this.state.set('on');
      this.toaster.success(TURNED_ON[topic]);
    } catch (error) {
      if (Notification.permission === 'denied') {
        this.state.set('blocked');
        this.toaster.error('Les notifications sont bloquées pour ce site : autorisez-les dans les réglages du navigateur');
      } else {
        // The API's own message when it refused (subscriptions full…)
        this.toaster.error(apiMessage(error) ?? "Impossible d'activer les notifications sur cet appareil pour le moment");
      }
      // Made for this tap, then refused by the backend: not left in the browser. Without a worker serving the
      // page (permission refused before it was registered), there is no subscription, and SwPush would wait forever
      if (created && navigator.serviceWorker?.controller) {
        await this.swPush.unsubscribe().catch(() => undefined);
      }
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * "Mes notifications": what this device is told of, in place of what it was; nothing at all stops everything.
   * Said in the dialog, where a toast would be hidden behind it.
   *
   * @return why it was not saved; null once saved
   */
  async choose(topics: NotificationTopics): Promise<string | null> {
    if (!topics.recipes && !topics.articles) {
      return this.disableAll();
    }
    this.busy.set(true);
    try {
      const subscription = await currentSubscription();
      if (!subscription) {
        throw new Error('No subscription');
      }
      await this.api.invoke(chooseNotificationTopics, { body: { subscription: subscriptionForm(subscription), ...topics } });
      this.topics.set(topics);
      return null;
    } catch (error) {
      return apiMessage(error) ?? "Impossible d'enregistrer ce choix pour le moment";
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * "Tout désactiver": forgotten by the server, then by the browser, unless an admin gets their alerts on this
   * device (new orders, messages): its subscription stays for those. A toast once done (the dialog closes).
   *
   * @return why it could not be done; null once done
   */
  async disableAll(): Promise<string | null> {
    this.busy.set(true);
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        // Forgotten by the server even if the browser fails to unsubscribe, and the other way round
        const answer = await this.api.invoke(unsubscribeFromNotifications, { endpoint: subscription.endpoint }).catch(() => null);
        if (!answer?.kept) {
          await this.swPush.unsubscribe();
          this.state.set('off');
        }
      } else {
        this.state.set('off');
      }
      this.topics.set(NOTHING);
      this.toaster.success('Vous ne recevrez plus les nouvelles recettes ni les nouveaux articles');
      return null;
    } catch {
      return 'Impossible de désactiver les notifications pour le moment';
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * "Envoyer une notification de test": to this device only, through its push service as any other. Its push
   * service no longer knowing it, the device is told it is no longer subscribed.
   *
   * @return what to say, and whether it went
   */
  async sendTest(): Promise<{ sent: boolean; message: string }> {
    this.testing.set(true);
    try {
      const subscription = await currentSubscription();
      if (!subscription) {
        return { sent: false, message: "Cet appareil ne reçoit pas les notifications du site : activez-les d'abord" };
      }
      await this.api.invoke(sendTestNotification, { body: { endpoint: subscription.endpoint } });
      return { sent: true, message: 'Notification de test envoyée : elle arrive dans quelques secondes' };
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 410) {
        await this.swPush.unsubscribe().catch(() => undefined);
        this.state.set('off');
        this.topics.set(NOTHING);
      }
      return { sent: false, message: apiMessage(error) ?? "Impossible d'envoyer une notification de test pour le moment" };
    } finally {
      this.testing.set(false);
    }
  }

  /** The same, said in a toast (a page without a dialog: the alert of the orders). */
  async test(): Promise<void> {
    const { sent, message } = await this.sendTest();
    if (sent) {
      this.toaster.success(message);
    } else {
      this.toaster.error(message);
    }
  }
}

/**
 * The subscription of this browser, read from its service worker: none without one (a browser tab), where SwPush
 * would wait forever.
 */
export async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
  return (await registration?.pushManager?.getSubscription().catch(() => null)) ?? null;
}

/**
 * The API's own message ("Une notification de test vient de partir…"), if it gave one; read from the text of an
 * endpoint answering nothing (the ProblemDetail then comes as a string).
 */
function apiMessage(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body = typeof error.error === 'string' ? safeParse(error.error) : error.error;
  return (body as { detail?: string } | null)?.detail ?? null;
}

/** What the backend keeps: the push service address and the browser's keys. */
export function subscriptionForm(subscription: PushSubscription): PushSubscriptionForm {
  const { endpoint, keys } = subscription.toJSON();
  return { endpoint: endpoint ?? subscription.endpoint, keys: { p256dh: keys?.['p256dh'] ?? '', auth: keys?.['auth'] ?? '' } };
}

/** The browser's question about notifications: refused or dismissed, nothing more is tried. */
export async function askPermission(): Promise<void> {
  // Old Safari answers through a callback only: the promise then gives nothing
  const permission = (await Notification.requestPermission()) || Notification.permission;
  if (permission !== 'granted') {
    throw new Error(`Notifications: ${permission}`);
  }
}

export function isAppleMobile(): boolean {
  // iPadOS presents itself as a Mac with a touch screen
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}
