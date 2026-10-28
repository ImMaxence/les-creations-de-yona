import { Injectable, inject, signal } from '@angular/core';
import { Api } from '../../../core/api/generated/api';
import { countUnreadFeedback } from '../../../core/api/generated/fn/admin-feedback/count-unread-feedback';

/** Unread messages of the visitors, beside "Retours" in the back-office menu. */
@Injectable({ providedIn: 'root' })
export class UnreadFeedback {
  private readonly api = inject(Api);

  readonly count = signal(0);

  async refresh(): Promise<void> {
    try {
      this.count.set((await this.api.invoke(countUnreadFeedback)).count);
    } catch {
      // The badge simply stays as it was
    }
  }
}
