import { Injectable, computed, inject, signal } from '@angular/core';
import { Api } from '../../../core/api/generated/api';
import { getChangelogSeen } from '../../../core/api/generated/fn/admin-changelog/get-changelog-seen';
import { markChangelogSeen } from '../../../core/api/generated/fn/admin-changelog/mark-changelog-seen';
import { getErrorLogSummary } from '../../../core/api/generated/fn/admin-error-log/get-error-log-summary';
import { countUnseenMessages } from '../../../core/api/generated/fn/admin-messages/count-unseen-messages';
import { markMessagesSeen } from '../../../core/api/generated/fn/admin-messages/mark-messages-seen';
import { markErrorLogSeen } from '../../../core/api/generated/fn/admin-error-log/mark-error-log-seen';
import { countUnseenHistory } from '../../../core/api/generated/fn/admin-history/count-unseen-history';
import { markHistorySeen } from '../../../core/api/generated/fn/admin-history/mark-history-seen';
import { countUnseenTrash } from '../../../core/api/generated/fn/admin-trash/count-unseen-trash';
import { markTrashSeen } from '../../../core/api/generated/fn/admin-trash/mark-trash-seen';
import { ErrorLogSummary } from '../../../core/api/generated/models/error-log-summary';
import { Unseen } from '../../../core/api/generated/models/unseen';
import { FRONT_VERSION } from '../../../core/version';
import { MessageSound } from '../messages/message-sound';

/**
 * What the admin logged in has not looked at yet, beside the entries of the menu: what the others
 * wrote in "Messages", their changes in "Historique", what they put in "Corbeille", the new errors in "Journaux", a version
 * not read in "Nouveautés". Kept by the backend for each admin, on every device; asked when the
 * back-office opens, at each page, and when AdminLive tells something changed.
 */
@Injectable({ providedIn: 'root' })
export class AdminWatch {
  private readonly api = inject(Api);
  private readonly sound = inject(MessageSound);

  readonly history = signal<Unseen | null>(null);
  readonly logs = signal<ErrorLogSummary | null>(null);
  readonly trash = signal<Unseen | null>(null);
  readonly messages = signal<Unseen | null>(null);
  /** The version of "Nouveautés" read last; undefined until known. */
  private readonly changelogSeen = signal<string | null | undefined>(undefined);

  readonly historyCount = computed(() => this.history()?.count ?? 0);
  readonly logsCount = computed(() => this.logs()?.unseenErrors ?? 0);
  readonly trashCount = computed(() => this.trash()?.count ?? 0);
  readonly messagesCount = computed(() => this.messages()?.count ?? 0);
  /** The version running was not read in "Nouveautés" yet. */
  readonly changelogNew = computed(() => {
    const seen = this.changelogSeen();
    return seen !== undefined && seen !== FRONT_VERSION;
  });

  async refresh(): Promise<void> {
    await Promise.all([
      this.refreshMessages(),
      this.refreshHistory(),
      this.refreshTrash(),
      this.refreshLogs(),
      this.load(() => this.api.invoke(getChangelogSeen), (value) => this.changelogSeen.set(value.version ?? null)),
    ]);
  }

  /** A message of the others more than before (not at the first count): its little sound, on any page. */
  refreshMessages(): Promise<void> {
    return this.load(
      () => this.api.invoke(countUnseenMessages),
      (value) => {
        const before = this.messages();
        this.messages.set(value);
        if (before && value.count > before.count) {
          this.sound.play();
        }
      },
    );
  }

  refreshHistory(): Promise<void> {
    return this.load(() => this.api.invoke(countUnseenHistory), (value) => this.history.set(value));
  }

  refreshTrash(): Promise<void> {
    return this.load(() => this.api.invoke(countUnseenTrash), (value) => this.trash.set(value));
  }

  refreshLogs(): Promise<void> {
    return this.load(() => this.api.invoke(getErrorLogSummary), (value) => this.logs.set(value));
  }

  /** "Historique" opened: its badge goes; the rows new to the admin are those after {@link Unseen.since}. */
  async historySeen(): Promise<void> {
    await this.load(() => this.api.invoke(markHistorySeen), () => this.history.update((history) => history && { ...history, count: 0 }));
  }

  /** A group of "Messages" opened, or a message came while it is in sight: the badge counts the other groups only. */
  async messagesSeen(group: number): Promise<void> {
    await this.load(() => this.api.invoke(markMessagesSeen, { group }), () => undefined);
    await this.refreshMessages();
  }

  /** "Corbeille" opened: its badge goes. */
  async trashSeen(): Promise<void> {
    await this.load(() => this.api.invoke(markTrashSeen), () => this.trash.update((trash) => trash && { ...trash, count: 0 }));
  }

  async logsSeen(): Promise<void> {
    await this.load(() => this.api.invoke(markErrorLogSeen), () => this.logs.update((logs) => logs && { ...logs, unseenErrors: 0 }));
  }

  async changelogRead(): Promise<void> {
    await this.load(() => this.api.invoke(markChangelogSeen, { body: { version: FRONT_VERSION } }), () => this.changelogSeen.set(FRONT_VERSION));
  }

  private async load<T>(call: () => Promise<T>, then: (value: T) => void): Promise<void> {
    try {
      then(await call());
    } catch {
      // The badge simply stays as it was
    }
  }
}
