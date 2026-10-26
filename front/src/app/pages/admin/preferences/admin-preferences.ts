import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, linkedSignal, signal } from '@angular/core';
import { FormField, form, maxLength, required, schema, submit } from '@angular/forms/signals';
import { Api } from '../../../core/api/generated/api';
import { attempt } from '../../../core/api/attempt';
import { ImageUploads } from '../../../core/api/image-uploads';
import { chooseAboutImage } from '../../../core/api/generated/fn/admin-site-content/choose-about-image';
import { replaceAboutImage } from '../../../core/api/generated/fn/admin-site-content/replace-about-image';
import { updateSiteContent } from '../../../core/api/generated/fn/admin-site-content/update-site-content';
import { SiteContentResponse } from '../../../core/api/generated/models/site-content-response';
import { Toaster } from '../../../core/notifications/toaster';
import { SiteData } from '../../../core/site/site-data';
import { Button } from '../../../shared/ui/button/button';
import { FieldError } from '../../../shared/ui/field-error/field-error';
import { ImageUpload } from '../../../shared/ui/image-upload/image-upload';

interface ContentDraft {
  aboutTitle: string;
  aboutText: string;
  footerText: string;
}

/** A photo chosen but not saved yet: a file to send, an image of the gallery, or none (null). */
type PendingImage = { file: File; previewUrl: string } | { imageId: string | null };

/** Same rules as the API (SiteContentForm on the backend). */
const contentSchema = schema<ContentDraft>((content) => {
  required(content.aboutTitle, { message: 'Donnez un titre à la section.' });
  maxLength(content.aboutTitle, 80, { message: '80 caractères au maximum.' });
  required(content.aboutText, { message: 'Écrivez quelques mots de présentation.' });
  maxLength(content.aboutText, 1500, { message: '1 500 caractères au maximum.' });
  required(content.footerText, { message: "Le pied de page a besoin d'un texte." });
  maxLength(content.footerText, 200, { message: '200 caractères au maximum.' });
});

/**
 * Texts and photo of the site: the "À propos" section of the home page and the footer. The
 * site's name and icon are not editable: they stay in the code, for search engines and the
 * installed app. Nothing reaches the site before "Enregistrer", the photo included: until then it
 * is only previewed here.
 */
@Component({
  selector: 'yona-admin-preferences',
  imports: [FormField, Button, FieldError, ImageUpload],
  templateUrl: './admin-preferences.html',
  styleUrl: './admin-preferences.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminPreferences {
  private readonly api = inject(Api);
  private readonly imageUploads = inject(ImageUploads);
  private readonly toaster = inject(Toaster);
  private readonly siteData = inject(SiteData);

  /** The saved texts, unchanged when only the photo changes: texts being edited are then kept. */
  private readonly savedTexts = computed<ContentDraft>(
    () => {
      const { aboutTitle, aboutText, footerText } = this.siteData.content();
      return { aboutTitle, aboutText, footerText };
    },
    {
      equal: (a, b) => a.aboutTitle === b.aboutTitle && a.aboutText === b.aboutText && a.footerText === b.footerText,
    },
  );
  protected readonly draft = linkedSignal<ContentDraft>(() => ({ ...this.savedTexts() }));
  protected readonly contentForm = form(this.draft, contentSchema);
  private readonly pendingImage = signal<PendingImage | null>(null);
  /** The photo shown here: the one chosen, or the saved one. */
  protected readonly aboutImageId = computed(() => {
    const pending = this.pendingImage();
    if (pending && 'imageId' in pending) {
      return pending.imageId;
    }
    return pending ? null : (this.siteData.content().aboutImageId ?? null);
  });
  protected readonly previewUrl = computed(() => {
    const pending = this.pendingImage();
    return pending && 'file' in pending ? pending.previewUrl : null;
  });
  private readonly textsChanged = computed(() => {
    const saved = this.savedTexts();
    const draft = this.draft();
    return (
      draft.aboutTitle !== saved.aboutTitle || draft.aboutText !== saved.aboutText || draft.footerText !== saved.footerText
    );
  });
  protected readonly unsaved = computed(() => this.textsChanged() || this.pendingImage() !== null);

  protected readonly saving = signal(false);
  /** Share of a new photo sent (0 to 1) while it uploads. */
  protected readonly uploadProgress = signal<number | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.choose(null));
  }

  protected chooseFile(file: File): void {
    this.choose({ file, previewUrl: URL.createObjectURL(file) });
  }

  /** A photo of the gallery, or none (null): back to the photo bundled with the site. */
  protected chooseImage(imageId: string | null): void {
    this.choose({ imageId });
  }

  protected reset(): void {
    this.draft.set({ ...this.savedTexts() });
    this.choose(null);
  }

  protected async save(): Promise<void> {
    await submit(this.contentForm, async () => {
      this.saving.set(true);
      let content = this.siteData.content();
      let ok = true;
      if (this.textsChanged()) {
        const saved = await attempt(this.api.invoke(updateSiteContent, { body: this.draft() }));
        ok = saved.ok;
        if (saved.ok) {
          content = saved.value;
        }
      }
      const image = this.pendingImage();
      if (ok && image) {
        const changed = await attempt(this.saveImage(image));
        ok = changed.ok;
        if (changed.ok) {
          content = { ...content, aboutImageId: changed.value.aboutImageId };
          this.choose(null);
        }
      }
      this.saving.set(false);
      this.siteData.setContent(content);
      if (ok) {
        this.toaster.success('Préférences enregistrées : elles sont en ligne.');
      }
      return undefined;
    });
  }

  private saveImage(image: PendingImage): Promise<SiteContentResponse> {
    if ('file' in image) {
      this.uploadProgress.set(0);
      return this.imageUploads
        .send<SiteContentResponse>(replaceAboutImage.PATH, image.file, (sent) => this.uploadProgress.set(sent))
        .finally(() => this.uploadProgress.set(null));
    }
    return this.api.invoke(chooseAboutImage, { body: { imageId: image.imageId ?? undefined } });
  }

  /** The local preview of a file is released once replaced. */
  private choose(image: PendingImage | null): void {
    const previous = this.pendingImage();
    if (previous && 'file' in previous) {
      URL.revokeObjectURL(previous.previewUrl);
    }
    this.pendingImage.set(image);
  }
}
