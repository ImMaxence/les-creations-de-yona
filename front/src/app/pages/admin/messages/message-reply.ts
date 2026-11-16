import { RepliedMessage } from '../../../core/api/generated/models/replied-message';

/** Someone of a reply, as the one reading says it: their first name, or "vous". */
export interface ReplyPerson {
  name: string;
  me: boolean;
}

/**
 * Above a reply, as on Instagram: "Vous avez répondu à Léa", "Léa vous a répondu", "Léa a répondu à
 * Sam", "Léa a répondu à son message", "Vous avez répondu à votre message".
 */
export function replyLabel(author: ReplyPerson, answered: ReplyPerson, sameEmail: boolean): string {
  if (sameEmail) {
    return author.me ? 'Vous avez répondu à votre message' : `${author.name} a répondu à son message`;
  }
  if (author.me) {
    return `Vous avez répondu à ${answered.name}`;
  }
  return answered.me ? `${author.name} vous a répondu` : `${author.name} a répondu à ${answered.name}`;
}

/** What the quote shows of the message answered: the start of its text, or its photos. */
export function quoteText(quote: Pick<RepliedMessage, 'text' | 'photos'>): string {
  if (quote.text) {
    return quote.text;
  }
  return quote.photos > 1 ? `${quote.photos} photos` : 'Une photo';
}

/** A swipe to the right this far (in pixels) answers the message, as on Instagram; the bubble follows up to SWIPE_MAX. */
export const SWIPE_TO_REPLY = 56;
export const SWIPE_MAX = 80;

/** The bubble's shift for a finger moved by dx: to the right only, slower past the threshold. */
export function swipeShift(dx: number): number {
  if (dx <= 0) {
    return 0;
  }
  return dx <= SWIPE_TO_REPLY ? dx : Math.min(SWIPE_MAX, SWIPE_TO_REPLY + (dx - SWIPE_TO_REPLY) / 3);
}
