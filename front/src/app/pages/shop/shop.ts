import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api/generated/api';
import { placeOrder } from '../../core/api/generated/fn/shop/place-order';
import { ShopPage } from '../../core/api/generated/models/shop-page';
import { ShopProductCard } from '../../core/api/generated/models/shop-product-card';
import { storedSignal } from '../../core/kitchen/stored-signal';
import { formatEuros } from '../../shared/format/units';
import { PRIVACY_POLICY_PATH, RECIPES_PATH, orderTrackingLink } from '../../shared/routing/links';
import { Button } from '../../shared/ui/button/button';
import { CoverImage } from '../../shared/ui/cover-image/cover-image';
import { Icon } from '../../shared/ui/icon/icon';
import { RecaptchaBox } from '../../shared/ui/recaptcha-box/recaptcha-box';
import {
  EMPTY_REQUEST,
  MAX_QUANTITY,
  ShopRequest,
  afterSending,
  changeQuantity,
  chosenLines,
  filterProducts,
  isComplete,
  isRequest,
  itemCount,
  productCount,
  requestTotal,
  shopFilters,
} from './shop-request';

const MAX_MESSAGE_LENGTH = 2000;
const REQUEST_KEY = 'yona-shop-request';

/**
 * The shop: products to ask for, found by a search or a category, and "Ma demande" always at hand
 * (a button opening a side panel on computers, a bar fixed at the bottom of phones). A free text says
 * what the products do not. Nothing is paid on the site: Yona answers and agrees on the rest. Once
 * sent, the visitor lands on the page following the request, by its secret link.
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
  protected readonly formatEuros = formatEuros;
  protected readonly maxMessageLength = MAX_MESSAGE_LENGTH;
  protected readonly maxQuantity = MAX_QUANTITY;
  /** Today in Paris, as the date field wants it. */
  protected readonly today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });

  protected readonly request = storedSignal<ShopRequest>(REQUEST_KEY, EMPTY_REQUEST, isRequest);
  protected readonly search = signal('');
  /** The slug of the category shown; empty for all. */
  protected readonly category = signal('');
  protected readonly website = signal('');
  protected readonly captchaToken = signal<string | null>(null);
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly panelOpen = signal(false);
  private readonly captcha = viewChild(RecaptchaBox);
  private readonly panel = viewChild<ElementRef<HTMLDialogElement>>('panel');

  protected readonly categories = computed(() => shopFilters(this.shop().products));
  protected readonly shown = computed(() => filterProducts(this.shop().products, this.search(), this.category()));
  protected readonly categoryName = computed(() => this.categories().find((category) => category.slug === this.category())?.name);

  protected readonly chosen = computed(() => chosenLines(this.shop().products, this.request().quantities));
  protected readonly itemCount = computed(() => itemCount(this.chosen()));
  protected readonly total = computed(() => requestTotal(this.chosen()));
  protected readonly canSend = computed(() => !this.sending() && isComplete(this.request(), this.chosen()) && this.captchaToken() !== null);

  protected quantityOf(product: ShopProductCard): number {
    return this.request().quantities[product.id] ?? 0;
  }

  protected change(product: ShopProductCard, delta: number): void {
    const changed = changeQuantity(this.request(), this.shop().products, product.id, delta);
    if (changed.error) {
      this.error.set(changed.error);
      return;
    }
    this.request.set(changed.request);
  }

  protected setField(field: Exclude<keyof ShopRequest, 'quantities'>, value: string): void {
    this.request.update((request) => ({ ...request, [field]: value }));
  }

  protected units(count: number): string {
    return productCount(count);
  }

  protected openPanel(): void {
    this.error.set(null);
    this.panel()?.nativeElement.showModal();
    this.panelOpen.set(true);
  }

  protected closePanel(): void {
    this.panel()?.nativeElement.close();
  }

  /** The dark page around: closes it, as Escape. */
  protected closeOnBackdrop(event: MouseEvent): void {
    if (event.target === this.panel()?.nativeElement) {
      this.closePanel();
    }
  }

  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canSend()) {
      return;
    }
    const request = this.request();
    this.sending.set(true);
    this.error.set(null);
    try {
      const placed = await this.api.invoke(placeOrder, {
        body: {
          customerName: request.name.trim(),
          customerEmail: request.email.trim() || undefined,
          customerPhone: request.phone.trim() || undefined,
          wantedOn: request.wantedOn || undefined,
          message: request.message.trim() || undefined,
          lines: this.chosen().map(({ product, quantity }) => ({ productId: product.id, quantity })),
          website: this.website() || undefined,
          captchaToken: this.captchaToken() ?? undefined,
        },
      });
      // Sent: a new request starts empty, the contact kept for the next one
      this.request.set(afterSending(request));
      this.closePanel();
      await this.router.navigate(orderTrackingLink(placed.trackingToken));
    } catch (error) {
      // Google accepts an answer once: the box is to be ticked again
      this.captcha()?.reset();
      const detail = error instanceof HttpErrorResponse ? (error.error as { detail?: string } | null)?.detail : null;
      this.error.set(detail ?? 'La demande n’a pas pu être envoyée : vérifiez votre connexion et réessayez');
    } finally {
      this.sending.set(false);
    }
  }
}
