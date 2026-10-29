import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Toaster } from '../notifications/toaster';
import { ConnectionStatus } from './connection-status';

describe('ConnectionStatus', () => {
  let toaster: Toaster;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'browser' }] });
    toaster = TestBed.inject(Toaster);
    TestBed.inject(ConnectionStatus).listen();
  });

  afterEach(() => vi.useRealTimers());

  it('says the connection is lost until it comes back, then says it is back', () => {
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('offline'));
    vi.advanceTimersByTime(60_000);
    expect(toaster.toasts().map((toast) => toast.message)).toEqual([
      'Hors connexion : les recettes déjà ouvertes restent lisibles',
    ]);

    window.dispatchEvent(new Event('online'));
    expect(toaster.toasts().map((toast) => toast.message)).toEqual(['Connexion retrouvée']);
    vi.advanceTimersByTime(5000);
    expect(toaster.toasts()).toEqual([]);
  });

  it('says nothing when the connection comes back without having been lost', () => {
    window.dispatchEvent(new Event('online'));
    expect(toaster.toasts()).toEqual([]);
  });
});
