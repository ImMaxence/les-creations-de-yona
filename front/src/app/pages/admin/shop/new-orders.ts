import { Injectable, inject, signal } from '@angular/core';
import { Api } from '../../../core/api/generated/api';
import { countNewShopOrders } from '../../../core/api/generated/fn/admin-shop/count-new-shop-orders';

/** Orders nobody has handled yet, beside "Commandes" in the back-office menu. */
@Injectable({ providedIn: 'root' })
export class NewOrders {
  private readonly api = inject(Api);

  readonly count = signal(0);

  async refresh(): Promise<void> {
    try {
      this.count.set((await this.api.invoke(countNewShopOrders)).count);
    } catch {
      // The badge simply stays as it was
    }
  }
}
