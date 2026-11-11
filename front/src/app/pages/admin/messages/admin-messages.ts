import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { countUnseenMessages } from '../../../core/api/generated/fn/admin-messages/count-unseen-messages';
import { deleteAdminMessage } from '../../../core/api/generated/fn/admin-messages/delete-admin-message';
import { listAdminMessages } from '../../../core/api/generated/fn/admin-messages/list-admin-messages';
import { listMessageMembers } from '../../../core/api/generated/fn/admin-messages/list-message-members';
import { searchMentions } from '../../../core/api/generated/fn/admin-messages/search-mentions';
import { sendAdminMessage } from '../../../core/api/generated/fn/admin-messages/send-admin-message';
import { AdminMessage } from '../../../core/api/generated/models/admin-message';
import { Mention } from '../../../core/api/generated/models/mention';
import { AdminSession } from '../../../core/auth/admin-session';
import { Confirm } from '../../../core/dialog/confirm';
import { firstOfMonth, parisClock } from '../../../shared/format/paris-time';
import { Button } from '../../../shared/ui/button/button';
import { Floating } from '../../../shared/ui/floating/floating';
import { Icon } from '../../../shared/ui/icon/icon';
import { Skeleton } from '../../../shared/ui/skeleton/skeleton';
import { AdminAvatar } from '../layout/admin-avatar/admin-avatar';
import { AdminLive } from '../layout/admin-live';
import { AdminWatch } from '../layout/admin-watch';
import { MENTION_KINDS, MessageMention, MessagePart, mentionLabel, mentionQuery, parseMessage, withMentions } from './message-format';

const PAGE_SIZE = 50;

/** Characters typed in a message (its mentions written in, the backend takes 3,000). */
const MAX_TYPED = 2000;

/** Waits after a key before asking what "@" offers. */
const MENTION_DELAY_MS = 120;

const PARIS_DAY = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' });
const PARIS_LONG_DAY = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' });

interface ShownMessage {
  message: AdminMessage;
  parts: MessagePart[];
  mine: boolean;
  author: string;
}

interface Day {
  key: string;
  label: string;
  messages: ShownMessage[];
}

/**
 * "Messages": the admins write to each other, all of them in one group. Text, and "@" to mention a
 * recipe, an article, an order… shown as a link to it. The latest at the bottom, like a conversation;
 * what another admin writes shows at once (AdminLive). Kept 90 days, and in the backups.
 */
@Component({
  selector: 'yona-admin-messages',
  imports: [AdminAvatar, Button, Floating, Icon, RouterLink, Skeleton],
  templateUrl: './admin-messages.html',
  styleUrl: './admin-messages.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminMessages {
  private readonly api = inject(Api);
  private readonly session = inject(AdminSession);
  private readonly watch = inject(AdminWatch);
  private readonly confirm = inject(Confirm);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  protected readonly kinds = MENTION_KINDS;
  protected readonly maxTyped = MAX_TYPED;
  protected readonly members = resource({ loader: () => this.api.invoke(listMessageMembers) });
  /** The oldest first, as read. */
  private readonly messages = signal<AdminMessage[]>([]);
  protected readonly hasOlder = signal(false);
  protected readonly loading = signal(true);
  protected readonly loadingOlder = signal(false);
  /** The last visit: what the others wrote after it is new. Null until known. */
  private readonly since = signal<string | null>(null);

  protected readonly text = signal('');
  protected readonly sending = signal(false);
  /** The mentions chosen in the field, written in the text when it is sent (see withMentions). */
  private mentions: MessageMention[] = [];
  /** "@…" being typed: where it starts in the field, and what follows it. */
  private readonly typing = signal<{ start: number; query: string } | null>(null);
  protected readonly suggestions = signal<Mention[]>([]);
  protected readonly active = signal(0);
  protected readonly suggesting = computed(() => !!this.typing() && this.suggestions().length > 0);
  private suggestionRun = 0;
  private suggestionTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly thread = viewChild<ElementRef<HTMLElement>>('thread');
  private readonly field = viewChild<ElementRef<HTMLTextAreaElement>>('field');

  /** By day in Paris, "Aujourd'hui", "Hier", then "Lundi 9 novembre". */
  protected readonly days = computed<Day[]>(() => {
    const today = PARIS_DAY.format(new Date());
    const yesterday = PARIS_DAY.format(new Date(Date.now() - 86_400_000));
    const days: Day[] = [];
    for (const message of this.messages()) {
      const key = PARIS_DAY.format(new Date(message.sentAt));
      let day = days.at(-1);
      if (day?.key !== key) {
        const long = firstOfMonth(PARIS_LONG_DAY.format(new Date(message.sentAt)));
        day = { key, label: key === today ? 'Aujourd’hui' : key === yesterday ? 'Hier' : long.charAt(0).toUpperCase() + long.slice(1), messages: [] };
        days.push(day);
      }
      const mine = this.isMine(message.authorEmail);
      day.messages.push({ message, parts: parseMessage(message.body), mine, author: mine ? 'Vous' : (message.authorName ?? message.authorEmail) });
    }
    return days;
  });
  /** The first message of the others since the last visit: "Nouveaux" above it. */
  protected readonly firstNew = computed(() => {
    const since = this.since();
    return since ? this.messages().find((message) => !this.isMine(message.authorEmail) && Date.parse(message.sentAt) > Date.parse(since))?.id : undefined;
  });

  constructor() {
    void this.start();
    // Another admin wrote, or deleted a message: the latest ones read again, and seen while the page is in sight
    inject(AdminLive).on('MESSAGES', () => {
      void this.refresh();
      if (this.document.visibilityState === 'visible') {
        void this.watch.messagesSeen();
      }
    });
  }

  protected isMine(email: string): boolean {
    return email.toLowerCase() === this.session.admin()?.email?.toLowerCase();
  }

  protected clock(sentAt: string): string {
    return parisClock(new Date(sentAt));
  }

  /** Read before being marked seen: the messages new at this visit stay so until the next one. */
  private async start(): Promise<void> {
    const [unseen] = await Promise.all([attempt(this.api.invoke(countUnseenMessages)), this.loadLatest()]);
    if (unseen.ok) {
      this.since.set(unseen.value.since);
    }
    await this.watch.messagesSeen();
  }

  private async loadLatest(): Promise<void> {
    const page = await attempt(this.api.invoke(listAdminMessages, { size: PAGE_SIZE }));
    this.loading.set(false);
    if (page.ok) {
      this.messages.set([...page.value.messages].reverse());
      this.hasOlder.set(page.value.hasOlder);
      this.scrollToEnd();
    }
  }

  /** The latest ones again, the older ones read before kept; followed at the bottom if it was there. */
  private async refresh(): Promise<void> {
    const box = this.thread()?.nativeElement;
    const atEnd = !box || box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    const page = await attempt(this.api.invoke(listAdminMessages, { size: PAGE_SIZE }));
    if (!page.ok) {
      return;
    }
    const latest = [...page.value.messages].reverse();
    const oldestLatest = latest[0]?.id ?? Number.MAX_SAFE_INTEGER;
    this.messages.update((shown) => [...shown.filter((message) => message.id < oldestLatest), ...latest]);
    if (!latest.length) {
      this.messages.set([]);
    }
    if (atEnd) {
      this.scrollToEnd();
    }
  }

  protected async loadOlder(): Promise<void> {
    const oldest = this.messages()[0];
    const box = this.thread()?.nativeElement;
    if (!oldest || this.loadingOlder()) {
      return;
    }
    this.loadingOlder.set(true);
    const height = box?.scrollHeight ?? 0;
    const page = await attempt(this.api.invoke(listAdminMessages, { before: oldest.id, size: PAGE_SIZE }));
    this.loadingOlder.set(false);
    if (page.ok) {
      this.messages.update((shown) => [...[...page.value.messages].reverse(), ...shown]);
      this.hasOlder.set(page.value.hasOlder);
      // The message read stays in place, the older ones above it
      afterNextRender(() => box && (box.scrollTop += box.scrollHeight - height), { injector: this.injector });
    }
  }

  protected async send(): Promise<void> {
    const body = withMentions(this.text().trim(), this.mentions);
    if (!body || this.sending()) {
      return;
    }
    this.sending.set(true);
    const sent = await attempt(this.api.invoke(sendAdminMessage, { body: { body } }));
    this.sending.set(false);
    if (sent.ok) {
      this.messages.update((shown) => (shown.some((message) => message.id === sent.value.id) ? shown : [...shown, sent.value]));
      this.text.set('');
      this.mentions = [];
      this.closeSuggestions();
      this.scrollToEnd();
      this.field()?.nativeElement.focus();
    }
  }

  protected async remove(message: AdminMessage): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Supprimer ce message ?',
      message: 'Il disparaît pour tous les admins',
      confirmLabel: 'Supprimer',
    });
    if (confirmed && (await attempt(this.api.invoke(deleteAdminMessage, { id: message.id }))).ok) {
      this.messages.update((shown) => shown.filter((other) => other.id !== message.id));
    }
  }

  // The field: Entrée sends, "@" looks for a thing of the site

  protected onInput(event: Event): void {
    const field = event.target as HTMLTextAreaElement;
    this.text.set(field.value);
    const typing = mentionQuery(field.value.slice(0, field.selectionStart));
    this.typing.set(typing);
    clearTimeout(this.suggestionTimer);
    if (!typing) {
      this.suggestions.set([]);
      return;
    }
    const run = ++this.suggestionRun;
    this.suggestionTimer = setTimeout(async () => {
      const found = await this.api.invoke(searchMentions, { q: typing.query }).catch(() => []);
      if (run === this.suggestionRun) {
        this.suggestions.set(found);
        this.active.set(0);
      }
    }, MENTION_DELAY_MS);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.suggesting()) {
      const last = this.suggestions().length - 1;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        this.active.update((index) => Math.min(last, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1))));
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        this.choose(this.suggestions()[this.active()]!);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeSuggestions();
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      void this.send();
    }
  }

  /** "@tar" becomes "@Tarte au citron ", remembered to be written as a mention when sent. */
  protected choose(mention: Mention): void {
    const field = this.field()?.nativeElement;
    const typing = this.typing();
    if (!field || !typing) {
      return;
    }
    const label = mentionLabel(mention.label);
    const value = field.value;
    const cursor = field.selectionStart;
    const next = `${value.slice(0, typing.start)}@${label} ${value.slice(cursor)}`;
    this.text.set(next);
    field.value = next;
    const caret = typing.start + label.length + 2;
    field.setSelectionRange(caret, caret);
    this.mentions.push({ kind: mention.kind, id: mention.id, label });
    this.closeSuggestions();
    field.focus();
  }

  protected closeSuggestions(): void {
    clearTimeout(this.suggestionTimer);
    this.suggestionRun++;
    this.typing.set(null);
    this.suggestions.set([]);
  }

  private scrollToEnd(): void {
    afterNextRender(
      () => {
        const box = this.thread()?.nativeElement;
        if (box) {
          box.scrollTop = box.scrollHeight;
        }
      },
      { injector: this.injector },
    );
  }
}
