import { IconName } from '../../../shared/ui/icon/icons';

/** What a message may mention (fr.lescreationsdeyona.message.MentionKind). */
export type MentionKind = 'RECIPE' | 'CAP_ENTRY' | 'MENU' | 'CATEGORY' | 'TAG' | 'INGREDIENT' | 'GLOSSARY_TERM' | 'SHOP_PRODUCT' | 'SHOP_ORDER';

export interface MessageMention {
  kind: MentionKind;
  id: number;
  label: string;
}

/** A piece of a message: text as typed, a mention shown as a link, or a web address. */
export type MessagePart =
  | { text: string; mention?: never; link?: never }
  | { mention: MessageMention; text?: never; link?: never }
  | { link: string; text?: never; mention?: never };

/** How each kind is shown, and where its link leads in the back-office. */
export const MENTION_KINDS: Record<MentionKind, { name: string; icon: IconName; link: (id: number) => (string | number)[] }> = {
  RECIPE: { name: 'Recette', icon: 'book-open', link: (id) => ['/admin/recettes', id] },
  CAP_ENTRY: { name: 'Article', icon: 'graduation-cap', link: (id) => ['/admin/mon-cap', id] },
  MENU: { name: 'Menu', icon: 'list', link: () => ['/admin/menus'] },
  CATEGORY: { name: 'Catégorie', icon: 'tags', link: () => ['/admin/categories'] },
  TAG: { name: 'Tag', icon: 'tag', link: () => ['/admin/tags'] },
  INGREDIENT: { name: 'Ingrédient', icon: 'carrot', link: () => ['/admin/ingredients'] },
  GLOSSARY_TERM: { name: 'Glossaire', icon: 'book-a', link: () => ['/admin/glossaire'] },
  SHOP_PRODUCT: { name: 'Produit', icon: 'store', link: () => ['/admin/boutique/produits'] },
  SHOP_ORDER: { name: 'Commande', icon: 'package', link: (id) => ['/admin/boutique/commandes', id] },
};

const KINDS = Object.keys(MENTION_KINDS).join('|');

/** @[Tarte au citron](RECIPE:12): as a mention is written in the text of a message. */
const TOKEN = new RegExp(`@\\[([^\\[\\]\\n]{1,200})\\]\\((${KINDS}):(\\d{1,18})\\)`, 'g');

/** A web address as typed, up to the next space (fr.lescreationsdeyona.message.MessageTexts). */
const LINK = /https?:\/\/[^\s<>"]+/gi;

const TRAILING = '.,;:!?…»”’\'"';

/** The text, the mentions and the web addresses of a message, in order; an unknown kind stays text. */
export function parseMessage(body: string): MessagePart[] {
  const parts: MessagePart[] = [];
  let last = 0;
  for (const match of body.matchAll(TOKEN)) {
    if (match.index > last) {
      parts.push(...withLinks(body.slice(last, match.index)));
    }
    parts.push({ mention: { label: match[1]!, kind: match[2] as MentionKind, id: Number(match[3]) } });
    last = match.index + match[0].length;
  }
  if (last < body.length) {
    parts.push(...withLinks(body.slice(last)));
  }
  return parts;
}

function withLinks(text: string): MessagePart[] {
  const parts: MessagePart[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const link = trimLink(match[0]);
    if (match.index > last) {
      parts.push({ text: text.slice(last, match.index) });
    }
    parts.push({ link });
    last = match.index + link.length;
  }
  if (last < text.length) {
    parts.push({ text: text.slice(last) });
  }
  return parts;
}

/** The first web address of a message, mentions left aside: the one the server reads for its preview. */
export function firstLink(body: string): string | null {
  return parseMessage(body).find((part) => part.link)?.link ?? null;
}

/** "https://site.fr/page)." → "https://site.fr/page"; a closing bracket kept when the address opens one. */
export function trimLink(link: string): string {
  let trimmed = link;
  for (;;) {
    const last = trimmed.at(-1);
    const count = (char: string) => [...trimmed].filter((other) => other === char).length;
    const unbalanced =
      last === ')' ? count('(') < count(')') : last === ']' ? count('[') < count(']') : !!last && TRAILING.includes(last);
    if (!unbalanced) {
      return trimmed;
    }
    trimmed = trimmed.slice(0, -1);
  }
}

/** "marmiton.org/recettes/tarte…": a web address as a message shows it, shorter. */
export function shownLink(link: string): string {
  const shown = link.replace(/^https?:\/\/(www\.)?/i, '');
  return shown.length > 60 ? `${shown.slice(0, 57)}…` : shown;
}

/** The text of a message as read in a notification or a list: "@Tarte au citron". */
export function plainMessage(body: string): string {
  return body.replace(TOKEN, (_, label: string) => `@${label}`);
}

/**
 * What is typed after "@" just before the cursor, the name of a thing being looked for; null when the
 * cursor is not in such a word. A name may hold spaces ("@tarte au"), not a new line nor another "@".
 */
export function mentionQuery(beforeCursor: string): { start: number; query: string } | null {
  const match = /(^|[\s(])@([^@\n]{0,40})$/.exec(beforeCursor);
  if (!match) {
    return null;
  }
  return { start: match.index + match[1]!.length, query: match[2]! };
}

/** The name shown in the field once chosen: its brackets would end the mention early. */
export function mentionLabel(label: string): string {
  return label.replace(/[[\]\n]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * The field shows "@Tarte au citron": each mention chosen and still there, in the order chosen, takes
 * its written form @[Tarte au citron](RECIPE:12). One removed or changed by hand stays plain text.
 */
export function withMentions(text: string, mentions: readonly MessageMention[]): string {
  let body = text;
  for (const mention of mentions) {
    const shown = `@${mentionLabel(mention.label)}`;
    const at = findShown(body, shown);
    if (at >= 0) {
      body = `${body.slice(0, at)}@[${mentionLabel(mention.label)}](${mention.kind}:${mention.id})${body.slice(at + shown.length)}`;
    }
  }
  return body;
}

/** "@Tarte au citron" as typed, not inside a mention already written, nor the start of a longer word. */
function findShown(body: string, shown: string): number {
  let from = 0;
  for (;;) {
    const at = body.indexOf(shown, from);
    if (at < 0) {
      return -1;
    }
    const next = body.charAt(at + shown.length);
    if (!/[\p{L}\p{N}]/u.test(next)) {
      return at;
    }
    from = at + 1;
  }
}
