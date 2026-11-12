import { describe, expect, it } from 'vitest';
import { AdminMessage } from '../../../core/api/generated/models/admin-message';
import { seenBy, seenLabel, seenPlaces } from './message-seen';

const me = 'yona@site.fr';
const lea = 'lea@site.fr';
const sam = 'sam@site.fr';

function message(id: number, authorEmail: string, minute: number): AdminMessage {
  return { id, groupId: 1, authorEmail, body: 'Bonjour', sentAt: `2026-11-12T10:${String(minute).padStart(2, '0')}:00Z`, photos: [] } as unknown as AdminMessage;
}

const thread = [message(1, lea, 0), message(2, me, 1), message(3, me, 2), message(4, sam, 3), message(5, me, 4)];
const at = (minute: number, seconds = 30) => `2026-11-12T10:${String(minute).padStart(2, '0')}:${seconds}Z`;

describe('seenPlaces', () => {
  it('puts each member under the last message they have seen', () => {
    const places = seenPlaces(thread, [lea, sam], [{ email: 'Lea@site.fr', seenAt: at(2) }, { email: sam, seenAt: at(4) }]);
    expect([...places]).toEqual([
      [3, [lea]],
      [5, [sam]],
    ]);
  });

  it('counts writing as reading what came before, and never under their own message', () => {
    // Sam never opened the group but wrote at 10:03: he has seen up to there, his own message, so no place
    expect(seenPlaces(thread, [sam], []).size).toBe(0);
    // Léa read at 10:01:30, then nothing: under message 2
    expect([...seenPlaces(thread, [lea], [{ email: lea, seenAt: at(1) }])]).toEqual([[2, [lea]]]);
  });

  it('leaves out a member who saw nothing of what is read here', () => {
    expect(seenPlaces(thread.slice(1), [lea], [{ email: lea, seenAt: '2026-11-12T09:00:00Z' }]).size).toBe(0);
  });
});

describe('seenLabel', () => {
  it('says it as Instagram does', () => {
    expect(seenLabel([], 1)).toBe('Envoyé');
    expect(seenLabel(['Léa'], 1)).toBe('Vu');
    expect(seenLabel(['Léa'], 3)).toBe('Vu par Léa');
    expect(seenLabel(['Léa', 'Sam'], 3)).toBe('Vu par Léa et Sam');
    expect(seenLabel(['Léa', 'Sam', 'Tom'], 3)).toBe('Vu par tout le monde');
  });

  it('counts the others beyond two', () => {
    expect(seenBy(['Léa', 'Sam', 'Tom'])).toBe('Vu par Léa, Sam et 1 autre');
    expect(seenBy(['Léa', 'Sam', 'Tom', 'Zoé'])).toBe('Vu par Léa, Sam et 2 autres');
  });
});
