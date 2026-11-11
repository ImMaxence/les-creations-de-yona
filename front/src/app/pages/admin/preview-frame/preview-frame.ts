import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { Icon } from '../../../shared/ui/icon/icon';
import { Segmented } from '../../../shared/ui/segmented/segmented';

export type PreviewDevice = 'desktop' | 'phone';

const DEVICE_KEY = 'admin-preview-device';

/** The screen chosen last, in this browser: the next preview opens on it. */
function readDevice(): PreviewDevice {
  try {
    return localStorage.getItem(DEVICE_KEY) === 'phone' ? 'phone' : 'desktop';
  } catch {
    return 'desktop';
  }
}

/**
 * The page previewed in the back-office (a recipe, an article), as wide as on a computer or inside
 * a phone: "Ordinateur" or "Téléphone" above it. The page given must lay itself out by its own width
 * (container queries), not by the screen's, to look like a phone's in the frame.
 * <yona-preview-frame><yona-recipe … /></yona-preview-frame>
 */
@Component({
  selector: 'yona-preview-frame',
  imports: [Icon, Segmented],
  template: `
    <div class="tools">
      <div class="segmented" yonaSegmented role="radiogroup" aria-label="Écran">
        <button type="button" class="segmented__option" role="radio" [attr.aria-checked]="device() === 'desktop'" (click)="choose('desktop')">
          <svg yonaIcon="monitor" [size]="18"></svg>Ordinateur
        </button>
        <button type="button" class="segmented__option" role="radio" [attr.aria-checked]="device() === 'phone'" (click)="choose('phone')">
          <svg yonaIcon="smartphone" [size]="18"></svg>Téléphone
        </button>
      </div>
    </div>
    <div class="screen" [class.is-phone]="device() === 'phone'">
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    // Away from the head of the dialog, which draws a line under its title
    .tools {
      display: flex;
      justify-content: center;
      padding: var(--space-5) var(--space-4) var(--space-4);
    }

    .screen {
      margin-inline: auto;
      background-color: var(--color-bg);

      &.is-phone {
        width: 390px;
        max-width: calc(100% - 2 * var(--space-4));
        margin-bottom: var(--space-6);
        overflow: hidden;
        border: 10px solid color-mix(in srgb, var(--color-text) 85%, transparent);
        border-radius: 2.5rem;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreviewFrame {
  protected readonly device = signal<PreviewDevice>(readDevice());

  protected choose(device: PreviewDevice): void {
    this.device.set(device);
    try {
      localStorage.setItem(DEVICE_KEY, device);
    } catch {
      // Storage blocked: chosen for this preview only
    }
  }
}
