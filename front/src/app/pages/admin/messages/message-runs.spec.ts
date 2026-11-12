import { describe, expect, it } from 'vitest';
import { AdminMessage } from '../../../core/api/generated/models/admin-message';
import { sameRun } from './admin-messages';

function message(id: number, authorEmail: string, sentAt: string): AdminMessage {
  return { id, groupId: 1, authorEmail, body: 'Bonjour', sentAt, photos: [] } as unknown as AdminMessage;
}

describe('sameRun', () => {
  const first = message(1, 'lea@site.fr', '2026-11-12T10:00:00Z');

  it('joins the messages of one author a few minutes apart', () => {
    expect(sameRun(first, message(2, 'Lea@Site.fr', '2026-11-12T10:04:00Z'))).toBe(true);
  });

  it('starts again with another author, after a pause, or at "Nouveaux"', () => {
    expect(sameRun(first, message(2, 'yona@site.fr', '2026-11-12T10:01:00Z'))).toBe(false);
    expect(sameRun(first, message(2, 'lea@site.fr', '2026-11-12T10:06:00Z'))).toBe(false);
    expect(sameRun(first, message(2, 'lea@site.fr', '2026-11-12T10:01:00Z'), 2)).toBe(false);
  });

  it('has nothing to join at the ends of the conversation', () => {
    expect(sameRun(undefined, first)).toBe(false);
    expect(sameRun(first, undefined)).toBe(false);
  });
});
