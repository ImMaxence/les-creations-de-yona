import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DOCUMENT, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { safeParse } from '../../core/api/admin-errors.interceptor';
import { Api } from '../../core/api/generated/api';
import { getFeedbackCaptcha } from '../../core/api/generated/fn/feedback/get-feedback-captcha';
import { sendFeedback } from '../../core/api/generated/fn/feedback/send-feedback';
import { PRIVACY_POLICY_PATH, RECIPES_PATH, TERMS_OF_USE_PATH } from '../../shared/routing/links';
import { Button } from '../../shared/ui/button/button';
import { Icon } from '../../shared/ui/icon/icon';
import { ColorScheme } from '../../core/theme/color-scheme';
import { Recaptcha, loadRecaptcha } from './recaptcha';

const MAX_MESSAGE_LENGTH = 2000;

/**
 * "Donner mon avis": a message to Yona, an idea, a problem met on the site. Read in the back-office
 * ("Retours"); the email is optional, only to get an answer. A field hidden from people catches the
 * simplest robots; "Je ne suis pas un robot" is Google's reCAPTCHA, loaded only after the visitor's
 * click, like the YouTube videos. Its answer serves once: a refused message asks to tick it again.
 */
@Component({
  selector: 'yona-feedback',
  imports: [Button, Icon, RouterLink],
  template: `
    <section class="container feedback">
      <header class="feedback__head">
        <p class="eyebrow enter">Votre avis compte</p>
        <h1 class="enter" style="--delay: 60ms">Donner mon avis</h1>
        <p class="feedback__lead enter" style="--delay: 120ms">
          Une idée de recette, une amélioration du site, un souci rencontré ? Écrivez-le ici : Yona lit chaque message
        </p>
      </header>

      @if (sent()) {
        <div class="feedback__sent" role="status">
          <svg yonaIcon="circle-check" [size]="28"></svg>
          <div>
            <p class="feedback__sent-title">Merci, votre message est bien arrivé</p>
            <p>{{ email() ? 'Une réponse vous sera envoyée à l’adresse donnée' : 'Il sera lu très bientôt' }}</p>
            <a yonaButton variant="secondary" [routerLink]="recipesPath">Retour aux recettes</a>
          </div>
        </div>
      } @else {
        <form class="feedback__form enter" style="--delay: 180ms" (submit)="send($event)">
          <div class="feedback__field">
            <label class="feedback__label" for="feedback-message">Votre message</label>
            <textarea
              id="feedback-message"
              class="feedback__input"
              rows="7"
              required
              [maxLength]="maxMessageLength"
              [value]="message()"
              (input)="message.set($any($event.target).value)"
            ></textarea>
            <span class="feedback__hint">{{ message().length }} / {{ maxMessageLength }} caractères</span>
          </div>
          <div class="feedback__field">
            <label class="feedback__label" for="feedback-email">Votre e-mail (facultatif)</label>
            <input
              id="feedback-email"
              class="feedback__input"
              type="email"
              autocomplete="email"
              maxlength="200"
              [value]="email()"
              (input)="email.set($any($event.target).value)"
            />
            <span class="feedback__hint">Seulement si vous souhaitez une réponse</span>
          </div>
          <!-- Hidden from people, filled by robots: their message is set aside -->
          <div class="feedback__trap" aria-hidden="true">
            <label for="feedback-website">Site web</label>
            <input id="feedback-website" tabindex="-1" autocomplete="off" [value]="website()" (input)="website.set($any($event.target).value)" />
          </div>
          <div class="feedback__captcha">
            <div #captchaBox></div>
            @if (!captchaShown()) {
              <button yonaButton variant="secondary" type="button" [disabled]="loadingCaptcha()" (click)="showCaptcha()">
                {{ loadingCaptcha() ? 'Chargement…' : 'Je ne suis pas un robot' }}
              </button>
              <span class="feedback__hint">Vérification par Google reCAPTCHA : elle ne se charge qu'après votre clic</span>
            }
          </div>
          @if (error(); as text) {
            <p class="feedback__error" role="alert"><svg yonaIcon="circle-alert" [size]="18"></svg>{{ text }}</p>
          }
          <div class="feedback__actions">
            <button yonaButton type="submit" [disabled]="!canSend()">
              <svg yonaIcon="send"></svg>{{ sending() ? 'Envoi…' : 'Envoyer' }}
            </button>
          </div>
          <p class="feedback__hint">
            Votre message et votre e-mail ne servent qu'à vous répondre, et sont effacés au bout de 12 mois au plus. Voir la
            <a [routerLink]="privacyPolicyPath">politique de confidentialité</a> et les
            <a [routerLink]="termsOfUsePath">conditions d'utilisation</a>
          </p>
        </form>
      }
    </section>
  `,
  styleUrl: './feedback.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Feedback {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly colorScheme = inject(ColorScheme);

  protected readonly maxMessageLength = MAX_MESSAGE_LENGTH;
  protected readonly recipesPath = RECIPES_PATH;
  protected readonly privacyPolicyPath = PRIVACY_POLICY_PATH;
  protected readonly termsOfUsePath = TERMS_OF_USE_PATH;
  protected readonly message = signal('');
  protected readonly email = signal('');
  protected readonly website = signal('');
  protected readonly sending = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly captchaShown = signal(false);
  protected readonly loadingCaptcha = signal(false);
  /** The answer of the checkbox, sent with the message. */
  private readonly captchaToken = signal<string | null>(null);
  protected readonly canSend = computed(() => !this.sending() && this.captchaToken() !== null && this.message().trim().length > 0);
  private readonly captchaBox = viewChild<ElementRef<HTMLElement>>('captchaBox');
  private recaptcha: Recaptcha | null = null;
  private captchaWidget = 0;
  /** The page the visitor came from, to know what the message is about. */
  private readonly fromPage = this.previousUrl();

  protected async showCaptcha(): Promise<void> {
    this.loadingCaptcha.set(true);
    this.error.set(null);
    try {
      const { siteKey } = await this.api.invoke(getFeedbackCaptcha);
      this.recaptcha = await loadRecaptcha(this.document);
      const view = this.document.defaultView!;
      const preference = this.colorScheme.preference();
      const dark = preference === 'auto' ? view.matchMedia('(prefers-color-scheme: dark)').matches : preference === 'dark';
      this.captchaWidget = this.recaptcha.render(this.captchaBox()!.nativeElement, {
        sitekey: siteKey,
        theme: dark ? 'dark' : 'light',
        // The normal widget is 304 px wide: too much for the smallest phones
        size: view.innerWidth < 360 ? 'compact' : 'normal',
        callback: (token) => this.captchaToken.set(token),
        'expired-callback': () => this.captchaToken.set(null),
        'error-callback': () => this.captchaToken.set(null),
      });
      this.captchaShown.set(true);
    } catch {
      this.error.set('La vérification Google n’a pas pu se charger : vérifiez votre connexion ou votre bloqueur de publicités, puis réessayez');
    } finally {
      this.loadingCaptcha.set(false);
    }
  }

  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canSend()) {
      return;
    }
    this.sending.set(true);
    this.error.set(null);
    try {
      await this.api.invoke(sendFeedback, {
        body: {
          message: this.message().trim(),
          email: this.email().trim() || undefined,
          page: this.fromPage ?? undefined,
          website: this.website() || undefined,
          captchaToken: this.captchaToken() ?? undefined,
        },
      });
      this.sent.set(true);
    } catch (error) {
      // Google accepts an answer once: the box is to be ticked again
      this.captchaToken.set(null);
      this.recaptcha?.reset(this.captchaWidget);
      // This endpoint answers text: the problem arrives as a string
      const problem = error instanceof HttpErrorResponse && typeof error.error === 'string' ? safeParse(error.error) : null;
      const detail = (problem as { detail?: string } | null)?.detail;
      this.error.set(detail ?? 'Le message n’a pas pu être envoyé : vérifiez votre connexion et réessayez');
    } finally {
      this.sending.set(false);
    }
  }

  private previousUrl(): string | null {
    const navigation = this.router.currentNavigation() ?? this.router.lastSuccessfulNavigation();
    const previous = navigation?.previousNavigation?.finalUrl;
    return previous ? this.router.serializeUrl(previous).slice(0, 300) : null;
  }
}
