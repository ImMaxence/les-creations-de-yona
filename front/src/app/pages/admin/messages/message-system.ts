import { AdminMessage } from '../../../core/api/generated/models/admin-message';

/** What a member changed in a group (2.13), written in its conversation as a line of its own. */
export type GroupEvent = NonNullable<AdminMessage['event']>;

/** Who did it, or whom it concerns: their first name, or the one reading. */
export interface Who {
  name: string;
  me: boolean;
}

/**
 * A line of the group as the one reading it says it, as a chat does: "Léa a ajouté Sam", "Vous avez
 * renommé le groupe « Atelier »", "Léa vous a ajouté". {@code value}: the name given (created, renamed);
 * {@code target}: the member added or removed.
 */
export function systemLine(event: GroupEvent, actor: Who, value?: string | null, target?: Who | null): string {
  const did = (what: string) => (actor.me ? `Vous avez ${what}` : `${actor.name} a ${what}`);
  switch (event) {
    case 'CREATED':
      return did(`créé le groupe « ${value ?? ''} »`);
    case 'RENAMED':
      return did(`renommé le groupe « ${value ?? ''} »`);
    case 'PHOTO_CHANGED':
      return did('changé la photo du groupe');
    case 'PHOTO_REMOVED':
      return did('retiré la photo du groupe');
    case 'ADDED':
      return target?.me ? `${actor.name} vous a ajouté` : did(`ajouté ${target?.name ?? value ?? ''}`);
    case 'REMOVED':
      return target?.me ? `${actor.name} vous a retiré` : did(`retiré ${target?.name ?? value ?? ''}`);
    case 'LEFT':
      return did('quitté le groupe');
  }
}
