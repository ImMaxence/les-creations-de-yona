import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api/generated/api';
import { placeOrder } from '../../core/api/generated/fn/shop/place-order';
import { ShopPage } from '../../core/api/generated/models/shop-page';
import { ShopProductCard } from '../../core/api/generated/models/shop-product-card';
import { formatEuros } from '../../shared/format/units';
import { PRIVACY_POLICY_PATH, RECIPES_PATH, orderTrackingLink, recipeLinkOf } from '../../shared/routing/links';
import { Button } from '../../shared/ui/button/button';
import { CoverImage } from '../../shared/ui/cover-image/cover-image';
import { Icon } from '../../shared/ui/icon/icon';
import { RecaptchaBox } from '../../shared/ui/recaptcha-box/recaptcha-box';

const MAX_QUANTITY = 50;
const MAX_MESSAGE_LENGTH = 2000;

/**
 * The shop: recipes of the blog to ask for, a free text and a way to answer. Nothing is paid on the
 * site: Yona answers and agrees on the rest. Once sent, the visitor lands on the page following the
 * order, by its secret link.
 */
@Component({
  selector: 'yona-shop',
  imports: [Button, CoverImage, Icon, RecaptchaBox, RouterLink],
  templateUrl: './shop.html',
  styleUrl: './shop.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Shop {
  /** From shopResolver. */
  readonly shop = input.required<ShopPage>();

  private readonly api = inject(Api);
  private readonly router = inject(Router);

  protected readonly recipesPath = RECIPES_PATH;
  protected readonly privacyPolicyPath = PRIVACY_POLICY_PATH;
  protected readonly recipeLinkOf = recipeLinkOf;
  protected readonly formatEuros = formatEuros;
  protected readonly maxMessageLength = MAX_MESSAGE_LENGTH;
  protected readonly maxQuantity = MAX_QUANTITY;
  /** Today in Paris, as the date field wants it. */
  protected readonly today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });

  /** By product id; a product at 0 is not in the order. */
  protected readonly quantities = signal<ReadonlyMap<number, number>>(new Map());
  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly phone = signal('');
  protected readonly wantedOn = signal('');
  protected readonly message = signal('');
  protected readonly website = signal('');
  protected readonly captchaToken = signal<string | null>(null);
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly captcha = viewChild(RecaptchaBox);

  protected readonly chosen = computed(() =>
    this.shop().products.flatMap((product) => {
      const quantity = this.quantities().get(product.id) ?? 0;
      return quantity ? [{ product, quantity }] : [];
    }),
  );
  protected readonly total = computed(() => this.chosen().reduce((sum, { product, quantity }) => sum + product.price * quantity, 0));
  protected readonly hasContact = computed(() => !!this.email().trim() || !!this.phone().trim());
  protected readonly canSend = computed(
    () => !this.sending() && this.chosen().length > 0 && !!this.name().trim() && this.hasContact() && this.captchaToken() !== null,
  );

  protected quantityOf(product: ShopProductCard): number {
    return this.quantities().get(product.id) ?? 0;
  }

  protected change(product: ShopProductCard, delta: number): void {
    this.quantities.update((quantities) => {
      const next = new Map(quantities);
      next.set(product.id, Math.min(MAX_QUANTITY, Math.max(0, (next.get(product.id) ?? 0) + delta)));
      return next;
    });
  }

  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canSend()) {
      return;
    }
    this.sending.set(true);
    this.error.set(null);
    try {
      const placed = await this.api.invoke(placeOrder, {
        body: {
          customerName: this.name().trim(),
          customerEmail: this.email().trim() || undefined,
          customerPhone: this.phone().trim() || undefined,
          wantedOn: this.wantedOn() || undefined,
          message: this.message().trim() || undefined,
          lines: this.chosen().map(({ product, quantity }) => ({ productId: product.id, quantity })),
          website: this.website() || undefined,
          captchaToken: this.captchaToken() ?? undefined,
        },
      });
      await this.router.navigate(orderTrackingLink(placed.trackingToken));
    } catch (error) {
      // Google accepts an answer once: the box is to be ticked again
      this.captcha()?.reset();
      const detail = error instanceof HttpErrorResponse ? (error.error as { detail?: string } | null)?.detail : null;
      this.error.set(detail ?? 'La commande n’a pas pu être envoyée : vérifiez votre connexion et réessayez');
    } finally {
      this.sending.set(false);
    }
  }
}
