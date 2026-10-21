import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideMenu, LucideX } from '@lucide/angular';
import { AdminSession } from '../../auth/admin-session';
import { SiteData } from '../../site/site-data';
import { RECIPES_PATH, categoryQueryParams } from '../../../shared/routing/links';
import { BrandIcon, socialPlatformLabel } from '../../../shared/ui/brand-icon/brand-icon';

/**
 * Phone menu: a full screen native <dialog>. showModal() brings focus trapping, Escape to close
 * and an inert page behind, without any extra code.
 */
@Component({
  selector: 'yona-mobile-menu',
  imports: [RouterLink, RouterLinkActive, LucideMenu, LucideX, BrandIcon],
  templateUrl: './mobile-menu.html',
  styleUrl: './mobile-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileMenu {
  protected readonly siteData = inject(SiteData);
  protected readonly adminSession = inject(AdminSession);
  protected readonly recipesPath = RECIPES_PATH;
  protected readonly categoryQueryParams = categoryQueryParams;
  protected readonly socialPlatformLabel = socialPlatformLabel;

  protected readonly isOpen = signal(false);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected open(): void {
    this.dialog().nativeElement.showModal();
    this.isOpen.set(true);
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  /** Called on every close, including Escape. */
  protected onClosed(): void {
    this.isOpen.set(false);
  }
}
