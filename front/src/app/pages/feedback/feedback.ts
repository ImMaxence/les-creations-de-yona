import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api/generated/api';
import { sendFeedback } from '../../core/api/generated/fn/feedback/send-feedback';
import { PRIVACY_POLICY_PATH, RECIPES_PATH } from '../../shared/routing/links';
import { Button } from '../../shared/ui/button/button';
import { Icon } from '../../shared/ui/icon/icon';

const MAX_MESSAGE_LENGTH = 2000;

/**
 * "Donner mon avis": a message to Yona, an idea, a problem met on the site. Read in the back-office
 * ("Retours"); the email is optional, only to get an answer. A field hidden from people catches the
 * robots, without a captcha.
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
            <a [routerLink]="privacyPolicyPath">politique de confidentialité</a>
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

  protected readonly maxMessageLength = MAX_MESSAGE_LENGTH;
  protected readonly recipesPath = RECIPES_PATH;
  protected readonly privacyPolicyPath = PRIVACY_POLICY_PATH;
  protected readonly message = signal('');
  protected readonly email = signal('');
  protected readonly website = signal('');
  protected readonly sending = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly canSend = computed(() => !this.sending() && this.message().trim().length > 0);
  /** The page the visitor came from, to know what the message is about. */
  private readonly fromPage = this.previousUrl();

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
        },
      });
      this.sent.set(true);
    } catch (error) {
      const detail = error instanceof HttpErrorResponse ? (error.error as { detail?: string } | null)?.detail : null;
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
