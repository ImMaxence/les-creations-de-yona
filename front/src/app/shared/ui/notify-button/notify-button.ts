import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NewRecipeNotifications } from '../../../core/pwa/new-recipe-notifications';
import { INSTALL_PATH } from '../../routing/links';
import { Icon } from '../icon/icon';

/**
 * "Me prévenir des nouvelles recettes", or "Notifications activées" with a way to stop them.
 * Nothing is shown where notifications cannot work, but on iPhone, where installing the app comes
 * first.
 */
@Component({
  selector: 'yona-notify-button',
  imports: [Icon, RouterLink],
  template: `
    @switch (notifications.state()) {
      @case ('off') {
        <button
          type="button"
          class="notify"
          [class.is-prominent]="prominent()"
          [disabled]="notifications.busy()"
          (click)="notifications.subscribe()"
        >
          <svg yonaIcon="bell" [size]="18"></svg>
          Me prévenir des nouvelles recettes
        </button>
      }
      @case ('on') {
        <button
          type="button"
          class="notify is-on"
          aria-pressed="true"
          [disabled]="notifications.busy()"
          (click)="notifications.unsubscribe()"
        >
          <svg yonaIcon="bell-ring" [size]="18"></svg>
          Notifications activées
          <span class="notify__hint">· désactiver</span>
        </button>
      }
      @case ('blocked') {
        <p class="notify__note">
          <svg yonaIcon="bell-off" [size]="18"></svg>
          Notifications bloquées pour ce site : autorisez-les dans les réglages du navigateur pour être prévenu·e des
          nouvelles recettes
        </p>
      }
      @case ('install-first') {
        @if (showInstallHint()) {
          <p class="notify__note">
            <svg yonaIcon="bell" [size]="18"></svg>
            <span>
              Pour être prévenu·e des nouvelles recettes sur iPhone,
              <a [routerLink]="installPath">installez d'abord l'application</a>
            </span>
          </p>
        }
      }
    }
  `,
  styleUrl: './notify-button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotifyButton {
  /** On iPhone, explain that installing the app comes first (the footer keeps quiet about it). */
  readonly showInstallHint = input(false);
  /** Filled with the accent and larger, to stand out (home page); outlined by default. */
  readonly prominent = input(false);

  protected readonly notifications = inject(NewRecipeNotifications);
  protected readonly installPath = INSTALL_PATH;
}
