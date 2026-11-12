import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { previewMessageLink } from '../../../core/api/generated/fn/admin-messages/preview-message-link';
import { searchMentions } from '../../../core/api/generated/fn/admin-messages/search-mentions';
import { sendAdminMessage } from '../../../core/api/generated/fn/admin-messages/send-admin-message';
import { uploadMessagePhoto } from '../../../core/api/generated/fn/admin-messages/upload-message-photo';
import { AdminMessage } from '../../../core/api/generated/models/admin-message';
import { LinkPage } from '../../../core/api/generated/models/link-page';
import { Mention } from '../../../core/api/generated/models/mention';
import { MessagePhoto } from '../../../core/api/generated/models/message-photo';
import { ImageUploads } from '../../../core/api/image-uploads';
import { Toaster } from '../../../core/notifications/toaster';
import { Button } from '../../../shared/ui/button/button';
import { Floating } from '../../../shared/ui/floating/floating';
import { Icon } from '../../../shared/ui/icon/icon';
import { AdminLive } from '../layout/admin-live';
import { MENTION_KINDS, MessageMention, firstLink, mentionLabel, mentionQuery, shownLink, withMentions } from './message-format';
import { imageFiles, linkDraftImage, sendablePhoto } from './message-photos';

/** Characters typed in a message (its mentions written in, the backend takes 3,000). */
const MAX_TYPED = 2000;

/** As the backend: 10 photos in a message. */
const MAX_PHOTOS = 10;

/** Waits after a key before asking what "@" offers. */
const MENTION_DELAY_MS = 120;

/** Waits after the last key before reading the page of a link. */
const LINK_DELAY_MS = 700;

/** "est en train d'écrire…" told again while typing, at most this often. */
const TYPING_EVERY_MS = 2500;

/** A photo chosen for the message: shown at once, sent to the API meanwhile. */
interface Attachment {
  key: number;
  preview: string;
  /** Share sent, 0 to 1; null once done or failed. */
  progress: number | null;
  photo: MessagePhoto | null;
  failed: boolean;
}

let nextKey = 1;

/**
 * The field of a conversation: text, "@" to mention a thing of the site, photos (the paperclip, or
 * pasted, or dropped on the conversation), and the preview of the first link written, as on a phone
 * (its "×" sends the message without it). Entrée sends. While typing, the other members are told
 * "est en train d'écrire…" (AdminLive). A text left in a group is found again when coming back to it.
 */
@Component({
  selector: 'yona-message-composer',
  imports: [Button, Floating, Icon],
  templateUrl: './message-composer.html',
  styleUrl: './message-composer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageComposer {
  private readonly api = inject(Api);
  private readonly imageUploads = inject(ImageUploads);
  private readonly toaster = inject(Toaster);
  private readonly live = inject(AdminLive);

  /** The group written in. */
  readonly group = input.required<number>();
  readonly sent = output<AdminMessage>();

  protected readonly kinds = MENTION_KINDS;
  protected readonly maxTyped = MAX_TYPED;
  protected readonly shownLink = shownLink;
  protected readonly linkDraftImage = linkDraftImage;

  protected readonly text = signal('');
  protected readonly sending = signal(false);
  protected readonly attachments = signal<Attachment[]>([]);
  protected readonly uploading = computed(() => this.attachments().some((attachment) => attachment.progress !== null));
  protected readonly canSend = computed(
    () => !this.sending() && !this.uploading() && (!!this.text().trim() || this.attachments().some((attachment) => attachment.photo)),
  );
  /** The mentions chosen in the field, written in the text when it is sent (see withMentions). */
  private mentions: MessageMention[] = [];
  /** What was being written in each group, found again when coming back to it. */
  private readonly drafts = new Map<number, { text: string; mentions: MessageMention[] }>();
  private shownGroup: number | null = null;

  /** "@…" being typed: where it starts in the field, and what follows it. */
  private readonly typingMention = signal<{ start: number; query: string } | null>(null);
  protected readonly suggestions = signal<Mention[]>([]);
  protected readonly active = signal(0);
  protected readonly suggesting = computed(() => !!this.typingMention() && this.suggestions().length > 0);
  private suggestionRun = 0;
  private suggestionTimer: ReturnType<typeof setTimeout> | undefined;

  /** The first link written, and the page read for it; the one whose preview was taken off. */
  private readonly link = computed(() => firstLink(this.text()));
  protected readonly linkPage = signal<{ url: string; page: LinkPage } | null>(null);
  private readonly dismissed = signal<string | null>(null);
  protected readonly shownPage = computed(() => {
    const read = this.linkPage();
    return read && read.url === this.link() && read.url !== this.dismissed() ? read.page : null;
  });
  private linkTimer: ReturnType<typeof setTimeout> | undefined;
  private lastTyping = 0;

  private readonly field = viewChild<ElementRef<HTMLTextAreaElement>>('field');

  constructor() {
    // Another group: the text of this one kept for later, the other's found again
    effect(() => {
      const group = this.group();
      untracked(() => this.switchTo(group));
    });
    // The page of the first link, read a moment after the last key
    effect(() => {
      const url = this.link();
      untracked(() => {
        clearTimeout(this.linkTimer);
        if (!url || url === this.dismissed() || this.linkPage()?.url === url) {
          return;
        }
        this.linkTimer = setTimeout(async () => {
          const page = await this.api.invoke(previewMessageLink, { url }).catch(() => null);
          if (page && this.link() === url) {
            this.linkPage.set({ url, page });
          }
        }, LINK_DELAY_MS);
      });
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.linkTimer);
      clearTimeout(this.suggestionTimer);
      this.attachments().forEach((attachment) => URL.revokeObjectURL(attachment.preview));
    });
  }

  focus(): void {
    this.field()?.nativeElement.focus();
  }

  protected percent(share: number): number {
    return Math.round(share * 100);
  }

  private switchTo(group: number): void {
    if (this.shownGroup !== null) {
      this.drafts.set(this.shownGroup, { text: this.text(), mentions: this.mentions });
    }
    this.shownGroup = group;
    const draft = this.drafts.get(group);
    this.text.set(draft?.text ?? '');
    this.mentions = draft?.mentions ?? [];
    this.closeSuggestions();
    this.clearAttachments();
    this.dismissed.set(null);
  }

  protected async send(): Promise<void> {
    if (!this.canSend()) {
      return;
    }
    const body = withMentions(this.text().trim(), this.mentions);
    const photos = this.attachments().flatMap((attachment) => (attachment.photo ? [attachment.photo] : []));
    const link = firstLink(body);
    this.sending.set(true);
    const sent = await attempt(
      this.api.invoke(sendAdminMessage, {
        body: { groupId: this.group(), body, photos, withoutPreview: !!link && link === this.dismissed() },
      }),
    );
    this.sending.set(false);
    if (sent.ok) {
      this.text.set('');
      this.mentions = [];
      this.drafts.delete(this.group());
      this.clearAttachments();
      this.dismissed.set(null);
      this.linkPage.set(null);
      this.closeSuggestions();
      this.lastTyping = 0;
      this.sent.emit(sent.value);
      this.focus();
    }
  }

  /** "×" on the preview: the message goes without it. */
  protected dismissPreview(): void {
    this.dismissed.set(this.link());
    this.focus();
  }

  // Photos

  protected onFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    void this.addFiles([...(input.files ?? [])]);
    input.value = '';
  }

  protected onPaste(event: ClipboardEvent): void {
    const files = imageFiles(event.clipboardData);
    if (files.length) {
      event.preventDefault();
      void this.addFiles(files);
    }
  }

  /** Photos chosen, pasted or dropped: shown at once, sent to the API one after the other. */
  async addFiles(files: File[]): Promise<void> {
    const room = MAX_PHOTOS - this.attachments().length;
    if (files.length > room) {
      this.toaster.error(`Un message compte ${MAX_PHOTOS} photos au plus`);
    }
    for (const chosen of files.slice(0, Math.max(0, room))) {
      const file = await sendablePhoto(chosen);
      if (!file) {
        this.toaster.error('Cette photo ne peut pas être lue : choisissez une photo JPEG ou PNG');
        continue;
      }
      const attachment: Attachment = { key: nextKey++, preview: URL.createObjectURL(file), progress: 0, photo: null, failed: false };
      this.attachments.update((attachments) => [...attachments, attachment]);
      void this.upload(attachment.key, file);
    }
  }

  private async upload(key: number, file: File): Promise<void> {
    const sent = await attempt(
      this.imageUploads.send<MessagePhoto>(uploadMessagePhoto.PATH, file, (share) => this.patchAttachment(key, { progress: share }), 'POST'),
    );
    this.patchAttachment(key, sent.ok ? { progress: null, photo: sent.value } : { progress: null, failed: true });
  }

  private patchAttachment(key: number, changes: Partial<Attachment>): void {
    this.attachments.update((attachments) => attachments.map((attachment) => (attachment.key === key ? { ...attachment, ...changes } : attachment)));
  }

  protected removeAttachment(key: number): void {
    const removed = this.attachments().find((attachment) => attachment.key === key);
    if (removed) {
      URL.revokeObjectURL(removed.preview);
    }
    this.attachments.update((attachments) => attachments.filter((attachment) => attachment.key !== key));
  }

  private clearAttachments(): void {
    this.attachments().forEach((attachment) => URL.revokeObjectURL(attachment.preview));
    this.attachments.set([]);
  }

  // The field: Entrée sends, "@" looks for a thing of the site

  protected onInput(event: Event): void {
    const field = event.target as HTMLTextAreaElement;
    this.text.set(field.value);
    if (field.value.trim() && Date.now() - this.lastTyping > TYPING_EVERY_MS) {
      this.lastTyping = Date.now();
      this.live.typing(this.group());
    }
    const typing = mentionQuery(field.value.slice(0, field.selectionStart));
    this.typingMention.set(typing);
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
    const typing = this.typingMention();
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
    this.typingMention.set(null);
    this.suggestions.set([]);
  }
}
