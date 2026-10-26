import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { Api } from '../../../core/api/generated/api';
import { attempt } from '../../../core/api/attempt';
import { createAppearancePreset } from '../../../core/api/generated/fn/admin-appearance-presets/create-appearance-preset';
import { deleteAppearancePreset } from '../../../core/api/generated/fn/admin-appearance-presets/delete-appearance-preset';
import { listAppearancePresets } from '../../../core/api/generated/fn/admin-appearance-presets/list-appearance-presets';
import { updateAppearancePreset } from '../../../core/api/generated/fn/admin-appearance-presets/update-appearance-preset';
import { AppearancePresetResponse } from '../../../core/api/generated/models/appearance-preset-response';
import { ThemeResponse } from '../../../core/api/generated/models/theme-response';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { SiteTheme } from '../../../core/theme/site-theme';
import { BODY_FONTS, BodyFontId, DISPLAY_FONTS, DisplayFontId } from '../../../core/theme/theme-fonts';
import { THEME_PRESETS, ThemePresetId } from '../../../core/theme/theme-presets';
import { Button } from '../../../shared/ui/button/button';
import { Select, SelectOption } from '../../../shared/ui/select/select';
import { Icon } from '../../../shared/ui/icon/icon';

const MAX_RADIUS_PX = 999;
/** The slider covers the useful range; the field beside it goes up to 999. */
const SLIDER_MAX_PX = 48;
const MAX_PRESET_NAME_LENGTH = 50;

function sameTheme(a: ThemeResponse, b: ThemeResponse): boolean {
  return (
    a.preset === b.preset && a.displayFont === b.displayFont && a.bodyFont === b.bodyFont && a.radiusPx === b.radiusPx
  );
}

/**
 * Look of the site for every visitor: color theme, fonts and corner radius. Every change is shown
 * at once on the whole site (preview); it reaches visitors once saved. Leaving the page without
 * saving brings the saved look back. A look can be kept under a name ("Mes préréglages"): choosing
 * it fills the fields below, which are then saved as usual.
 */
@Component({
  selector: 'yona-admin-appearance',
  imports: [Icon, Button, Select],
  templateUrl: './admin-appearance.html',
  styleUrl: './admin-appearance.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminAppearance {
  private readonly siteTheme = inject(SiteTheme);
  private readonly toaster = inject(Toaster);
  private readonly api = inject(Api);
  private readonly confirm = inject(Confirm);

  protected readonly draft = linkedSignal<ThemeResponse>(() => this.siteTheme.theme());
  protected readonly unsaved = computed(() => !sameTheme(this.draft(), this.siteTheme.theme()));
  protected readonly saving = signal(false);

  protected readonly savedLooks = resource({ loader: () => this.api.invoke(listAppearancePresets) });
  protected readonly maxPresetNameLength = MAX_PRESET_NAME_LENGTH;
  protected readonly newPresetName = signal('');
  protected readonly renamingId = signal<number | null>(null);
  protected readonly renamedName = signal('');
  /** The saved look matching the fields below, if any. */
  protected readonly currentLookId = computed(
    () => this.savedLooks.value()?.find((look) => sameTheme(look.theme, this.draft()))?.id ?? null,
  );

  protected readonly presets = (Object.keys(THEME_PRESETS) as ThemePresetId[]).map((id) => ({
    id,
    ...THEME_PRESETS[id],
  }));
  protected readonly displayFontOptions: SelectOption<DisplayFontId>[] = (
    Object.keys(DISPLAY_FONTS) as DisplayFontId[]
  ).map((id) => ({ value: id, label: DISPLAY_FONTS[id].label }));
  protected readonly bodyFontOptions: SelectOption<BodyFontId>[] = (Object.keys(BODY_FONTS) as BodyFontId[]).map(
    (id) => ({ value: id, label: BODY_FONTS[id].label }),
  );
  protected readonly sliderMax = SLIDER_MAX_PX;
  protected readonly maxRadius = MAX_RADIUS_PX;

  constructor() {
    effect(() => this.siteTheme.preview(this.draft()));
    inject(DestroyRef).onDestroy(() => this.siteTheme.cancelPreview());
  }

  protected update<K extends keyof ThemeResponse>(key: K, value: ThemeResponse[K] | undefined): void {
    if (value !== undefined) {
      this.draft.update((draft) => ({ ...draft, [key]: value }));
    }
  }

  protected onRadiusInput(event: Event): void {
    const value = Math.round(Number((event.target as HTMLInputElement).value));
    if (Number.isFinite(value)) {
      this.update('radiusPx', Math.min(MAX_RADIUS_PX, Math.max(0, value)));
    }
  }

  protected reset(): void {
    this.draft.set(this.siteTheme.theme());
  }

  // Saved looks

  /** Fills the fields below (and the preview); saving it for visitors stays a separate step. */
  protected applyLook(look: AppearancePresetResponse): void {
    this.draft.set({ ...look.theme });
  }

  protected presetLabel(look: AppearancePresetResponse): string {
    return THEME_PRESETS[look.theme.preset].label;
  }

  protected palettesOf(look: AppearancePresetResponse) {
    const preset = THEME_PRESETS[look.theme.preset];
    return [preset.light, preset.dark];
  }

  protected fontsOf(look: AppearancePresetResponse): string {
    return `${DISPLAY_FONTS[look.theme.displayFont].label} · ${BODY_FONTS[look.theme.bodyFont].label}`;
  }

  protected async saveLook(event: Event): Promise<void> {
    event.preventDefault();
    const name = this.newPresetName().trim();
    if (!name) {
      this.toaster.error('Donnez un nom au préréglage.');
      return;
    }
    const created = await attempt(this.api.invoke(createAppearancePreset, { body: { name, theme: this.draft() } }));
    if (created.ok) {
      this.newPresetName.set('');
      this.toaster.success(`Préréglage « ${created.value.name} » enregistré.`);
      this.savedLooks.reload();
    }
  }

  /** The look keeps its name and takes the fields below. */
  protected async overwriteLook(look: AppearancePresetResponse): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Remplacer ce préréglage ?',
      message: `« ${look.name} » prendra les couleurs, polices et arrondi choisis plus bas.`,
      confirmLabel: 'Remplacer',
    });
    if (
      confirmed &&
      (await attempt(this.api.invoke(updateAppearancePreset, { id: look.id, body: { name: look.name, theme: this.draft() } })))
        .ok
    ) {
      this.toaster.success(`Préréglage « ${look.name} » mis à jour.`);
      this.savedLooks.reload();
    }
  }

  protected startRename(look: AppearancePresetResponse): void {
    this.renamingId.set(look.id);
    this.renamedName.set(look.name);
  }

  protected async rename(look: AppearancePresetResponse): Promise<void> {
    const name = this.renamedName().trim();
    if (!name || name === look.name) {
      this.renamingId.set(null);
      return;
    }
    if ((await attempt(this.api.invoke(updateAppearancePreset, { id: look.id, body: { name, theme: look.theme } }))).ok) {
      this.renamingId.set(null);
      this.toaster.success('Préréglage renommé.');
      this.savedLooks.reload();
    }
  }

  protected async removeLook(look: AppearancePresetResponse): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Supprimer ce préréglage ?',
      message: `« ${look.name} » sera supprimé. L'apparence actuelle du site ne change pas.`,
      confirmLabel: 'Supprimer',
    });
    if (confirmed && (await attempt(this.api.invoke(deleteAppearancePreset, { id: look.id }))).ok) {
      this.toaster.success('Préréglage supprimé.');
      this.savedLooks.reload();
    }
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    try {
      await this.siteTheme.save(this.draft());
      this.toaster.success('Apparence enregistrée : les visiteurs la voient dès maintenant.');
    } catch {
      // The API error is already shown as a toast
    } finally {
      this.saving.set(false);
    }
  }
}
