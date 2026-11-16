import { describe, expect, it } from 'vitest';
import { SWIPE_MAX, SWIPE_TO_REPLY, quoteText, replyLabel, swipeShift } from './message-reply';

const me = { name: 'Vous', me: true };
const lea = { name: 'Léa', me: false };
const sam = { name: 'Sam', me: false };

describe('replyLabel', () => {
  it('says who answered whom, as the one reading says it', () => {
    expect(replyLabel(me, lea, false)).toBe('Vous avez répondu à Léa');
    expect(replyLabel(lea, me, false)).toBe('Léa vous a répondu');
    expect(replyLabel(lea, sam, false)).toBe('Léa a répondu à Sam');
  });

  it('says an answer to one’s own message', () => {
    expect(replyLabel(me, me, true)).toBe('Vous avez répondu à votre message');
    expect(replyLabel(lea, lea, true)).toBe('Léa a répondu à son message');
  });
});

describe('quoteText', () => {
  it('quotes the text, or the photos of a message without text', () => {
    expect(quoteText({ text: 'On fait la tarte ?', photos: 1 })).toBe('On fait la tarte ?');
    expect(quoteText({ text: '', photos: 1 })).toBe('Une photo');
    expect(quoteText({ text: '', photos: 3 })).toBe('3 photos');
  });
});

describe('swipeShift', () => {
  it('follows the finger to the right only, slower past the threshold, up to a maximum', () => {
    expect(swipeShift(-30)).toBe(0);
    expect(swipeShift(20)).toBe(20);
    expect(swipeShift(SWIPE_TO_REPLY)).toBe(SWIPE_TO_REPLY);
    expect(swipeShift(SWIPE_TO_REPLY + 12)).toBe(SWIPE_TO_REPLY + 4);
    expect(swipeShift(500)).toBe(SWIPE_MAX);
  });
});
