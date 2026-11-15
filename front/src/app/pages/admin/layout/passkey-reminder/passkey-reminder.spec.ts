import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminSession } from '../../../../core/auth/admin-session';
import { AdminResponse } from '../../../../core/api/generated/models/admin-response';
import { PasskeyReminder, readPostponed } from './passkey-reminder';

describe('PasskeyReminder', () => {
  const admin = signal<AdminResponse | null>(null);

  function render(passkeys: number): HTMLElement {
    admin.set({ id: 7, email: 'yona@example.fr', name: 'Yona', passkeys });
    const fixture = TestBed.createComponent(PasskeyReminder);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AdminSession,
          useValue: { admin, needsPasskey: () => admin()?.passkeys === 0 },
        },
      ],
    });
  });

  it('asks an admin without a passkey to add one in "Mon compte"', () => {
    const element = render(0);

    expect(element.textContent).toContain('Ajoutez une passkey');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/admin/mon-compte');
  });

  it('says nothing to an admin who has one', () => {
    expect(render(1).textContent?.trim()).toBe('');
  });

  it('waits a week after "Plus tard", for this admin only', () => {
    const element = render(0);
    const later = [...element.querySelectorAll('button')].find((button) => button.textContent?.includes('Plus tard'));
    later?.click();
    TestBed.tick();

    expect(element.textContent).not.toContain('Ajoutez une passkey');
    const until = readPostponed()['7'];
    expect(until).toBeGreaterThan(Date.now() + 6 * 24 * 3600 * 1000);
  });

  it('reads a postponement it cannot understand as none', () => {
    localStorage.setItem('admin-passkey-reminder', '[1, 2]');
    expect(readPostponed()).toEqual({});
    localStorage.setItem('admin-passkey-reminder', '{broken');
    expect(readPostponed()).toEqual({});
  });
});
