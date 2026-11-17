import { Injectable, inject, signal } from '@angular/core';
import { Api } from '../../../core/api/generated/api';
import { countNewShopOrders } from '../../../core/api/generated/fn/admin-shop/count-new-shop-orders';

/** Orders nobody has handled yet, beside "Commandes" in the back-office menu. */
@Injectable({ providedIn: 'root' })
export class NewOrders {
  private readonly api = inject(Api);

  readonly count = signal(0);
  /** Counted once at least: until then, 0 says nothing. */
  readonly counted = signal(false);

  async refresh(): Promise<void> {
    try {
      this.count.set((await this.api.invoke(countNewShopOrders)).count);
      this.counted.set(true);
    } catch {
      // The badge simply stays as it was
    }
  }
}
