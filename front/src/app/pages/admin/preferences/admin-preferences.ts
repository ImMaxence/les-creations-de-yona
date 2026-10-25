import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
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
 * installed app. The photo is saved at once, like those of recipes; the texts with "Enregistrer".
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
  protected readonly aboutImageId = computed(() => this.siteData.content().aboutImageId ?? null);
  protected readonly unsaved = computed(() => {
    const saved = this.savedTexts();
    const draft = this.draft();
    return (
      draft.aboutTitle !== saved.aboutTitle || draft.aboutText !== saved.aboutText || draft.footerText !== saved.footerText
    );
  });

  protected readonly saving = signal(false);
  protected readonly imageBusy = signal(false);
  /** Share of a new photo sent (0 to 1) while it uploads. */
  protected readonly uploadProgress = signal<number | null>(null);

  protected async save(): Promise<void> {
    await submit(this.contentForm, async () => {
      this.saving.set(true);
      const saved = await attempt(this.api.invoke(updateSiteContent, { body: this.draft() }));
      this.saving.set(false);
      if (saved.ok) {
        this.siteData.setContent(saved.value);
        this.toaster.success('Textes enregistrés : ils sont en ligne.');
      }
      return undefined;
    });
  }

  protected async uploadImage(file: File): Promise<void> {
    this.uploadProgress.set(0);
    this.imageBusy.set(true);
    await this.changeImage(
      this.imageUploads.send<SiteContentResponse>(replaceAboutImage.PATH, file, (sent) => this.uploadProgress.set(sent)),
      'Photo enregistrée.',
    );
    this.uploadProgress.set(null);
  }

  /** A photo of the gallery, or none (null): back to the photo bundled with the site. */
  protected async chooseImage(imageId: string | null): Promise<void> {
    this.imageBusy.set(true);
    await this.changeImage(
      this.api.invoke(chooseAboutImage, { body: { imageId: imageId ?? undefined } }),
      imageId ? 'Photo enregistrée.' : "Photo retirée : la photo d'origine est de retour.",
    );
  }

  /** Only the photo is taken from the answer. */
  private async changeImage(call: Promise<SiteContentResponse>, successMessage: string): Promise<void> {
    const changed = await attempt(call);
    this.imageBusy.set(false);
    if (changed.ok) {
      this.siteData.setContent({ ...this.siteData.content(), aboutImageId: changed.value.aboutImageId });
      this.toaster.success(successMessage);
    }
  }
}
