import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AdminSession } from './admin-session';
import { adminGuard, signedOutGuard } from './admin.guard';

describe('back-office guards', () => {
  function run(guard: CanActivateFn, signedIn: boolean) {
    TestBed.configureTestingModule({
      providers: [{ provide: AdminSession, useValue: { isAdmin: () => false, load: async () => (signedIn ? {} : null) } }],
    });
    return runInInjectionContext(TestBed.inject(EnvironmentInjector), () =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as Promise<boolean | UrlTree>;
  }

  const url = (tree: boolean | UrlTree) => TestBed.inject(Router).serializeUrl(tree as UrlTree);

  it('lets an admin in', async () => {
    expect(await run(adminGuard, true)).toBe(true);
  });

  it('sends anyone else to the sign-in page, not straight to Google', async () => {
    expect(url(await run(adminGuard, false))).toBe('/admin/connexion');
  });

  it('shows the sign-in page to someone signed out', async () => {
    expect(await run(signedOutGuard, false)).toBe(true);
  });

  it('skips the sign-in page for an admin already signed in', async () => {
    expect(url(await run(signedOutGuard, true))).toBe('/admin');
  });
});
