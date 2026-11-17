import { ChangeDetectionStrategy, Component, effect, inject, model, signal } from '@angular/core';
import { NotificationTopic, SiteNotifications } from '../../../core/pwa/site-notifications';
import { Button } from '../button/button';
import { Dialog } from '../dialog/dialog';
import { Icon } from '../icon/icon';

interface Choice {
  topic: NotificationTopic;
  label: string;
  hint: string;
}

const CHOICES: Choice[] = [
  { topic: 'recipes', label: 'Nouvelles recettes', hint: 'Une notification à chaque recette publiée' },
  { topic: 'articles', label: 'Nouveaux articles de Mon CAP', hint: 'Une notification à chaque article publié' },
];

/**
 * "Mes notifications" (2.24): what this device is told of, each choice saved as it is made; a test notification;
 * everything stopped at once. Opened from the button of the notifications once they are on.
 */
@Component({
  selector: 'yona-notification-settings',
  imports: [Button, Dialog, Icon],
  template: `
    <yona-dialog title="Mes notifications" subtitle="Sur cet appareil, même le site fermé" size="sm" [(open)]="open">
      <ul role="list" class="settings__choices">
        @for (choice of choices; track choice.topic) {
          <li>
            <label class="switch">
              <span class="switch__text">
                <span class="switch__label">{{ choice.label }}</span>
                <span class="switch__hint">{{ choice.hint }}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                class="switch__input"
                [checked]="notifications.topics()?.[choice.topic] ?? false"
                [disabled]="notifications.busy()"
                (change)="toggle(choice.topic, $event)"
              />
            </label>
          </li>
        }
      </ul>
      <div class="settings__test">
        <button yonaButton variant="secondary" type="button" [disabled]="notifications.testing()" (click)="test()">
          <svg yonaIcon="send"></svg>Envoyer une notification de test
        </button>
        <p class="settings__hint">Pour vérifier qu'elles arrivent bien sur cet appareil</p>
      </div>
      <!-- Said here: a toast would be hidden behind the dialog -->
      <p class="settings__said" [class.is-error]="said()?.error" aria-live="polite">
        @if (said(); as message) {
          <svg [yonaIcon]="message.error ? 'circle-alert' : 'circle-check'" [size]="18"></svg>{{ message.text }}
        }
      </p>
      <ng-container dialogActions>
        <button yonaButton variant="ghost" type="button" [disabled]="notifications.busy()" (click)="disableAll()">
          <svg yonaIcon="bell-off"></svg>Tout désactiver
        </button>
        <button yonaButton type="button" (click)="open.set(false)">Fermer</button>
      </ng-container>
    </yona-dialog>
  `,
  styles: `
    .settings__choices {
      display: grid;
      margin: 0 0 var(--space-4);
      padding: 0;
      border-bottom: 1px solid var(--color-line);
    }

    .settings__test {
      display: grid;
      justify-items: start;
      gap: var(--space-2);
    }

    .settings__test .button {
      max-width: 100%;
      white-space: normal;
    }

    .settings__hint {
      color: var(--color-text-muted);
      font-size: var(--text-sm);
    }

    .settings__said {
      display: flex;
      align-items: flex-start;
      gap: var(--space-2);
      margin-top: var(--space-3);
      font-size: var(--text-sm);
      font-weight: 600;

      &:empty {
        display: none;
      }

      &.is-error {
        color: var(--color-danger);
      }

      svg {
        flex: none;
        margin-top: 0.1rem;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationSettings {
  readonly open = model(false);

  protected readonly notifications = inject(SiteNotifications);
  protected readonly choices = CHOICES;
  /** The outcome of the last action, under the test button. */
  protected readonly said = signal<{ text: string; error: boolean } | null>(null);

  constructor() {
    // Read again at each opening: changed on another page, or not known yet
    effect(() => {
      if (this.open()) {
        this.said.set(null);
        void this.notifications.readTopics();
      }
    });
  }

  protected async toggle(topic: NotificationTopic, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const topics = { recipes: false, articles: false, ...this.notifications.topics(), [topic]: input.checked };
    this.said.set(null);
    const refused = await this.notifications.choose(topics);
    if (refused) {
      // Not saved: the switch goes back to what is true
      input.checked = !input.checked;
      this.said.set({ text: refused, error: true });
    } else if (!topics.recipes && !topics.articles) {
      this.open.set(false);
    }
  }

  protected async test(): Promise<void> {
    this.said.set(null);
    const { sent, message } = await this.notifications.sendTest();
    this.said.set({ text: message, error: !sent });
  }

  protected async disableAll(): Promise<void> {
    this.said.set(null);
    const refused = await this.notifications.disableAll();
    if (refused) {
      this.said.set({ text: refused, error: true });
    } else {
      this.open.set(false);
    }
  }
}
