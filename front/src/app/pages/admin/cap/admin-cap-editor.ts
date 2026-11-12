import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, Injector, computed, effect, inject, resource, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { uploadImage } from '../../../core/api/generated/fn/admin-images/upload-image';
import { createCapEntry } from '../../../core/api/generated/fn/admin-mon-cap/create-cap-entry';
import { deleteCapEntry } from '../../../core/api/generated/fn/admin-mon-cap/delete-cap-entry';
import { duplicateCapEntry } from '../../../core/api/generated/fn/admin-mon-cap/duplicate-cap-entry';
import { listAdminCapEntries } from '../../../core/api/generated/fn/admin-mon-cap/list-admin-cap-entries';
import { getAdminCapEntry } from '../../../core/api/generated/fn/admin-mon-cap/get-admin-cap-entry';
import { updateCapEntry } from '../../../core/api/generated/fn/admin-mon-cap/update-cap-entry';
import { getCapAiStatus } from '../../../core/api/generated/fn/admin-mon-cap-ai/get-cap-ai-status';
import { AdminCapEntry } from '../../../core/api/generated/models/admin-cap-entry';
import { CapAiDraft } from '../../../core/api/generated/models/cap-ai-draft';
import { CapBlock } from '../../../core/api/generated/models/cap-block';
import { CapEntryForm } from '../../../core/api/generated/models/cap-entry-form';
import { GalleryImage } from '../../../core/api/generated/models/gallery-image';
import { ImageUploads } from '../../../core/api/image-uploads';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { SiteData } from '../../../core/site/site-data';
import { fromParisInput, parisDateTime, toParisInput } from '../../../shared/format/paris-time';
import { CAP_PATH } from '../../../shared/routing/links';
import { Button } from '../../../shared/ui/button/button';
import { articleLink, resolveArticleLinks } from '../../../shared/ui/cap-article/article-format';
import { CapArticleContent, CapArticleView } from '../../../shared/ui/cap-article/cap-article-view';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { Icon } from '../../../shared/ui/icon/icon';
import { Segmented } from '../../../shared/ui/segmented/segmented';
import { IconName } from '../../../shared/ui/icon/icons';
import { ImageUpload } from '../../../shared/ui/image-upload/image-upload';
import { Select, SelectOption } from '../../../shared/ui/select/select';
import { EditHistory } from '../edit-history/edit-history';
import { EditorBar } from '../editor-bar/editor-bar';
import { MarkdownTool, MarkdownTools } from '../markdown-tools/markdown-tools';
import { PreviewFrame } from '../preview-frame/preview-frame';
import { ArticleSearch, ChosenArticle } from './article-search';
import { DraftKeeper, KeptDraft, readKeptDraft } from '../kept-draft';
import { RecoveredDraft } from '../recovered-draft';
import { UnsavedChanges } from '../recipe-editor/unsaved-changes.guard';
import { ChosenRecipe, RecipeSearch } from '../recipe-search/recipe-search';
import {
  BLOCK_TYPES,
  BlockType,
  MAX_BLOCKS,
  MAX_STEP_PHOTOS,
  MAX_TIP_LENGTH,
  MIN_STEP_PHOTOS,
  blockLabel,
  emptyBlock,
  slugOf,
  templateOf,
} from './cap-templates';
import { ArticleDraft, isArticleDraft, keptArticleKey } from './article-draft';
import { CapAiForm, formOfTemplate, hasContent, withPhotosKept } from './cap-ai';
import { CapAiDialog } from './cap-ai-dialog';
import { Skeleton } from '../../../shared/ui/skeleton/skeleton';

/** A photo of "Étapes en photos", with a key of its own for the page to follow it when moved. */
interface EditorPhoto {
  key: number;
  imageId?: string;
  caption?: string;
}

/** A block being written. */
interface EditorBlock extends Omit<CapBlock, 'photos'> {
  key: number;
  photos?: EditorPhoto[];
}

/** "Recette" or "Article" in the tools of a text: what its link leads to. */
type LinkKind = 'recipe' | 'article';

const MAX_TEXT_LENGTH = 20000;

/** Today in Paris, as the date field wants it. */
function today(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
}

let nextKey = 1;

/**
 * Writing an article of "Mon CAP" without typing anything technical: the fields at the top, then
 * the blocks one under the other (up, down, duplicate, delete; a "+" between two adds one), laid down
 * by the model chosen. "Aperçu" shows it as it will be online, on a computer and on a phone.
 */
@Component({
  selector: 'yona-admin-cap-editor',
  imports: [
    ArticleSearch,
    Button,
    CapAiDialog,
    CapArticleView,
    Dialog,
    EditorBar,
    Icon,
    ImageUpload,
    MarkdownTools,
    NgTemplateOutlet,
    PreviewFrame,
    RecipeSearch,
    RecoveredDraft,
    RouterLink,
    Segmented,
    Select,
    Skeleton,
  ],
  templateUrl: './admin-cap-editor.html',
  styleUrl: './admin-cap-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'history.onKeydown($event)', '(input)': 'history.onInput($event)' },
})
export default class AdminCapEditor implements UnsavedChanges {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly imageUploads = inject(ImageUploads);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);
  private readonly siteData = inject(SiteData);

  protected readonly capPath = CAP_PATH;
  protected readonly blockTypes = BLOCK_TYPES;
  protected readonly blockLabel = blockLabel;
  protected readonly maxBlocks = MAX_BLOCKS;
  protected readonly maxStepPhotos = MAX_STEP_PHOTOS;
  protected readonly minStepPhotos = MIN_STEP_PHOTOS;
  protected readonly maxTipLength = MAX_TIP_LENGTH;
  protected readonly maxTextLength = MAX_TEXT_LENGTH;
  protected readonly textTools: readonly MarkdownTool[] = ['title', 'bold', 'italic', 'list'];

  /** Null until it is saved for the first time. */
  protected readonly id = signal<number | null>(null);
  protected readonly loading = signal(false);
  protected readonly savedSlug = signal<string | null>(null);
  protected readonly wasPublished = signal(false);
  protected readonly title = signal('');
  protected readonly subtitle = signal('');
  protected readonly date = signal(today());
  protected readonly imageId = signal<string | null>(null);
  protected readonly style = signal<'CLASSIC' | 'NOTEBOOK'>('CLASSIC');
  /** A failed article is shown as a draft: saved, it is one again. */
  protected readonly status = signal<'DRAFT' | 'PUBLISHED'>('DRAFT');
  /** Drafts only: Paris time, as the datetime-local field shows it ("2026-10-31T10:00"); "" for none. */
  protected readonly scheduledAt = signal('');
  /** Its scheduled publication did not happen: when it was planned, and why. */
  protected readonly failure = signal<{ at: string | null; reason: string } | null>(null);
  protected readonly featured = signal(false);
  protected readonly statusOptions: SelectOption<'DRAFT' | 'PUBLISHED'>[] = [
    { value: 'DRAFT', label: 'Brouillon (invisible sur le site)', badge: 'draft' },
    { value: 'PUBLISHED', label: 'Publié', badge: 'published' },
  ];
  /** "samedi 31 octobre à 10:00", the time typed being valid. */
  protected readonly scheduledLabel = computed(() => {
    const at = this.status() === 'DRAFT' ? fromParisInput(this.scheduledAt()) : null;
    return at ? parisDateTime(at) : null;
  });
  protected readonly duplicating = signal(false);
  protected readonly blocks = signal<EditorBlock[]>([]);
  protected readonly saving = signal(false);
  /** Share sent of each photo uploading, by slot ("main", "12", "12-3"). */
  protected readonly uploads = signal<Readonly<Record<string, number>>>({});
  /** Where the "+" menu is open: the index the new block takes; null when closed. */
  protected readonly adding = signal<number | null>(null);
  protected readonly previewOpen = signal(false);
  /** "Lien vers une recette" or "vers un article": the text block it goes in, and where in its text. */
  protected readonly linking = signal<{ kind: LinkKind; key: number; start: number; end: number } | null>(null);
  protected readonly linkedRecipe = signal<ChosenRecipe | null>(null);
  protected readonly linkedArticle = signal<ChosenArticle | null>(null);
  protected readonly linkReady = computed(() => (this.linking()?.kind === 'article' ? !!this.linkedArticle() : !!this.linkedRecipe()));
  /** "Écrire avec l'IA": Gemini greyed out, with the reason, when it cannot work (no key, quota used…). */
  protected readonly aiStatus = resource({ loader: () => this.api.invoke(getCapAiStatus) });
  /** Opened at once when coming from "Écrire avec l'IA" of "Nouvel article". */
  protected readonly aiOpen = signal(this.route.snapshot.queryParamMap.has('ia'));
  /** The shape of the model chosen in "Nouvel article"; the AI's choice for an article already saved. */
  protected readonly aiForm: CapAiForm = formOfTemplate(this.route.snapshot.queryParamMap.get('modele'));
  /** The article was written by the AI and not saved since: a banner asks to check it. */
  protected readonly aiWritten = signal(false);
  /** Why Gemini cannot be used now; null when it can. */
  protected readonly geminiUnavailable = computed(() => {
    const status = this.aiStatus.value();
    if (!status || status.available) {
      return null;
    }
    return status.availableAgainAt ? `${status.reason} (vers ${parisDateTime(status.availableAgainAt)})` : (status.reason ?? '');
  });
  private readonly saved = signal('');
  /** updatedAt of the article as loaded or saved; null while new. */
  protected readonly basedOn = signal<string | null>(null);
  /** An article typed earlier in this browser and never saved, offered back. */
  protected readonly recovered = signal<KeptDraft<ArticleDraft> | null>(null);
  private readonly keeper = new DraftKeeper<ArticleDraft>(
    () => keptArticleKey(this.id()),
    () => (this.hasUnsavedChanges() ? { savedAt: new Date().toISOString(), basedOn: this.basedOn(), draft: this.draft() } : null),
    () => !this.loading() && !this.recovered(),
  );

  /** Its address: made from the title while it is a draft, then kept. */
  protected readonly address = computed(() =>
    `${CAP_PATH}/${this.wasPublished() && this.savedSlug() ? this.savedSlug() : slugOf(this.title())}`,
  );
  /** The articles of the site, for the links to them in the preview: as online, a draft's words stay plain. */
  private readonly articles = resource({ loader: () => this.api.invoke(listAdminCapEntries) });
  private readonly publishedSlugs = computed(
    () => new Map((this.articles.value() ?? []).filter((article) => article.status === 'PUBLISHED').map((article) => [article.id, article.slug])),
  );
  protected readonly previewArticle = computed<CapArticleContent>(() => ({
    title: this.title().trim(),
    subtitle: this.subtitle().trim() || null,
    happenedOn: this.date() || today(),
    imageId: this.imageId(),
    style: this.style(),
    blocks: this.formBlocks().map((block) =>
      block.text ? { ...block, text: resolveArticleLinks(block.text, this.publishedSlugs()) } : block,
    ),
  }));
  private readonly snapshot = computed(() => JSON.stringify(this.form()));
  /** Ctrl+Z and Ctrl+Y: every field of the article and its blocks, their keys kept for the page to keep its fields. */
  private readonly historyState = computed<HistoryState>(() => ({
    title: this.title(),
    subtitle: this.subtitle(),
    date: this.date(),
    imageId: this.imageId(),
    style: this.style(),
    status: this.status(),
    scheduledAt: this.scheduledAt(),
    featured: this.featured(),
    blocks: this.blocks(),
  }));
  protected readonly history = new EditHistory<HistoryState>({
    write: (state) => {
      this.title.set(state.title);
      this.subtitle.set(state.subtitle);
      this.date.set(state.date);
      this.imageId.set(state.imageId);
      this.style.set(state.style);
      this.status.set(state.status);
      this.scheduledAt.set(state.scheduledAt);
      this.featured.set(state.featured);
      this.blocks.set(state.blocks);
    },
    host: () => this.host.nativeElement,
    injector: inject(Injector),
  });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly draftSnapshot = computed(() => JSON.stringify(this.draft()));

  constructor() {
    if (!Number(this.route.snapshot.paramMap.get('id'))) {
      this.blocks.set(templateOf(this.route.snapshot.queryParamMap.get('modele')).blocks().map(toEditor));
      this.saved.set(this.snapshot());
      this.offerKept();
    }
    // Another article in the same page ("Dupliquer" opens the copy): it is loaded in place of this one
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = Number(params.get('id'));
      if (id && id !== this.id()) {
        void this.load(id);
      }
    });
    // Each change kept in this browser shortly after typing, until saved
    effect(() => {
      this.draftSnapshot();
      untracked(() => this.keeper.changed());
    });
    // Each change a step of Ctrl+Z; another article, a history of its own
    effect(() => {
      const state = this.historyState();
      const id = this.id();
      if (!this.loading()) {
        untracked(() => this.history.record(state, id));
      }
    });
  }

  hasUnsavedChanges(): boolean {
    return !this.loading() && this.snapshot() !== this.saved();
  }

  private async load(id: number): Promise<void> {
    this.recovered.set(null);
    this.aiWritten.set(false);
    this.loading.set(true);
    const loaded = await attempt(this.api.invoke(getAdminCapEntry, { id }));
    this.loading.set(false);
    if (loaded.ok) {
      this.fill(loaded.value);
      this.offerKept();
    } else {
      void this.router.navigate(['/admin/mon-cap']);
    }
  }

  private fill(entry: AdminCapEntry): void {
    this.id.set(entry.id);
    this.savedSlug.set(entry.slug);
    this.wasPublished.set(entry.status === 'PUBLISHED');
    this.title.set(entry.title);
    this.subtitle.set(entry.subtitle ?? '');
    this.date.set(entry.happenedOn);
    this.imageId.set(entry.imageId ?? null);
    this.style.set(entry.style);
    this.status.set(entry.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT');
    this.scheduledAt.set(entry.status === 'DRAFT' && entry.scheduledAt ? toParisInput(entry.scheduledAt) : '');
    this.failure.set(
      entry.status === 'FAILED'
        ? { at: entry.scheduledAt ? parisDateTime(entry.scheduledAt) : null, reason: entry.publicationFailure ?? 'La publication programmée n’a pas eu lieu' }
        : null,
    );
    this.featured.set(entry.featured);
    this.blocks.set(entry.blocks.map(toEditor));
    this.basedOn.set(entry.updatedAt);
    this.saved.set(this.snapshot());
    // Saved again: the same article written as the API keeps it, not a step of Ctrl+Z
    this.history.replace(this.historyState());
  }

  // Kept in this browser

  /** On opening: the article as left unsaved here, if it differs from the one shown. */
  private offerKept(): void {
    const kept = readKeptDraft(keptArticleKey(this.id()), isArticleDraft);
    if (kept && JSON.stringify(kept.draft) !== this.draftSnapshot()) {
      this.recovered.set(kept);
    } else {
      this.keeper.forget();
    }
  }

  /** "Reprendre": the article as it was left. */
  protected resumeKept(): void {
    const kept = this.recovered();
    if (!kept) {
      return;
    }
    const { draft } = kept;
    this.title.set(draft.title);
    this.subtitle.set(draft.subtitle);
    this.date.set(draft.date);
    this.imageId.set(draft.imageId);
    this.style.set(draft.style);
    this.status.set(draft.published ? 'PUBLISHED' : 'DRAFT');
    this.scheduledAt.set(draft.published ? '' : (draft.scheduledAt ?? ''));
    this.featured.set(draft.featured);
    this.blocks.set(draft.blocks.map(toEditor));
    this.recovered.set(null);
  }

  /** "Ignorer": the saved article stays, the typed one is forgotten. */
  protected discardKept(): void {
    this.keeper.forget();
    this.recovered.set(null);
  }

  /** The fields as typed, untrimmed: what is kept in this browser. */
  private draft(): ArticleDraft {
    return {
      title: this.title(),
      subtitle: this.subtitle(),
      date: this.date(),
      imageId: this.imageId(),
      style: this.style(),
      published: this.status() === 'PUBLISHED',
      scheduledAt: this.scheduledAt(),
      featured: this.featured(),
      blocks: this.formBlocks(),
    };
  }

  // Blocks

  protected trackBlock(_: number, block: EditorBlock): number {
    return block.key;
  }

  protected patch(key: number, changes: Partial<EditorBlock>): void {
    this.blocks.update((blocks) => blocks.map((block) => (block.key === key ? { ...block, ...changes } : block)));
  }

  protected insert(index: number, type: BlockType): void {
    if (this.blocks().length >= MAX_BLOCKS) {
      this.toaster.error(`Un article compte ${MAX_BLOCKS} blocs au plus`);
      return;
    }
    // A new photo + text goes to the other side of the one before, as in the model "Carnet"
    const before = [...this.blocks().slice(0, index)].reverse().find((block) => block.type === 'IMAGE_TEXT');
    const block = toEditor(emptyBlock(type, before?.side === 'LEFT' ? 'RIGHT' : 'LEFT'));
    this.blocks.update((blocks) => [...blocks.slice(0, index), block, ...blocks.slice(index)]);
    this.adding.set(null);
  }

  protected move(index: number, delta: number): void {
    this.blocks.update((blocks) => {
      const moved = [...blocks];
      const [block] = moved.splice(index, 1);
      moved.splice(index + delta, 0, block!);
      return moved;
    });
  }

  protected duplicate(index: number): void {
    if (this.blocks().length >= MAX_BLOCKS) {
      this.toaster.error(`Un article compte ${MAX_BLOCKS} blocs au plus`);
      return;
    }
    const copy = toEditor(toForm(this.blocks()[index]!));
    this.blocks.update((blocks) => [...blocks.slice(0, index + 1), copy, ...blocks.slice(index + 1)]);
  }

  protected async remove(index: number): Promise<void> {
    const block = this.blocks()[index]!;
    if (!isEmpty(block)) {
      const confirmed = await this.confirm.ask({
        title: 'Supprimer ce bloc ?',
        message: `Le bloc « ${blockLabel(block.type)} » et ce qu'il contient disparaissent de l'article`,
        confirmLabel: 'Supprimer',
      });
      if (!confirmed) {
        return;
      }
    }
    this.blocks.update((blocks) => blocks.filter((other) => other.key !== block.key));
  }

  protected swapSide(block: EditorBlock): void {
    this.patch(block.key, { side: block.side === 'RIGHT' ? 'LEFT' : 'RIGHT' });
  }

  protected addPhoto(block: EditorBlock): void {
    this.patch(block.key, { photos: [...(block.photos ?? []), { key: nextKey++ }] });
  }

  protected removePhoto(block: EditorBlock, photoKey: number): void {
    this.patch(block.key, { photos: (block.photos ?? []).filter((photo) => photo.key !== photoKey) });
  }

  protected patchPhoto(block: EditorBlock, photoKey: number, changes: Partial<EditorPhoto>): void {
    this.patch(block.key, {
      photos: (block.photos ?? []).map((photo) => (photo.key === photoKey ? { ...photo, ...changes } : photo)),
    });
  }

  /** The photo of a step, moved one place. */
  protected movePhoto(block: EditorBlock, index: number, delta: number): void {
    const photos = [...(block.photos ?? [])];
    const [photo] = photos.splice(index, 1);
    photos.splice(index + delta, 0, photo!);
    this.patch(block.key, { photos });
  }

  protected blockIcon(type: BlockType): IconName {
    return BLOCK_TYPES.find((known) => known.type === type)?.icon ?? 'type';
  }

  // Photos: a new one goes to the gallery, then shows where it was chosen

  protected readonly setMain = (imageId: string): void => this.imageId.set(imageId);

  protected setImage(block: EditorBlock): (imageId: string) => void {
    return (imageId) => this.patch(block.key, { imageId });
  }

  /** Read again once sent: the block may have changed meanwhile. */
  protected setStepImage(block: EditorBlock, photoKey: number): (imageId: string) => void {
    return (imageId) => {
      const current = this.blocks().find((other) => other.key === block.key);
      if (current) {
        this.patchPhoto(current, photoKey, { imageId });
      }
    };
  }

  protected uploadOf(slot: string): number | null {
    return this.uploads()[slot] ?? null;
  }

  protected async upload(slot: string, file: File, chosen: (imageId: string) => void): Promise<void> {
    this.uploads.update((uploads) => ({ ...uploads, [slot]: 0 }));
    const sent = await attempt(
      this.imageUploads.send<GalleryImage>(uploadImage.PATH, file, (share) => this.uploads.update((uploads) => ({ ...uploads, [slot]: share })), 'POST'),
    );
    this.uploads.update(({ [slot]: _, ...others }) => others);
    if (sent.ok) {
      chosen(sent.value.id);
    }
  }

  // Links of a text: to a recipe, to an article

  protected openLink(textarea: HTMLTextAreaElement, block: EditorBlock, kind: LinkKind): void {
    this.linkedRecipe.set(null);
    this.linkedArticle.set(null);
    this.linking.set({ kind, key: block.key, start: textarea.selectionStart, end: textarea.selectionEnd });
  }

  /**
   * "[Tarte au citron](/recettes/tartes/tarte-au-citron)", "[Mon examen blanc](article:12)": the words
   * selected link to the recipe or the article chosen; none selected, its title does. An article is
   * linked by its id (2.10.0): its address is read when the page is served, a draft's words staying
   * plain until it is published (resolveArticleLinks), whatever its title becomes meanwhile.
   */
  protected insertLink(): void {
    const target = this.linking();
    const block = this.blocks().find((other) => other.key === target?.key);
    if (!target || !block) {
      return;
    }
    const recipe = this.linkedRecipe();
    const article = this.linkedArticle();
    const chosen =
      target.kind === 'article'
        ? article && { title: article.title, path: articleLink(article.id) }
        : recipe?.slug && recipe.categorySlug ? { title: recipe.title, path: `/recettes/${recipe.categorySlug}/${recipe.slug}` } : null;
    if (!chosen) {
      return;
    }
    const text = block.text ?? '';
    const words = text.slice(target.start, target.end).trim() || chosen.title;
    this.patch(block.key, { text: `${text.slice(0, target.start)}[${words}](${chosen.path})${text.slice(target.end)}` });
    if (target.kind === 'recipe' && recipe && !recipe.published) {
      this.toaster.info('Cette recette n’est pas encore publiée : le lien mènera à une page introuvable d’ici là');
    } else if (target.kind === 'article' && article && !article.published) {
      this.toaster.info('Cet article n’est pas encore publié : sur le site, ces mots deviendront un lien dès sa publication');
    }
    this.linking.set(null);
  }

  // "Écrire avec l'IA"

  /** The title and blocks written by the AI replace those typed, after confirmation; the photos placed stay. */
  protected async writeWithAi(written: CapAiDraft): Promise<void> {
    if (
      hasContent(this.title(), this.subtitle(), this.formBlocks()) &&
      !(await this.confirm.ask({
        title: 'Remplacer le texte de l’article ?',
        message: 'Le titre, le sous-titre et les blocs sont remplacés par ceux de l’IA. Les photos déjà placées restent, aux places prévues pour des photos',
        confirmLabel: 'Remplacer',
      }))
    ) {
      return;
    }
    if (written.title) {
      this.title.set(written.title);
    }
    this.subtitle.set(written.subtitle ?? '');
    this.blocks.set(withPhotosKept(written.blocks, this.formBlocks()).map(toEditor));
    this.aiWritten.set(true);
    this.toaster.success('Article écrit par l’IA : relisez-le et ajoutez les photos avant d’enregistrer');
  }

  // Article

  /** False when nothing was saved: a field missing, or the API refused. */
  protected async save(publishing = false): Promise<boolean> {
    if (!this.title().trim() || !this.date()) {
      this.toaster.error('Donnez un titre et une date à cet article');
      return false;
    }
    if (this.blocks().some((block) => block.type === 'STEPS' && (block.photos ?? []).filter((photo) => photo.imageId).length === 1)) {
      this.toaster.error(`Un bloc « Étapes en photos » compte ${MIN_STEP_PHOTOS} photos au moins`);
      return false;
    }
    if (this.status() === 'DRAFT' && this.scheduledAt() && !fromParisInput(this.scheduledAt())) {
      this.toaster.error('Indiquez le jour et l’heure de la publication programmée, ou retirez-la');
      return false;
    }
    const body = this.form();
    const id = this.id();
    const keptKey = keptArticleKey(id);
    this.saving.set(true);
    const saved = await attempt(id ? this.api.invoke(updateCapEntry, { id, body }) : this.api.invoke(createCapEntry, { body }));
    this.saving.set(false);
    if (!saved.ok) {
      return false;
    }
    this.fill(saved.value);
    // A new article was kept as "nouveau": saved, it has its id
    this.keeper.forget(keptKey);
    this.recovered.set(null);
    this.aiWritten.set(false);
    const scheduled = saved.value.status === 'DRAFT' && saved.value.scheduledAt;
    this.toaster.success(
      publishing
        ? 'Article publié'
        : saved.value.status === 'PUBLISHED'
          ? 'Article enregistré, en ligne'
          : scheduled
            ? `Article programmé : ${parisDateTime(scheduled)}`
            : 'Brouillon enregistré',
    );
    void this.siteData.load();
    if (!id) {
      void this.router.navigate(['/admin/mon-cap', saved.value.id], { replaceUrl: true });
    }
    return true;
  }

  /** "Publier": on the site at once, its scheduled time dropped. */
  protected async publish(): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Publier cet article ?',
      message: 'Il sera visible sur le site, dans Mon CAP',
      confirmLabel: 'Publier',
    });
    if (!confirmed) {
      return;
    }
    const scheduledAt = this.scheduledAt();
    this.status.set('PUBLISHED');
    this.scheduledAt.set('');
    if (!(await this.save(true))) {
      this.status.set('DRAFT');
      this.scheduledAt.set(scheduledAt);
    }
  }

  /** A new draft with the same content as the version saved, opened in its place. */
  protected async duplicateArticle(): Promise<void> {
    const id = this.id();
    if (!id) {
      return;
    }
    if (
      this.hasUnsavedChanges() &&
      !(await this.confirm.ask({
        title: 'Dupliquer la version enregistrée ?',
        message: 'Les modifications pas encore enregistrées ne seront pas dans la copie',
        confirmLabel: 'Dupliquer',
      }))
    ) {
      return;
    }
    this.duplicating.set(true);
    const copy = await attempt(this.api.invoke(duplicateCapEntry, { id }));
    this.duplicating.set(false);
    if (copy.ok) {
      // Already asked: leaving does not ask again
      this.saved.set(this.snapshot());
      this.keeper.forget();
      this.toaster.success(`Copie créée en brouillon : « ${copy.value.title} »`);
      await this.router.navigate(['/admin/mon-cap', copy.value.id]);
    }
  }

  protected async trash(): Promise<void> {
    const id = this.id();
    if (!id) {
      return;
    }
    const confirmed = await this.confirm.ask({
      title: 'Mettre cet article à la corbeille ?',
      message: `« ${this.title()} » disparaît du site et reste 30 jours dans la corbeille, d'où il peut être restauré`,
      confirmLabel: 'Mettre à la corbeille',
    });
    if (confirmed && (await attempt(this.api.invoke(deleteCapEntry, { id }))).ok) {
      this.saved.set(this.snapshot());
      this.keeper.forget();
      this.toaster.success('Article mis à la corbeille');
      void this.siteData.load();
      void this.router.navigate(['/admin/mon-cap']);
    }
  }

  private form(): CapEntryForm {
    return {
      title: this.title().trim(),
      subtitle: this.subtitle().trim() || undefined,
      happenedOn: this.date(),
      imageId: this.imageId() ?? undefined,
      style: this.style(),
      blocks: this.formBlocks(),
      status: this.status(),
      scheduledAt: this.status() === 'DRAFT' ? (fromParisInput(this.scheduledAt()) ?? undefined) : undefined,
      featured: this.featured(),
    };
  }

  private formBlocks(): CapBlock[] {
    return this.blocks().map(toForm);
  }
}

/** What Ctrl+Z goes back through. */
interface HistoryState {
  title: string;
  subtitle: string;
  date: string;
  imageId: string | null;
  style: 'CLASSIC' | 'NOTEBOOK';
  status: 'DRAFT' | 'PUBLISHED';
  scheduledAt: string;
  featured: boolean;
  blocks: EditorBlock[];
}

function toEditor(block: CapBlock): EditorBlock {
  return { ...block, key: nextKey++, photos: block.photos?.map((photo) => ({ ...photo, key: nextKey++ })) };
}

function toForm({ key: _, photos, ...block }: EditorBlock): CapBlock {
  const form: CapBlock = { ...block };
  if (photos) {
    form.photos = photos.map(({ key: __, ...photo }) => photo);
  }
  return form;
}

function isEmpty(block: EditorBlock): boolean {
  return !block.text?.trim() && !block.imageId && !block.caption?.trim() && !(block.photos ?? []).some((photo) => photo.imageId || photo.caption?.trim());
}
