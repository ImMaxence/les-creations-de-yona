import { DOCUMENT, Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { CookieBanner } from './core/analytics/cookie-banner';
import { TimersBar } from './core/kitchen/timers-bar';
import { InstallBanner } from './core/pwa/install-banner';
import { AdminSession } from './core/auth/admin-session';
import { Footer } from './core/layout/footer/footer';
import { Header } from './core/layout/header/header';
import { NavigationProgress } from './core/layout/navigation-progress/navigation-progress';
import { SlowNavigation, skeletonOfPage } from './core/layout/page-skeleton/slow-navigation';
import { Toasts } from './core/notifications/toasts';
import { isBackOfficeUrl } from './shared/routing/links';
import { Skeleton } from './shared/ui/skeleton/skeleton';
import { TooltipLayer } from './shared/ui/tooltip/tooltip-layer';

@Component({
  selector: 'yona-root',
  imports: [RouterOutlet, Header, Footer, NavigationProgress, Skeleton, Toasts, CookieBanner, InstallBanner, TimersBar, TooltipLayer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly slowNavigation = inject(SlowNavigation);

  /** Another page of the site, slow to come: its shape in grey (a recipe, a list, an article). */
  protected readonly pageSkeleton = computed(() => {
    const target = this.slowNavigation.target();
    return target ? skeletonOfPage(target, this.router.url) : null;
  });

  /** Known from the address on arrival: the site's header never shows before the back-office. */
  protected readonly backOffice = toSignal(
    inject(Router).events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => isBackOfficeUrl(event.urlAfterRedirects)),
    ),
    { initialValue: isBackOfficeUrl(inject(Location).path()) },
  );

  constructor() {
    const adminSession = inject(AdminSession);
    afterNextRender(() => adminSession.restore());
  }

  /** A "#contenu" link would navigate to the home page because of <base href="/">. */
  protected skipToContent(event: Event): void {
    event.preventDefault();
    // In the back-office, past the side panel
    (this.document.getElementById('admin-content') ?? this.main().nativeElement).focus();
  }
}
