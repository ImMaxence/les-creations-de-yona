import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, signal } from '@angular/core';
import { LucideCheck, LucideMoon, LucideSun, LucideSunMoon } from '@lucide/angular';
import { ColorScheme, ColorSchemePreference } from '../../theme/color-scheme';

interface SchemeOption {
  readonly value: ColorSchemePreference;
  readonly label: string;
}

const OPTIONS: SchemeOption[] = [
  { value: 'light', label: 'Clair' },
  { value: 'auto', label: 'Auto' },
  { value: 'dark', label: 'Sombre' },
];

/**
 * Light / Auto / Dark choice of the visitor. "compact": an icon button with a small menu (desktop
 * navbar); "full": the three choices side by side (phone menu).
 */
@Component({
  selector: 'yona-color-scheme-switch',
  imports: [NgTemplateOutlet, LucideSun, LucideSunMoon, LucideMoon, LucideCheck],
  templateUrl: './color-scheme-switch.html',
  styleUrl: './color-scheme-switch.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'closeOnOutsideClick($event)',
    '(keydown.escape)': 'closeAndFocusTrigger()',
  },
})
export class ColorSchemeSwitch {
  readonly layout = input<'compact' | 'full'>('compact');

  protected readonly colorScheme = inject(ColorScheme);
  protected readonly options = OPTIONS;
  protected readonly current = computed(
    () => OPTIONS.find((option) => option.value === this.colorScheme.preference()) ?? OPTIONS[1],
  );
  protected readonly open = signal(false);

  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

  protected choose(preference: ColorSchemePreference): void {
    this.colorScheme.set(preference);
    this.open.set(false);
  }

  protected closeOnOutsideClick(event: MouseEvent): void {
    if (this.open() && !this.host.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  protected closeAndFocusTrigger(): void {
    if (this.open()) {
      this.open.set(false);
      this.host.querySelector<HTMLButtonElement>('.trigger')?.focus();
    }
  }
}
