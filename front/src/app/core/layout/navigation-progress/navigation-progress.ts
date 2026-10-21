import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';
import { filter, map } from 'rxjs';

/**
 * Thin bar at the top of the screen while the next page loads its data. It only shows up after
 * a short delay (CSS), so fast navigations stay free of any flicker.
 */
@Component({
  selector: 'yona-navigation-progress',
  template: `
    @if (navigating()) {
      <div class="bar" animate.leave="bar--done"></div>
    }
  `,
  styleUrl: './navigation-progress.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationProgress {
  protected readonly navigating = toSignal(
    inject(Router).events.pipe(
      filter(
        (event) =>
          event instanceof NavigationStart ||
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError,
      ),
      map((event) => event instanceof NavigationStart),
    ),
    { initialValue: false },
  );
}
