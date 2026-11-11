import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { deleteFeedback } from '../../../core/api/generated/fn/admin-feedback/delete-feedback';
import { listFeedback } from '../../../core/api/generated/fn/admin-feedback/list-feedback';
import { markFeedbackRead } from '../../../core/api/generated/fn/admin-feedback/mark-feedback-read';
import { FeedbackResponse } from '../../../core/api/generated/models/feedback-response';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { parisDateTime } from '../../../shared/format/paris-time';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';
import { InfiniteList } from '../../../shared/ui/infinite-scroll/infinite-list';
import { InfiniteScroll } from '../../../shared/ui/infinite-scroll/infinite-scroll';
import { UnreadFeedback } from './unread-feedback';
import { Skeleton } from '../../../shared/ui/skeleton/skeleton';

const PAGE_SIZE = 20;

/**
 * "Retours": the messages visitors send from "Donner mon avis", the latest first, the unread ones
 * marked. An email given by the visitor opens a reply; nothing is sent from the site. Kept 12
 * months, then erased.
 */
@Component({
  selector: 'yona-admin-feedback',
  imports: [Button, Icon, InfiniteScroll, Skeleton],
  template: `
    <section class="admin-section" aria-labelledby="feedback-title">
      <div class="admin-section__head">
        <h2 id="feedback-title">Retours des visiteurs</h2>
        @if (unread.count()) {
          <button yonaButton variant="secondary" type="button" (click)="markAllRead()">
            <svg yonaIcon="check"></svg>Tout marquer comme lu
          </button>
        }
      </div>
      <p class="field__hint">
        Les messages envoyés depuis « Donner mon avis », en bas de chaque page. Ils sont effacés au bout de 12 mois
      </p>

      @if (messages.items().length) {
          <ul role="list" class="admin-list admin-list--infinite">
            @for (message of messages.items(); track message.id) {
              <li class="admin-row feedback" [class.is-unread]="!message.readAt">
                <div class="admin-row__main">
                  <span class="admin-row__meta">
                    @if (!message.readAt) {
                      <span class="badge badge--published">Nouveau</span>
                    }
                    {{ dateTime(message.createdAt) }}
                    @if (message.page) {
                      · depuis <a class="link-button" [href]="message.page" target="_blank">{{ message.page }}</a>
                    }
                  </span>
                  <p class="feedback__message">{{ message.message }}</p>
                  @if (message.email; as email) {
                    <a class="link-button" [href]="'mailto:' + email"><svg yonaIcon="mail" [size]="14"></svg>Répondre à {{ email }}</a>
                  }
                </div>
                <div class="admin-row__actions">
                  <button
                    type="button"
                    class="icon-button"
                    [attr.aria-label]="message.readAt ? 'Marquer comme non lu' : 'Marquer comme lu'"
                    (click)="markRead(message, !message.readAt)"
                  >
                    <svg [yonaIcon]="message.readAt ? 'eye-off' : 'eye'" [size]="18"></svg>
                  </button>
                  <button type="button" class="icon-button icon-button--danger" aria-label="Supprimer le message" (click)="remove(message)">
                    <svg yonaIcon="trash" [size]="18"></svg>
                  </button>
                </div>
              </li>
            }
          </ul>
      } @else if (messages.isEmpty()) {
        <p class="admin-empty">Aucun message pour le moment</p>
      } @else if (messages.isLoading()) {
        <yona-skeleton kind="rows" [count]="4" />
      }
      <yona-infinite-scroll skeleton="rows" [list]="messages" />
    </section>
  `,
  styles: `
    // A card: the row's outline, the message on the surface colour, read ones quieter
    .feedback {
      align-items: flex-start;
      padding: var(--space-4);
      border: 1px solid var(--color-line);
      box-shadow: var(--shadow-sm);
    }

    // Unread: an accent bar on the left, inside the outline rather than in place of it
    .feedback.is-unread {
      border-color: color-mix(in srgb, var(--color-accent) 45%, var(--color-line));
      border-left: 4px solid var(--color-accent);
    }

    .feedback__message {
      padding: var(--space-3);
      border-radius: var(--radius-sm);
      background-color: var(--color-surface);
      white-space: pre-line;
      overflow-wrap: anywhere;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminFeedback {
  private readonly api = inject(Api);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);
  protected readonly unread = inject(UnreadFeedback);

  protected readonly dateTime = parisDateTime;
  protected readonly messages = new InfiniteList({
    load: (page) => this.api.invoke(listFeedback, { page, size: PAGE_SIZE }),
    key: (message) => message.id,
  });

  protected async markRead(message: FeedbackResponse, read: boolean): Promise<void> {
    if ((await attempt(this.api.invoke(markFeedbackRead, { ids: [message.id], read }))).ok) {
      this.reload();
    }
  }

  protected async markAllRead(): Promise<void> {
    const unread = this.messages.items().filter((message) => !message.readAt).map((message) => message.id);
    if (unread.length && (await attempt(this.api.invoke(markFeedbackRead, { ids: unread, read: true }))).ok) {
      this.toaster.success('Messages marqués comme lus');
      this.reload();
    }
  }

  protected async remove(message: FeedbackResponse): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Supprimer ce message ?',
      message: 'Il est effacé pour de bon, sans passer par la corbeille',
      confirmLabel: 'Supprimer',
    });
    if (confirmed && (await attempt(this.api.invoke(deleteFeedback, { ids: [message.id] }))).ok) {
      this.toaster.success('Message supprimé');
      this.reload();
    }
  }

  private reload(): void {
    this.messages.reload();
    void this.unread.refresh();
  }
}
