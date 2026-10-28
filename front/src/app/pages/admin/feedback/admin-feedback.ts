import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
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
import { Pagination } from '../../../shared/ui/pagination/pagination';
import { UnreadFeedback } from './unread-feedback';

const PAGE_SIZE = 20;

/**
 * "Retours": the messages visitors send from "Donner mon avis", the latest first, the unread ones
 * marked. An email given by the visitor opens a reply; nothing is sent from the site. Kept 12
 * months, then erased.
 */
@Component({
  selector: 'yona-admin-feedback',
  imports: [Button, Icon, Pagination],
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

      @if (messages.value(); as result) {
        @if (result.content.length) {
          <ul role="list" class="admin-list">
            @for (message of result.content; track message.id) {
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
          @if (result.totalPages > 1) {
            <yona-pagination buttons [page]="page()" [totalPages]="result.totalPages" (pageChange)="page.set($event)" />
          }
        } @else {
          <p class="admin-empty">Aucun message pour le moment</p>
        }
      } @else if (messages.isLoading()) {
        <p class="admin-empty">Chargement…</p>
      }
    </section>
  `,
  styles: `
    .feedback.is-unread {
      box-shadow: inset 3px 0 0 var(--color-accent);
    }

    .feedback__message {
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
  /** From 1. */
  protected readonly page = signal(1);
  protected readonly messages = resource({
    params: () => ({ page: this.page() - 1 }),
    loader: ({ params }) => this.api.invoke(listFeedback, { page: params.page, size: PAGE_SIZE }),
  });

  protected async markRead(message: FeedbackResponse, read: boolean): Promise<void> {
    if ((await attempt(this.api.invoke(markFeedbackRead, { ids: [message.id], read }))).ok) {
      this.reload();
    }
  }

  protected async markAllRead(): Promise<void> {
    const unread = this.messages.value()?.content.filter((message) => !message.readAt).map((message) => message.id) ?? [];
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
