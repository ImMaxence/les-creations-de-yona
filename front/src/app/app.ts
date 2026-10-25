import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AdminSession } from './core/auth/admin-session';
import { Footer } from './core/layout/footer/footer';
import { Header } from './core/layout/header/header';
import { NavigationProgress } from './core/layout/navigation-progress/navigation-progress';
import { Toasts } from './core/notifications/toasts';

@Component({
  selector: 'yona-root',
  imports: [RouterOutlet, Header, Footer, NavigationProgress, Toasts],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  constructor() {
    const adminSession = inject(AdminSession);
    afterNextRender(() => adminSession.restore());
  }

  /** A "#contenu" link would navigate to the home page because of <base href="/">. */
  protected skipToContent(event: Event): void {
    event.preventDefault();
    this.main().nativeElement.focus();
  }
}
