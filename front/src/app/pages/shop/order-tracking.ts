import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OrderTracking as Tracking } from '../../core/api/generated/models/order-tracking';
import { Toaster } from '../../core/notifications/toaster';
import { ORDER_STEPS } from '../../shared/format/order-status';
import { ParisDatePipe } from '../../shared/format/paris-date.pipe';
import { formatEuros } from '../../shared/format/units';
import { SHOP_PATH } from '../../shared/routing/links';
import { Button } from '../../shared/ui/button/button';
import { Icon } from '../../shared/ui/icon/icon';

/** Where an order stands, from the customer's secret link: no name and no contact on it. */
@Component({
  selector: 'yona-order-tracking',
  imports: [Button, Icon, ParisDatePipe, RouterLink],
  template: `
    <section class="container tracking">
      <header class="tracking__head">
        <p class="eyebrow enter">Merci pour votre confiance</p>
        <h1 class="enter" style="--delay: 60ms">Commande n° {{ order().number }}</h1>
        <p class="tracking__lead enter" style="--delay: 120ms">
          Gardez cette page : elle montre où en est votre commande, Yona vous contacte pour le reste
        </p>
        <button yonaButton variant="secondary" type="button" class="enter" style="--delay: 160ms" (click)="copyLink()">
          <svg yonaIcon="copy"></svg>Copier le lien de suivi
        </button>
      </header>

      @if (order().status === 'CANCELLED') {
        <p class="tracking__cancelled" role="status"><svg yonaIcon="circle-alert" [size]="20"></svg>Cette commande a été annulée</p>
      } @else {
        <ol role="list" class="steps">
          @for (step of steps; track step.status; let i = $index) {
            <li class="step" [class.is-done]="i <= currentStep()" [attr.aria-current]="i === currentStep() ? 'step' : null">
              <span class="step__dot" aria-hidden="true">
                @if (i <= currentStep()) {
                  <svg yonaIcon="check" [size]="14" [strokeWidth]="3"></svg>
                }
              </span>
              {{ step.label }}
            </li>
          }
        </ol>
      }

      <div class="tracking__card">
        <ul role="list" class="tracking__lines">
          @for (line of order().lines; track $index) {
            <li>
              <span>
                {{ line.quantity }} × {{ line.title }}
                @if (line.portionLabel; as portions) {
                  <span class="tracking__muted">{{ portions }}</span>
                }
              </span>
              <span>{{ formatEuros(line.unitPrice * line.quantity) }}</span>
            </li>
          }
          <li class="tracking__total">
            <span>Total</span>
            <span>{{ formatEuros(order().amount) }}</span>
          </li>
        </ul>
        <p class="tracking__muted">
          Envoyée le <time [attr.datetime]="order().createdAt">{{ order().createdAt | parisDate }}</time>
          @if (order().wantedOn; as wanted) {
            · souhaitée pour le <time [attr.datetime]="wanted">{{ wanted | parisDate }}</time>
          }
        </p>
      </div>

      <a class="tracking__back" [routerLink]="shopPath"><svg yonaIcon="arrow-left" [size]="16"></svg>Retour à la boutique</a>
    </section>
  `,
  styles: `
    .tracking {
      display: grid;
      gap: var(--space-6);
      max-width: 44rem;
      padding-block: var(--space-8);
    }

    .tracking__head {
      display: grid;
      gap: var(--space-3);
      justify-items: start;
    }

    .tracking__lead,
    .tracking__muted {
      color: var(--color-text-muted);
    }

    .tracking__muted {
      display: block;
      font-size: var(--text-sm);
    }

    .tracking__cancelled {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--color-danger);
      font-weight: 600;
    }

    .steps {
      display: grid;
      gap: var(--space-3);
    }

    .step {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      color: var(--color-text-muted);

      &.is-done {
        color: var(--color-text);
        font-weight: 600;
      }
    }

    .step__dot {
      display: inline-grid;
      place-items: center;
      width: 1.5rem;
      height: 1.5rem;
      border: 2px solid var(--color-line);
      border-radius: 50%;
    }

    .step.is-done .step__dot {
      border-color: var(--color-accent);
      background-color: var(--color-accent);
      color: var(--color-on-accent);
    }

    .tracking__card {
      display: grid;
      gap: var(--space-3);
      padding: var(--space-5);
      border-radius: var(--radius-lg);
      background-color: var(--color-surface);
    }

    .tracking__lines {
      display: grid;
      gap: var(--space-2);

      li {
        display: flex;
        justify-content: space-between;
        gap: var(--space-3);
      }
    }

    .tracking__total {
      padding-top: var(--space-2);
      border-top: 1px solid var(--color-line);
      font-weight: 700;
    }

    .tracking__back {
      display: inline-flex;
      align-items: center;
      justify-self: start;
      gap: var(--space-1);
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--color-accent);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class OrderTracking {
  /** From orderTrackingResolver. */
  readonly order = input.required<Tracking>();

  private readonly toaster = inject(Toaster);

  protected readonly steps = ORDER_STEPS;
  protected readonly shopPath = SHOP_PATH;
  protected readonly formatEuros = formatEuros;
  protected readonly currentStep = computed(() => ORDER_STEPS.findIndex((step) => step.status === this.order().status));

  protected async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(window.location.href);
      this.toaster.success('Lien de suivi copié');
    } catch {
      this.toaster.error(`Copie impossible. Voici le lien : ${window.location.href}`);
    }
  }
}
