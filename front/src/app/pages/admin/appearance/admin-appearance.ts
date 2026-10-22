import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { LucideCheck } from '@lucide/angular';
import { ThemeResponse } from '../../../core/api/generated/models/theme-response';
import { Toaster } from '../../../core/notifications/toaster';
import { SiteTheme } from '../../../core/theme/site-theme';
import { BODY_FONTS, BodyFontId, DISPLAY_FONTS, DisplayFontId } from '../../../core/theme/theme-fonts';
import { THEME_PRESETS, ThemePresetId } from '../../../core/theme/theme-presets';
import { Button } from '../../../shared/ui/button/button';
import { Select, SelectOption } from '../../../shared/ui/select/select';

const MAX_RADIUS_PX = 999;
/** The slider covers the useful range; the field beside it goes up to 999. */
const SLIDER_MAX_PX = 48;

/**
 * Look of the site for every visitor: color theme, fonts and corner radius. Every change is shown
 * at once on the whole site (preview); it reaches visitors once saved. Leaving the page without
 * saving brings the saved look back.
 */
@Component({
  selector: 'yona-admin-appearance',
  imports: [Button, Select, LucideCheck],
  templateUrl: './admin-appearance.html',
  styleUrl: './admin-appearance.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminAppearance {
  private readonly siteTheme = inject(SiteTheme);
  private readonly toaster = inject(Toaster);

  protected readonly draft = linkedSignal<ThemeResponse>(() => this.siteTheme.theme());
  protected readonly unsaved = computed(
    () => JSON.stringify(this.draft()) !== JSON.stringify(this.siteTheme.theme()),
  );
  protected readonly saving = signal(false);

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
