import { ApplicationRef, PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { InstallPrompt } from './install-prompt';
import { ServiceWorkerGate } from './service-worker-gate';

describe('ServiceWorkerGate', () => {
  let cacheNames: string[];
  let unregister: ReturnType<typeof vi.fn>;

  /** The browser: a worker registered (with a Web Push subscription or not), serving the page or not. */
  function browser({ registered = false, subscribed = false, controlled = false } = {}): void {
    unregister = vi.fn(async () => true);
    const registration = registered
      ? { unregister, pushManager: { getSubscription: async () => (subscribed ? {} : null) } }
      : undefined;
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { controller: controlled ? {} : null, getRegistration: async () => registration, ready: Promise.resolve(registration) },
    });
    cacheNames = ['ngsw:/:db:control', 'ngsw:/:abc:assets:app:cache', 'yona-api', 'yona-local-ai'];
    vi.stubGlobal('caches', {
      keys: async () => [...cacheNames],
      delete: async (name: string) => {
        cacheNames = cacheNames.filter((kept) => kept !== name);
        return true;
      },
    });
  }

  function gate(installed = false): ServiceWorkerGate {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: InstallPrompt, useValue: { installed: signal(installed) } },
      ],
    });
    return TestBed.inject(ServiceWorkerGate);
  }

  /** Whether Angular would register the worker: the strategy emitted. */
  async function registers(serviceWorkerGate: ServiceWorkerGate): Promise<boolean> {
    let emitted = false;
    serviceWorkerGate.registrationStrategy().subscribe(() => (emitted = true));
    await serviceWorkerGate.kept();
    await TestBed.inject(ApplicationRef).whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    return emitted;
  }

  afterEach(() => {
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    vi.unstubAllGlobals();
  });

  it('registers no worker in a browser tab, and removes the copies of the site and of the API', async () => {
    browser();
    const serviceWorkerGate = gate();
    expect(await registers(serviceWorkerGate)).toBe(false);
    expect(await serviceWorkerGate.kept()).toBe(false);
    // The models of the local AI are kept: not a copy of the site
    expect(cacheNames).toEqual(['yona-local-ai']);
  });

  it('removes the worker an earlier version installed in a tab, its copies once it no longer serves the page', async () => {
    browser({ registered: true, controlled: true });
    expect(await gate().kept()).toBe(false);
    expect(unregister).toHaveBeenCalled();
    expect(cacheNames).toContain('yona-api');
  });

  it('keeps the worker of the installed app', async () => {
    browser({ registered: true, controlled: true });
    const serviceWorkerGate = gate(true);
    expect(await registers(serviceWorkerGate)).toBe(true);
    expect(unregister).not.toHaveBeenCalled();
    expect(cacheNames).toHaveLength(4);
  });

  it('keeps the worker of a tab that receives notifications', async () => {
    browser({ registered: true, subscribed: true, controlled: true });
    const serviceWorkerGate = gate();
    expect(await registers(serviceWorkerGate)).toBe(true);
    expect(unregister).not.toHaveBeenCalled();
  });

  it('registers the worker in a tab when notifications are turned on', async () => {
    browser();
    const serviceWorkerGate = gate();
    let emitted = false;
    serviceWorkerGate.registrationStrategy().subscribe(() => (emitted = true));
    await serviceWorkerGate.register();
    await new Promise((resolve) => setTimeout(resolve));
    expect(emitted).toBe(true);
  });
});
