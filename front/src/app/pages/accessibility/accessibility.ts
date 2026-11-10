import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ColorSchemeSwitch } from '../../core/layout/color-scheme-switch/color-scheme-switch';
import { DisplayPreferences, DisplayPreferencesStore, isDefault } from '../../core/theme/display-preferences';
import { ACCESSIBILITY_STATEMENT_PATH, FEEDBACK_PATH } from '../../shared/routing/links';
import { Button } from '../../shared/ui/button/button';
import { Icon } from '../../shared/ui/icon/icon';
import { CONTACT_EMAIL } from '../legal/legal';

type Switch = Exclude<keyof DisplayPreferences, 'textSize'>;

const TEXT_SIZES: { value: DisplayPreferences['textSize']; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Grand' },
  { value: 'larger', label: 'Très grand' },
];

const SWITCHES: { key: Switch; label: string; hint: string }[] = [
  { key: 'contrast', label: 'Contraste renforcé', hint: 'Les textes gris et les traits aussi foncés que le texte' },
  { key: 'reduceMotion', label: 'Réduire les animations', hint: 'Plus aucun mouvement à l’arrivée des pages ni en défilant' },
  { key: 'readableFont', label: 'Police simple', hint: 'Une police sans empattement pour tous les textes, sans italique' },
  { key: 'underlineLinks', label: 'Souligner les liens', hint: 'Chaque lien des textes reconnu sans dépendre de sa couleur' },
  { key: 'textSpacing', label: 'Espacer le texte', hint: 'Plus d’espace entre les lignes, les lettres et les mots' },
];

/**
 * "Accessibilité": the display, adapted by each visitor (text size, contrast, motion, font, links,
 * spacing, light or dark), kept in their browser and applied at once on every page; what the site
 * does for everyone; how to report a problem. The legal statement has its own page.
 */
@Component({
  selector: 'yona-accessibility',
  imports: [Button, ColorSchemeSwitch, Icon, RouterLink],
  templateUrl: './accessibility.html',
  styleUrl: './accessibility.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Accessibility {
  protected readonly store = inject(DisplayPreferencesStore);
  protected readonly textSizes = TEXT_SIZES;
  protected readonly switches = SWITCHES;
  protected readonly statementPath = ACCESSIBILITY_STATEMENT_PATH;
  protected readonly feedbackPath = FEEDBACK_PATH;
  protected readonly contactEmail = CONTACT_EMAIL;
  protected readonly changed = computed(() => !isDefault(this.store.preferences()));

  protected setTextSize(textSize: DisplayPreferences['textSize']): void {
    this.store.update({ textSize });
  }

  protected toggle(key: Switch, event: Event): void {
    this.store.update({ [key]: (event.target as HTMLInputElement).checked });
  }
}
