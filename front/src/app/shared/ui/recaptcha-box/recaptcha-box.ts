import { ChangeDetectionStrategy, Component, DOCUMENT, ElementRef, afterNextRender, inject, model, signal, viewChild } from '@angular/core';
import { Api } from '../../../core/api/generated/api';
import { getFeedbackCaptcha } from '../../../core/api/generated/fn/feedback/get-feedback-captcha';
import { ColorScheme } from '../../../core/theme/color-scheme';
import { Button } from '../button/button';
import { Icon } from '../icon/icon';
import { Recaptcha, loadRecaptcha } from './recaptcha';

/**
 * "Je ne suis pas un robot", Google's reCAPTCHA, shown as soon as the page opens: the forms sent by
 * visitors. Its answer serves once: the parent calls reset() after a refusal, to have it ticked again.
 */
@Component({
  selector: 'yona-recaptcha-box',
  imports: [Button, Icon],
  template: `
    <div #box class="box"></div>
    @if (failed()) {
      <p class="error" role="alert">
        <svg yonaIcon="circle-alert" [size]="18"></svg>
        La vérification Google n’a pas pu se charger : vérifiez votre connexion ou votre bloqueur de publicités, puis réessayez
      </p>
      <button yonaButton variant="secondary" type="button" (click)="show()">Réessayer</button>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-2);
      justify-items: start;
    }

    // The height of Google's widget: the page does not jump when it appears
    .box {
      min-height: 78px;
    }

    .error {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--color-danger);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecaptchaBox {
  /** The answer of the checkbox; null while it is not ticked. */
  readonly token = model<string | null>(null);

  private readonly api = inject(Api);
  private readonly document = inject(DOCUMENT);
  private readonly colorScheme = inject(ColorScheme);
  private readonly box = viewChild.required<ElementRef<HTMLElement>>('box');

  protected readonly failed = signal(false);
  private recaptcha: Recaptcha | null = null;
  private widget = 0;

  constructor() {
    afterNextRender(() => void this.show());
  }

  protected async show(): Promise<void> {
    this.failed.set(false);
    try {
      const { siteKey } = await this.api.invoke(getFeedbackCaptcha);
      this.recaptcha = await loadRecaptcha(this.document);
      const view = this.document.defaultView!;
      const preference = this.colorScheme.preference();
      const dark = preference === 'auto' ? view.matchMedia('(prefers-color-scheme: dark)').matches : preference === 'dark';
      this.widget = this.recaptcha.render(this.box().nativeElement, {
        sitekey: siteKey,
        theme: dark ? 'dark' : 'light',
        // The normal widget is 304 px wide: too much for the smallest phones
        size: view.innerWidth < 360 ? 'compact' : 'normal',
        callback: (token) => this.token.set(token),
        'expired-callback': () => this.token.set(null),
        'error-callback': () => this.token.set(null),
      });
    } catch {
      this.failed.set(true);
    }
  }

  /** Google accepts an answer once: to be ticked again. */
  reset(): void {
    this.token.set(null);
    this.recaptcha?.reset(this.widget);
  }
}
