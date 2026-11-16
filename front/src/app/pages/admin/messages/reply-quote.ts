import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';
import { Icon } from '../../../shared/ui/icon/icon';

/** A reply's quote, as the conversation shows it. */
export interface ShownReply {
  id: number;
  /** "Vous avez répondu à Léa" (message-reply.ts). */
  label: string;
  text: string;
  /** Its first photo's address, or null. */
  photo: string | null;
}

/**
 * Above a reply, as on Instagram: who answered whom, then the message answered, paler, the reply's
 * bubble over its bottom ("joined"); a tap goes back to it (the page scrolls to it).
 */
@Component({
  selector: 'yona-reply-quote',
  imports: [Icon],
  template: `
    <span class="label"><svg yonaIcon="reply" [size]="12"></svg>{{ reply().label }}</span>
    <button type="button" class="quote" [attr.aria-label]="reply().label + ' : ' + reply().text + '. Voir ce message'" (click)="go.emit(reply().id)">
      <span class="quote__text">{{ reply().text }}</span>
      @if (reply().photo; as photo) {
        <img class="quote__photo" [src]="photo" alt="" loading="lazy" />
      }
    </button>
  `,
  styleUrl: './reply-quote.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-joined]': 'joined()' },
})
export class ReplyQuote {
  readonly reply = input.required<ShownReply>();
  /** The reply's bubble right under it, over its bottom. */
  readonly joined = input(false, { transform: booleanAttribute });
  readonly go = output<number>();
}
