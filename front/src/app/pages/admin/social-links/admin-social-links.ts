import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { FormField, applyEach, form, pattern, required, schema, submit, validate } from '@angular/forms/signals';
import { LucideArrowDown, LucideArrowUp, LucidePlus, LucideTrash2 } from '@lucide/angular';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { replaceSocialLinks } from '../../../core/api/generated/fn/admin-social-links/replace-social-links';
import { Link } from '../../../core/api/generated/models/link';
import { Toaster } from '../../../core/notifications/toaster';
import { SiteData } from '../../../core/site/site-data';
import { BrandIcon, SocialPlatform, socialPlatformLabel } from '../../../shared/ui/brand-icon/brand-icon';
import { Button } from '../../../shared/ui/button/button';
import { FieldError } from '../../../shared/ui/field-error/field-error';
import { Select, SelectOption } from '../../../shared/ui/select/select';

const PLATFORMS: SocialPlatform[] = ['INSTAGRAM', 'TIKTOK', 'YOUTUBE'];

interface SocialLinksDraft {
  links: Link[];
}

const socialLinksSchema = schema<SocialLinksDraft>((draft) => {
  applyEach(draft.links, (link) => {
    required(link.url, { message: "Collez l'adresse de la page." });
    pattern(link.url, /^https:\/\/\S+$/, { message: 'Une adresse complète, commençant par https://' });
  });
  validate(draft.links, ({ value }) => {
    const platforms = value().map((link) => link.platform);
    return new Set(platforms).size !== platforms.length
      ? { kind: 'duplicatePlatform', message: 'Chaque réseau ne peut apparaître qu’une fois.' }
      : undefined;
  });
});

/** The whole list is replaced on save, in the order shown (footer and phone menu). */
@Component({
  selector: 'yona-admin-social-links',
  imports: [FormField, Button, BrandIcon, FieldError, Select, LucideArrowDown, LucideArrowUp, LucidePlus, LucideTrash2],
  templateUrl: './admin-social-links.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminSocialLinks {
  private readonly api = inject(Api);
  private readonly toaster = inject(Toaster);
  private readonly siteData = inject(SiteData);

  protected readonly draft = linkedSignal<SocialLinksDraft>(() => ({
    links: this.siteData.socialLinks().map(({ platform, url }) => ({ platform, url })),
  }));
  protected readonly linksForm = form(this.draft, socialLinksSchema);
  protected readonly platformOptions: SelectOption<SocialPlatform>[] = PLATFORMS.map((platform) => ({
    value: platform,
    label: socialPlatformLabel(platform),
  }));
  /** One link per network: no new line once they are all listed. */
  protected readonly canAdd = computed(() => this.draft().links.length < PLATFORMS.length);
  protected readonly saving = signal(false);

  protected add(): void {
    const used = new Set(this.draft().links.map((link) => link.platform));
    const platform = PLATFORMS.find((candidate) => !used.has(candidate)) ?? PLATFORMS[0];
    this.draft.update((draft) => ({ links: [...draft.links, { platform, url: '' }] }));
  }

  protected remove(index: number): void {
    this.draft.update((draft) => ({ links: draft.links.filter((_link, position) => position !== index) }));
  }

  protected move(from: number, to: number): void {
    this.draft.update((draft) => {
      const links = [...draft.links];
      [links[from], links[to]] = [links[to], links[from]];
      return { links };
    });
  }

  protected async save(): Promise<void> {
    await submit(this.linksForm, async () => {
      this.saving.set(true);
      const links = this.draft().links.map((link) => ({ ...link, url: link.url.trim() }));
      const saved = await attempt(this.api.invoke(replaceSocialLinks, { body: { links } }));
      this.saving.set(false);
      if (saved.ok) {
        this.toaster.success('Réseaux sociaux enregistrés.');
        await this.siteData.load();
      }
      return undefined;
    });
  }
}
