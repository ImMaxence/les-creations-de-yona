import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { deleteAdminMessage } from '../../../core/api/generated/fn/admin-messages/delete-admin-message';
import { listAdminMessages } from '../../../core/api/generated/fn/admin-messages/list-admin-messages';
import { listMessageGroups } from '../../../core/api/generated/fn/admin-messages/list-message-groups';
import { listMessageMembers } from '../../../core/api/generated/fn/admin-messages/list-message-members';
import { listMessageTypists } from '../../../core/api/generated/fn/admin-messages/list-message-typists';
import { AdminMessage } from '../../../core/api/generated/models/admin-message';
import { GroupMember } from '../../../core/api/generated/models/group-member';
import { MessageGroup } from '../../../core/api/generated/models/message-group';
import { AdminSession } from '../../../core/auth/admin-session';
import { Confirm } from '../../../core/dialog/confirm';
import { firstOfMonth, parisClock } from '../../../shared/format/paris-time';
import { Icon } from '../../../shared/ui/icon/icon';
import { PhotoViewer, ViewedPhoto } from '../../../shared/ui/photo-viewer/photo-viewer';
import { Skeleton } from '../../../shared/ui/skeleton/skeleton';
import { AdminAvatar } from '../layout/admin-avatar/admin-avatar';
import { AdminLive, Typing } from '../layout/admin-live';
import { AdminWatch } from '../layout/admin-watch';
import { GroupDialog } from './group-dialog';
import { LinkCard } from './link-card';
import { MessageComposer } from './message-composer';
import { MENTION_KINDS, MessagePart, parseMessage, shownLink } from './message-format';
import { imageFiles, messagePhoto } from './message-photos';
import { MessageSound } from './message-sound';

const PAGE_SIZE = 50;

/**
 * Messages kept in the page at most: back at the end of a long conversation read far back, only the
 * latest are kept (the older ones are read again by scrolling up). The API gives them 50 at a time.
 */
const KEPT_AT_MOST = 300;
const KEPT_AFTER_TRIM = 150;

/** The older messages are read before the top of the conversation is reached. */
const OLDER_AHEAD = '600px 0px 0px 0px';

/** "est en train d'écrire…" stays this long after the last word of it. */
const TYPING_SHOWN_MS = 5000;

/** The width from which the groups and the conversation show side by side (md). */
const SIDE_BY_SIDE = '(min-width: 48rem)';

const PARIS_DAY = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' });
const PARIS_LONG_DAY = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' });
const PARIS_SHORT_DAY = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short' });

interface ShownMessage {
  message: AdminMessage;
  parts: MessagePart[];
  mine: boolean;
  author: string;
  /** Only a web address, its card below: the text is not repeated, as on a phone. */
  onlyLink: boolean;
  /** Starts a run of the same author (sameRun): the name and the time above it. */
  first: boolean;
  /** Ends it: the face beside it. */
  last: boolean;
}

/** A few minutes between two messages of the same author: still one run. */
const RUN_GAP_MS = 5 * 60_000;

/**
 * Two messages one after the other as one run, as on a phone: the same author, a few minutes apart,
 * no "Nouveaux" between them. The name shows once, the bubbles are joined.
 */
export function sameRun(before: AdminMessage | undefined, after: AdminMessage | undefined, firstNew?: number): boolean {
  return (
    !!before &&
    !!after &&
    after.id !== firstNew &&
    before.authorEmail.toLowerCase() === after.authorEmail.toLowerCase() &&
    Date.parse(after.sentAt) - Date.parse(before.sentAt) < RUN_GAP_MS
  );
}

interface Day {
  key: string;
  label: string;
  messages: ShownMessage[];
}

/** Someone writing, until a moment after their last word. */
interface Typist extends Typing {
  timer: ReturnType<typeof setTimeout>;
}

/**
 * "Messages": the admins write to each other in groups, the group of all of them first made. A group
 * has a name, a photo and its members, any of whom may change them. Text, "@" to mention a recipe, an
 * article, an order… (a link to it), photos, and the preview of a link, as on a phone. The latest at
 * the bottom; what another member writes shows at once, and so does "est en train d'écrire…"
 * (AdminLive). On a phone, the groups first, then the one opened (?groupe=). Kept 90 days, and in the backups.
 */
@Component({
  selector: 'yona-admin-messages',
  imports: [AdminAvatar, GroupDialog, Icon, LinkCard, MessageComposer, PhotoViewer, RouterLink, Skeleton],
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
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly kinds = MENTION_KINDS;
  protected readonly messagePhoto = messagePhoto;
  protected readonly shownLink = shownLink;
  private readonly live = inject(AdminLive);
  protected readonly sound = inject(MessageSound);
  protected readonly bigPhoto = (imageId: string) => messagePhoto(imageId, 1600);

  protected readonly admins = resource({ loader: () => this.api.invoke(listMessageMembers) });
  private readonly adminsByEmail = computed(() => new Map((this.admins.value() ?? []).map((admin) => [admin.email, admin])));
  protected readonly me = computed(() => this.session.admin()?.email?.toLowerCase() ?? '');

  /** The groups of this admin, the latest written in first; null until read. */
  protected readonly groups = signal<MessageGroup[] | null>(null);
  /** ?groupe=12: the one opened (on a phone, the conversation in place of the list). */
  private readonly asked = toSignal(this.route.queryParamMap.pipe(map((params) => Number(params.get('groupe')) || null)), {
    initialValue: Number(this.route.snapshot.queryParamMap.get('groupe')) || null,
  });
  protected readonly reading = computed(() => this.asked() !== null);
  protected readonly selected = computed(() => {
    const groups = this.groups() ?? [];
    return groups.find((group) => group.id === this.asked()) ?? groups.find((group) => group.everyone) ?? groups[0] ?? null;
  });

  /** The oldest first, as read, of the group open. */
  private readonly messages = signal<AdminMessage[]>([]);
  protected readonly hasOlder = signal(false);
  protected readonly loading = signal(true);
  protected readonly loadingOlder = signal(false);
  /** The last visit of the group open: what the others wrote after it is new. */
  private readonly since = signal<string | null>(null);
  private openGroup: number | null = null;

  protected readonly typists = signal<Typist[]>([]);
  protected readonly groupDialogOpen = signal(false);
  protected readonly editing = signal<MessageGroup | null>(null);
  protected readonly viewed = signal<ViewedPhoto[]>([]);
  protected readonly dropping = signal(false);

  private readonly thread = viewChild<ElementRef<HTMLElement>>('thread');
  private readonly older = viewChild<ElementRef<HTMLElement>>('older');
  /** The top of the conversation near: the older messages are read, again while it stays near. */
  private olderNear = false;
  private readonly threadContent = viewChild<ElementRef<HTMLElement>>('threadContent');
  /** At the end of the conversation: kept there as it grows. */
  private stickToEnd = true;
  private readonly composer = viewChild(MessageComposer);
  private readonly viewer = viewChild(PhotoViewer);

  /** By day in Paris, "Aujourd'hui", "Hier", then "Lundi 9 novembre". */
  protected readonly days = computed<Day[]>(() => {
    const today = PARIS_DAY.format(new Date());
    const yesterday = PARIS_DAY.format(new Date(Date.now() - 86_400_000));
    const firstNew = this.firstNew();
    const messages = this.messages();
    const days: Day[] = [];
    messages.forEach((message, i) => {
      const key = PARIS_DAY.format(new Date(message.sentAt));
      let day = days.at(-1);
      if (day?.key !== key) {
        const long = firstOfMonth(PARIS_LONG_DAY.format(new Date(message.sentAt)));
        day = { key, label: key === today ? 'Aujourd’hui' : key === yesterday ? 'Hier' : long.charAt(0).toUpperCase() + long.slice(1), messages: [] };
        days.push(day);
      }
      const mine = this.isMine(message.authorEmail);
      const parts = parseMessage(message.body);
      const onlyLink = !!message.link && parts.filter((part) => part.link || part.mention || part.text?.trim()).length === 1 && !!parts.find((part) => part.link);
      // A run stops at the end of a day too
      const next = messages[i + 1];
      const nextSameDay = next && PARIS_DAY.format(new Date(next.sentAt)) === key ? next : undefined;
      day.messages.push({
        message,
        parts,
        mine,
        author: mine ? 'Vous' : this.nameOf(message.authorEmail, message.authorName),
        onlyLink,
        first: !day.messages.length || !sameRun(messages[i - 1], message, firstNew),
        last: !sameRun(message, nextSameDay, firstNew),
      });
    });
    return days;
  });
  /** Sent or come since the conversation was opened: they pop up as they appear (not the ones read with it, nor the older ones). */
  protected readonly arrived = signal<ReadonlySet<number>>(new Set());
  /** The first message of the others since the last visit: "Nouveaux" above it. */
  protected readonly firstNew = computed(() => {
    const since = this.since();
    return since ? this.messages().find((message) => !this.isMine(message.authorEmail) && Date.parse(message.sentAt) > Date.parse(since))?.id : undefined;
  });
  /** "Yona est en train d'écrire…" in the group open. */
  protected readonly typingLabel = computed(() => typingLabel(this.typists().filter((typist) => typist.group === this.selected()?.id)));

  constructor() {
    void this.loadGroups();
    // Another group opened: its messages read, then marked seen
    effect(() => {
      const group = this.selected();
      if (group && group.id !== untracked(() => this.openGroup)) {
        untracked(() => void this.open(group));
      }
    });
    // A member wrote, deleted a message, or changed a group: the groups and the conversation read again.
    // The WebSocket cut, told every few seconds anyway: who writes is asked then too
    this.live.on('MESSAGES', () => {
      void this.loadGroups();
      void this.refresh();
      if (!this.live.connected()) {
        void this.askTypists();
      }
    });
    this.live.onTyping((typing) => this.onTyping(typing));
    // Scrolled up near the top: the older messages read, the place kept
    effect((onCleanup) => {
      const older = this.older()?.nativeElement;
      const box = this.thread()?.nativeElement;
      if (!older || !box || typeof IntersectionObserver === 'undefined') {
        return;
      }
      const observer = new IntersectionObserver(
        ([entry]) => {
          this.olderNear = !!entry?.isIntersecting;
          if (this.olderNear) {
            void this.loadOlder();
          }
        },
        { root: box, rootMargin: OLDER_AHEAD },
      );
      observer.observe(older);
      onCleanup(() => observer.disconnect());
    });
    // A photo, a preview or a font loaded after the scroll to the end: still at the end
    effect((onCleanup) => {
      const content = this.threadContent()?.nativeElement;
      if (!content || typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(() => {
        const box = this.thread()?.nativeElement;
        if (box && this.stickToEnd) {
          box.scrollTop = box.scrollHeight;
        }
      });
      observer.observe(content);
      onCleanup(() => observer.disconnect());
    });
    inject(DestroyRef).onDestroy(() => this.typists().forEach((typist) => clearTimeout(typist.timer)));
  }

  protected isMine(email: string): boolean {
    return email.toLowerCase() === this.me();
  }

  /** Their Google name as known, or their email. */
  protected nameOf(email: string, name?: string | null): string {
    return name || this.adminsByEmail().get(email.toLowerCase())?.name || email;
  }

  protected admin(email: string): GroupMember | undefined {
    return this.adminsByEmail().get(email);
  }

  protected clock(sentAt: string): string {
    return parisClock(new Date(sentAt));
  }

  /** "14:05" today, "Hier", then "9 nov.". */
  protected when(sentAt: string): string {
    const day = PARIS_DAY.format(new Date(sentAt));
    if (day === PARIS_DAY.format(new Date())) {
      return this.clock(sentAt);
    }
    return day === PARIS_DAY.format(new Date(Date.now() - 86_400_000)) ? 'Hier' : PARIS_SHORT_DAY.format(new Date(sentAt));
  }

  /** Under a group's name: "Yona : C'est prêt", "Vous : 2 photos", or who writes now. */
  protected lastLine(group: MessageGroup): string {
    const typing = typingLabel(this.typists().filter((typist) => typist.group === group.id), true);
    if (typing) {
      return typing;
    }
    const last = group.last;
    if (!last) {
      return 'Aucun message pour le moment';
    }
    const author = this.isMine(last.authorEmail) ? 'Vous' : this.nameOf(last.authorEmail, last.authorName).split(' ')[0];
    const text = last.text || (last.photos > 1 ? `${last.photos} photos` : 'Une photo');
    return `${author} : ${text}`;
  }

  protected isTypingIn(group: MessageGroup): boolean {
    return this.typists().some((typist) => typist.group === group.id);
  }

  /** "Yona, Maxence et vous", the group of all saying so. */
  protected membersLine(group: MessageGroup): string {
    const others = group.members.filter((email) => email !== this.me()).map((email) => this.nameOf(email).split(' ')[0]!);
    const names = [...others, 'vous'];
    const line = names.length > 1 ? `${names.slice(0, -1).join(', ')} et ${names.at(-1)}` : names[0]!;
    return group.everyone ? `Tous les admins : ${line}` : line.charAt(0).toUpperCase() + line.slice(1);
  }

  protected groupPhoto(group: MessageGroup): string | null {
    return group.imageId ? messagePhoto(group.imageId) : null;
  }

  // Groups

  private async loadGroups(): Promise<void> {
    const groups = await attempt(this.api.invoke(listMessageGroups));
    if (groups.ok) {
      this.groups.set(groups.value);
    }
  }

  protected choose(group: MessageGroup): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { groupe: group.id } });
  }

  /** Phones: back to the groups. */
  protected backToGroups(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  protected newGroup(): void {
    this.editing.set(null);
    this.groupDialogOpen.set(true);
  }

  protected editGroup(group: MessageGroup): void {
    this.editing.set(group);
    this.groupDialogOpen.set(true);
  }

  protected onGroupSaved(group: MessageGroup): void {
    this.groups.update((groups) => [group, ...(groups ?? []).filter((other) => other.id !== group.id)]);
    this.choose(group);
  }

  protected onGroupGone(id: number): void {
    this.groups.update((groups) => (groups ?? []).filter((group) => group.id !== id));
    this.openGroup = null;
    this.backToGroups();
  }

  // The conversation

  /** Read before being marked seen: the messages new at this visit stay so until the next one. */
  private async open(group: MessageGroup): Promise<void> {
    this.openGroup = group.id;
    this.since.set(group.since);
    this.arrived.set(new Set());
    this.messages.set([]);
    this.hasOlder.set(false);
    this.loading.set(true);
    const page = await attempt(this.api.invoke(listAdminMessages, { group: group.id, size: PAGE_SIZE }));
    if (this.openGroup !== group.id) {
      return;
    }
    this.loading.set(false);
    if (page.ok) {
      this.messages.set([...page.value.messages].reverse());
      this.hasOlder.set(page.value.hasOlder);
      this.scrollToEnd();
    }
    this.markSeen();
  }

  /** In sight: the page shown, and the conversation too (beside the groups, or opened on a phone). */
  private markSeen(): void {
    const group = this.openGroup;
    const inSight = this.reading() || (typeof matchMedia !== 'undefined' && matchMedia(SIDE_BY_SIDE).matches);
    if (group === null || this.document.visibilityState !== 'visible' || !inSight) {
      return;
    }
    this.groups.update((groups) => groups?.map((other) => (other.id === group ? { ...other, unseen: 0 } : other)) ?? null);
    void this.watch.messagesSeen(group);
  }

  /** The latest ones again, the older ones read before kept; followed at the bottom if it was there. */
  private async refresh(): Promise<void> {
    const group = this.openGroup;
    if (group === null) {
      return;
    }
    const box = this.thread()?.nativeElement;
    const atEnd = !box || box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    const page = await attempt(this.api.invoke(listAdminMessages, { group, size: PAGE_SIZE }));
    if (!page.ok || this.openGroup !== group) {
      return;
    }
    const latest = [...page.value.messages].reverse();
    const known = new Set(this.messages().map((message) => message.id));
    // Who just wrote is no longer writing
    const arrived = latest.filter((message) => !known.has(message.id));
    arrived.forEach((message) => this.stopTyping(group, message.authorEmail.toLowerCase()));
    // In the conversation open too, read at once (its badge never grows): its little sound
    if (known.size && arrived.some((message) => !this.isMine(message.authorEmail))) {
      this.sound.play();
    }
    if (known.size && arrived.length) {
      this.markArrived(arrived.map((message) => message.id));
    }
    const oldestLatest = latest[0]?.id ?? Number.MAX_SAFE_INTEGER;
    this.messages.update((shown) => (latest.length ? [...shown.filter((message) => message.id < oldestLatest), ...latest] : []));
    if (atEnd) {
      this.scrollToEnd();
      this.keepLatest();
    }
    if (arrived.length || this.selected()?.unseen) {
      this.markSeen();
    }
  }

  /** The WebSocket cut: who writes in the group open, asked with the messages. */
  private async askTypists(): Promise<void> {
    const group = this.openGroup;
    if (group === null) {
      return;
    }
    const typists = await attempt(this.api.invoke(listMessageTypists, { group }));
    if (typists.ok && this.openGroup === group) {
      typists.value.forEach((typist) => this.onTyping({ group, email: typist.email, name: typist.name ?? null }));
    }
  }

  protected async loadOlder(): Promise<void> {
    const oldest = this.messages()[0];
    const group = this.openGroup;
    const box = this.thread()?.nativeElement;
    if (!oldest || group === null || this.loadingOlder()) {
      return;
    }
    this.loadingOlder.set(true);
    const height = box?.scrollHeight ?? 0;
    const page = await attempt(this.api.invoke(listAdminMessages, { group, before: oldest.id, size: PAGE_SIZE }));
    this.loadingOlder.set(false);
    if (page.ok && this.openGroup === group) {
      this.messages.update((shown) => [...[...page.value.messages].reverse(), ...shown]);
      this.hasOlder.set(page.value.hasOlder);
      // The message read stays in place, the older ones above it; still near the top (a short page), the next ones
      afterNextRender(
        () => {
          if (box) {
            box.scrollTop += box.scrollHeight - height;
          }
          if (this.olderNear && this.hasOlder()) {
            void this.loadOlder();
          }
        },
        { injector: this.injector },
      );
    }
  }

  /** At the end of a long conversation: the latest messages only, the older ones read again by scrolling up. */
  private keepLatest(): void {
    if (this.stickToEnd && this.messages().length > KEPT_AT_MOST) {
      this.messages.update((shown) => shown.slice(-KEPT_AFTER_TRIM));
      this.hasOlder.set(true);
    }
  }

  protected onSent(message: AdminMessage): void {
    if (message.groupId !== this.openGroup) {
      return;
    }
    if (!this.messages().some((other) => other.id === message.id)) {
      this.markArrived([message.id]);
      this.messages.update((shown) => [...shown, message]);
    }
    this.scrollToEnd();
    this.keepLatest();
  }

  private markArrived(ids: number[]): void {
    this.arrived.update((arrived) => new Set([...arrived, ...ids]));
  }

  protected async remove(message: AdminMessage): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Supprimer ce message ?',
      message: message.photos.length ? 'Il disparaît pour tous les membres du groupe, avec ses photos' : 'Il disparaît pour tous les membres du groupe',
      confirmLabel: 'Supprimer',
    });
    if (confirmed && (await attempt(this.api.invoke(deleteAdminMessage, { id: message.id }))).ok) {
      this.messages.update((shown) => shown.filter((other) => other.id !== message.id));
    }
  }

  protected openPhoto(message: AdminMessage, index: number): void {
    this.viewed.set(message.photos.map((photo, position) => ({ imageId: photo.id, alt: `Photo ${position + 1} de ${message.photos.length}` })));
    afterNextRender(() => this.viewer()?.open(index), { injector: this.injector });
  }

  // Photos dropped on the conversation

  protected onDragOver(event: DragEvent): void {
    if (event.dataTransfer?.types.includes('Files')) {
      event.preventDefault();
      this.dropping.set(true);
    }
  }

  protected onDrop(event: DragEvent): void {
    this.dropping.set(false);
    const files = imageFiles(event.dataTransfer);
    if (files.length) {
      event.preventDefault();
      void this.composer()?.addFiles(files);
    }
  }

  // "est en train d'écrire…"

  private onTyping(typing: Typing): void {
    if (this.isMine(typing.email)) {
      return;
    }
    const email = typing.email.toLowerCase();
    this.stopTyping(typing.group, email);
    const timer = setTimeout(() => this.stopTyping(typing.group, email), TYPING_SHOWN_MS);
    this.typists.update((typists) => [...typists, { ...typing, email, timer }]);
  }

  private stopTyping(group: number, email: string): void {
    const gone = this.typists().find((typist) => typist.group === group && typist.email === email);
    if (gone) {
      clearTimeout(gone.timer);
      this.typists.update((typists) => typists.filter((typist) => typist !== gone));
    }
  }

  /** Read back to the earlier messages: no longer kept at the end. */
  protected onThreadScroll(): void {
    const box = this.thread()?.nativeElement;
    if (box) {
      const wasAtEnd = this.stickToEnd;
      this.stickToEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
      if (this.stickToEnd && !wasAtEnd) {
        this.keepLatest();
      }
    }
  }

  private scrollToEnd(): void {
    this.stickToEnd = true;
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

/**
 * "Yona est en train d'écrire…", "Yona et Léa sont en train d'écrire…", "3 personnes sont en train
 * d'écrire…"; short, in the list of the groups: "Yona écrit…", "3 personnes écrivent…".
 */
export function typingLabel(typists: readonly Typing[], short = false): string | null {
  const names = typists.map((typist) => (typist.name || typist.email).split(' ')[0]!);
  if (!names.length) {
    return null;
  }
  if (names.length === 1) {
    return short ? `${names[0]} écrit…` : `${names[0]} est en train d’écrire…`;
  }
  const who = names.length === 2 ? `${names[0]} et ${names[1]}` : `${names.length} personnes`;
  return short ? `${who} écrivent…` : `${who} sont en train d’écrire…`;
}
