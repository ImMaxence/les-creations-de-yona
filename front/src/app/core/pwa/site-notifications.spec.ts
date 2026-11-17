import { HttpErrorResponse } from '@angular/common/http';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwPush } from '@angular/service-worker';
import { Api } from '../api/generated/api';
import { chooseNotificationTopics } from '../api/generated/fn/notifications/choose-notification-topics';
import { sendTestNotification } from '../api/generated/fn/notifications/send-test-notification';
import { unsubscribeFromNotifications } from '../api/generated/fn/notifications/unsubscribe-from-notifications';
import { Toaster } from '../notifications/toaster';
import { ServiceWorkerGate } from './service-worker-gate';
import { SiteNotifications } from './site-notifications';

describe('SiteNotifications', () => {
  let invoke: ReturnType<typeof vi.fn>;
  let unsubscribe: ReturnType<typeof vi.fn>;
  let requestPermission: ReturnType<typeof vi.fn>;
  let toaster: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  /** A browser subscribed already (to the recipes, an admin's alerts…): its service worker gives the subscription. */
  function subscribed(answer: (fn: unknown, params: unknown) => unknown = () => undefined): SiteNotifications {
    const subscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'key', auth: 'secret' } }),
    };
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: async () => ({ pushManager: { getSubscription: async () => subscription } }) },
    });
    requestPermission = vi.fn(async () => 'granted');
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission });
    invoke = vi.fn(async (fn: unknown, params: unknown) => answer(fn, params));
    unsubscribe = vi.fn(async () => true);
    toaster = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        // On the server: the state is set by each test, nothing read after the first render
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: Api, useValue: { invoke } },
        { provide: SwPush, useValue: { isEnabled: true, unsubscribe } },
        { provide: Toaster, useValue: toaster },
        { provide: ServiceWorkerGate, useValue: { kept: async () => true, register: async () => undefined } },
      ],
    });
    const notifications = TestBed.inject(SiteNotifications);
    notifications.state.set('on');
    return notifications;
  }

  afterEach(() => {
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    vi.unstubAllGlobals();
  });

  it('adds the articles to a device told of the recipes, without asking the browser again', async () => {
    const notifications = subscribed();
    notifications.topics.set({ recipes: true, articles: false });

    await notifications.enable('articles');

    expect(requestPermission).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith(chooseNotificationTopics, {
      body: {
        subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'key', auth: 'secret' } },
        recipes: true,
        articles: true,
      },
    });
    expect(notifications.isOn('recipes')).toBe(true);
    expect(notifications.isOn('articles')).toBe(true);
  });

  it('keeps the subscription of a device an admin gets alerts on', async () => {
    const notifications = subscribed((fn) => (fn === unsubscribeFromNotifications ? { kept: true } : undefined));
    notifications.topics.set({ recipes: true, articles: true });

    await notifications.disableAll();

    expect(unsubscribe).not.toHaveBeenCalled();
    expect(notifications.state()).toBe('on');
    expect(notifications.isOn('recipes')).toBe(false);
    expect(notifications.isOn('articles')).toBe(false);
  });

  it('unsubscribes the browser once nothing is told to it', async () => {
    const notifications = subscribed((fn) => (fn === unsubscribeFromNotifications ? { kept: false } : undefined));

    await notifications.choose({ recipes: false, articles: false });

    expect(unsubscribe).toHaveBeenCalled();
    expect(notifications.state()).toBe('off');
  });

  it('sends a test notification to this device', async () => {
    const notifications = subscribed();

    await notifications.test();

    expect(invoke).toHaveBeenCalledWith(sendTestNotification, { body: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc' } });
    expect(toaster.success).toHaveBeenCalledWith('Notification de test envoyée : elle arrive dans quelques secondes');
  });

  it('turns the notifications off when the push service no longer knows the device', async () => {
    const notifications = subscribed((fn) => {
      if (fn === sendTestNotification) {
        throw new HttpErrorResponse({ status: 410, error: { detail: "Cet appareil n'est plus abonné aux notifications : activez-les de nouveau" } });
      }
      return undefined;
    });

    await notifications.test();

    expect(notifications.state()).toBe('off');
    expect(toaster.error).toHaveBeenCalledWith("Cet appareil n'est plus abonné aux notifications : activez-les de nouveau");
  });
});
