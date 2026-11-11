import { Injectable, computed, inject, signal } from '@angular/core';
import { Api } from '../../../core/api/generated/api';
import { getChangelogSeen } from '../../../core/api/generated/fn/admin-changelog/get-changelog-seen';
import { markChangelogSeen } from '../../../core/api/generated/fn/admin-changelog/mark-changelog-seen';
import { getErrorLogSummary } from '../../../core/api/generated/fn/admin-error-log/get-error-log-summary';
import { markErrorLogSeen } from '../../../core/api/generated/fn/admin-error-log/mark-error-log-seen';
import { countUnseenHistory } from '../../../core/api/generated/fn/admin-history/count-unseen-history';
import { markHistorySeen } from '../../../core/api/generated/fn/admin-history/mark-history-seen';
import { ErrorLogSummary } from '../../../core/api/generated/models/error-log-summary';
import { Unseen } from '../../../core/api/generated/models/unseen';
import { FRONT_VERSION } from '../../../core/version';

/**
 * What the admin logged in has not looked at yet, beside the entries of the menu: the changes of
 * the others in "Historique", the new errors in "Journaux", a version not read in "Nouveautés". Kept
 * by the backend for each admin, on every device; asked when the back-office opens and at each page.
 */
@Injectable({ providedIn: 'root' })
export class AdminWatch {
  private readonly api = inject(Api);

  readonly history = signal<Unseen | null>(null);
  readonly logs = signal<ErrorLogSummary | null>(null);
  /** The version of "Nouveautés" read last; undefined until known. */
  private readonly changelogSeen = signal<string | null | undefined>(undefined);

  readonly historyCount = computed(() => this.history()?.count ?? 0);
  readonly logsCount = computed(() => this.logs()?.unseenErrors ?? 0);
  /** The version running was not read in "Nouveautés" yet. */
  readonly changelogNew = computed(() => {
    const seen = this.changelogSeen();
    return seen !== undefined && seen !== FRONT_VERSION;
  });

  async refresh(): Promise<void> {
    await Promise.all([
      this.load(() => this.api.invoke(countUnseenHistory), (value) => this.history.set(value)),
      this.load(() => this.api.invoke(getErrorLogSummary), (value) => this.logs.set(value)),
      this.load(() => this.api.invoke(getChangelogSeen), (value) => this.changelogSeen.set(value.version ?? null)),
    ]);
  }

  /** "Historique" opened: its badge goes; the rows new to the admin are those after {@link Unseen.since}. */
  async historySeen(): Promise<void> {
    await this.load(() => this.api.invoke(markHistorySeen), () => this.history.update((history) => history && { ...history, count: 0 }));
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
