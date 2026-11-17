import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NotificationTopic, SiteNotifications } from '../../../core/pwa/site-notifications';
import { INSTALL_PATH } from '../../routing/links';
import { Icon } from '../icon/icon';
import { NotificationSettings } from './notification-settings';

/** What the button says of each topic. */
const WORDS: Record<NotificationTopic, { offer: string; what: string }> = {
  recipes: { offer: 'Me prévenir des nouvelles recettes', what: 'des nouvelles recettes' },
  articles: { offer: 'Me prévenir des nouveaux articles', what: 'des nouveaux articles' },
};

/**
 * "Me prévenir des nouvelles recettes" or "… des nouveaux articles" (2.24; short where the section around it says
 * what for), or "Notifications activées" with "Gérer", which opens "Mes notifications": both topics, a test, and
 * everything stopped. Nothing is shown where notifications cannot work, but on iPhone, where installing the app
 * comes first.
 */
@Component({
  selector: 'yona-notify-button',
  imports: [Icon, NotificationSettings, RouterLink],
  template: `
    @switch (view()) {
      @case ('offer') {
        @if (asLink()) {
          <button type="button" class="notify is-link" [disabled]="notifications.busy()" (click)="notifications.enable(topic())">Activer</button>
        } @else {
          <button
            type="button"
            class="notify"
            [class.is-prominent]="prominent()"
            [disabled]="notifications.busy()"
            (click)="notifications.enable(topic())"
          >
            <svg yonaIcon="bell" [size]="prominent() ? 20 : 18"></svg>
            {{ prominent() ? 'Me prévenir' : words().offer }}
          </button>
        }
      }
      @case ('on') {
        <div class="notify-on">
          <span class="notify-on__status"><svg yonaIcon="bell-ring" [size]="18"></svg>Notifications activées</span>
          <button type="button" class="notify-on__stop" aria-haspopup="dialog" (click)="settingsOpen.set(true)">Gérer</button>
        </div>
      }
      @case ('blocked') {
        <p class="notify__note">
          <svg yonaIcon="bell-off" [size]="18"></svg>
          Notifications bloquées pour ce site : autorisez-les dans les réglages du navigateur pour être prévenu·e
          {{ words().what }}
        </p>
      }
      @case ('install-first') {
        @if (showInstallHint()) {
          <p class="notify__note">
            <svg yonaIcon="bell" [size]="18"></svg>
            <span>
              Pour être prévenu·e {{ words().what }} sur iPhone,
              <a [routerLink]="installPath">installez d'abord l'application</a>
            </span>
          </p>
        }
      }
    }
    <yona-notification-settings [(open)]="settingsOpen" />
  `,
  styleUrl: './notify-button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotifyButton {
  /** What it offers: the new recipes (footer, home page, install page) or the new articles of "Mon CAP" (2.24). */
  readonly topic = input<NotificationTopic>('recipes');
  /** On iPhone, explain that installing the app comes first (the footer keeps quiet about it). */
  readonly showInstallHint = input(false);
  /** Filled with the accent, larger and on one line (home page); outlined by default. */
  readonly prominent = input(false);
  /** "Activer", written in the site's colour, where the text beside says what for (home page). */
  readonly asLink = input(false);

  protected readonly notifications = inject(SiteNotifications);
  protected readonly installPath = INSTALL_PATH;
  protected readonly settingsOpen = signal(false);
  protected readonly words = computed(() => WORDS[this.topic()]);

  /**
   * What it shows: the offer while this device is not told of the topic (subscribed for the other one, the
   * browser asks nothing more), "Notifications activées" once it is, or while what it is told of is not known.
   */
  protected readonly view = computed(() => {
    const state = this.notifications.state();
    if (state === 'on') {
      const topics = this.notifications.topics();
      return !topics || topics[this.topic()] ? 'on' : 'offer';
    }
    return state === 'off' ? 'offer' : state;
  });
}
