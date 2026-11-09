import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ADMIN_PATH, ADMIN_SIGN_IN_PATH } from '../../shared/routing/links';
import { AdminSession } from './admin-session';

/** Back-office pages: an admin session is required. Without one, the sign-in page. */
export const adminGuard: CanActivateFn = async () => {
  const session = inject(AdminSession);
  const router = inject(Router);
  return session.isAdmin() || (await session.load()) ? true : router.parseUrl(ADMIN_SIGN_IN_PATH);
};

/** The sign-in page: an admin already signed in goes straight to the back-office. */
export const signedOutGuard: CanActivateFn = async () => {
  const session = inject(AdminSession);
  const router = inject(Router);
  return session.isAdmin() || (await session.load()) ? router.parseUrl(ADMIN_PATH) : true;
};
