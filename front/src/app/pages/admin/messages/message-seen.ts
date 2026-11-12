import { AdminMessage } from '../../../core/api/generated/models/admin-message';

/** Up to when a member read the group (GroupSeen of the API). */
export interface SeenUpTo {
  email: string;
  seenAt: string;
}

/**
 * Where the "Vu" of each other member goes, as on Instagram: under the last message they have seen.
 * Writing is reading what came before: a member who wrote after their last visit has seen up to their
 * message. None under their own message, nor for a message out of the ones read here (older). Message
 * id → the emails of its readers, in the order of the members.
 */
export function seenPlaces(messages: readonly AdminMessage[], others: readonly string[], seen: readonly SeenUpTo[]): Map<number, string[]> {
  const places = new Map<number, string[]>();
  for (const member of others) {
    const email = member.toLowerCase();
    const upTo = readUpTo(messages, email, seen);
    // The oldest first: the last one sent before then
    let place: AdminMessage | undefined;
    for (const message of messages) {
      if (Date.parse(message.sentAt) > upTo) {
        break;
      }
      place = message;
    }
    if (place && place.authorEmail.toLowerCase() !== email) {
      places.set(place.id, [...(places.get(place.id) ?? []), email]);
    }
  }
  return places;
}

/** Until when a member has read the group (ms): their last visit, or their own last message if later. */
export function readUpTo(messages: readonly AdminMessage[], member: string, seen: readonly SeenUpTo[]): number {
  const email = member.toLowerCase();
  const visit = seen.find((one) => one.email.toLowerCase() === email);
  let upTo = visit ? Date.parse(visit.seenAt) : Number.NEGATIVE_INFINITY;
  for (const message of messages) {
    if (message.authorEmail.toLowerCase() === email) {
      upTo = Math.max(upTo, Date.parse(message.sentAt));
    }
  }
  return upTo;
}

/** Under one's own last message: "Envoyé", then "Vu" (a group of two), "Vu par Léa et Sam", "Vu par tout le monde". */
export function seenLabel(names: readonly string[], others: number): string {
  if (!names.length) {
    return 'Envoyé';
  }
  if (others === 1) {
    return 'Vu';
  }
  return names.length >= others ? 'Vu par tout le monde' : seenBy(names);
}

/** "Vu par Léa", "Vu par Léa et Sam", "Vu par Léa, Sam et 2 autres". */
export function seenBy(names: readonly string[]): string {
  if (names.length <= 2) {
    return `Vu par ${names.join(' et ')}`;
  }
  const rest = names.length - 2;
  return `Vu par ${names[0]}, ${names[1]} et ${rest} ${rest > 1 ? 'autres' : 'autre'}`;
}
