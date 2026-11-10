import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NewRecipeNotifications } from '../../../core/pwa/new-recipe-notifications';
import { INSTALL_PATH } from '../../routing/links';
import { Icon } from '../icon/icon';

/**
 * "Me prévenir des nouvelles recettes" (short where the section around it says what for), or
 * "Notifications activées" with a separate button to stop them.
 * Nothing is shown where notifications cannot work, but on iPhone, where installing the app comes
 * first.
 */
@Component({
  selector: 'yona-notify-button',
  imports: [Icon, RouterLink],
  template: `
    @switch (notifications.state()) {
      @case ('off') {
        @if (asLink()) {
          <button type="button" class="notify is-link" [disabled]="notifications.busy()" (click)="notifications.subscribe()">Activer</button>
        } @else {
          <button
            type="button"
            class="notify"
            [class.is-prominent]="prominent()"
            [disabled]="notifications.busy()"
            (click)="notifications.subscribe()"
          >
            <svg yonaIcon="bell" [size]="prominent() ? 20 : 18"></svg>
            {{ prominent() ? 'Me prévenir' : 'Me prévenir des nouvelles recettes' }}
          </button>
        }
      }
      @case ('on') {
        <div class="notify-on">
          <span class="notify-on__status"><svg yonaIcon="bell-ring" [size]="18"></svg>Notifications activées</span>
          <button type="button" class="notify-on__stop" [disabled]="notifications.busy()" (click)="notifications.unsubscribe()">Désactiver</button>
        </div>
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
  /** Filled with the accent, larger and on one line (home page); outlined by default. */
  readonly prominent = input(false);
  /** "Activer", written in the site's colour, where the text beside says what for (home page). */
  readonly asLink = input(false);

  protected readonly notifications = inject(NewRecipeNotifications);
  protected readonly installPath = INSTALL_PATH;
}
