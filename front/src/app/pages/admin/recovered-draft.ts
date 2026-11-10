import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { parisDateTime } from '../../shared/format/paris-time';
import { Button } from '../../shared/ui/button/button';
import { Icon } from '../../shared/ui/icon/icon';

/** "Des modifications non enregistrées ont été retrouvées": a form left unsaved, to take up again or forget. */
@Component({
  selector: 'yona-recovered-draft',
  imports: [Button, Icon],
  template: `
    <div class="admin-panel recovered" role="status">
      <svg yonaIcon="rotate-ccw" [size]="22" [strokeWidth]="1.75"></svg>
      <div>
        <p class="recovered__title">Des modifications non enregistrées ont été retrouvées</p>
        <p class="field__hint">
          <!-- A period between two sentences only: none at the end of the text -->
          Saisies le {{ when() }}, avant que la page soit fermée{{ outdated() ? '.' : '' }}
          @if (outdated()) {
            {{ outdatedText() }}
          }
        </p>
      </div>
      <div class="recovered__actions">
        <button yonaButton type="button" (click)="resume.emit()">Reprendre</button>
        <button yonaButton variant="ghost" type="button" (click)="discard.emit()">Ignorer</button>
      </div>
    </div>
  `,
  styleUrl: './recovered-draft.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecoveredDraft {
  /** When it was typed (ISO). */
  readonly savedAt = input.required<string>();
  /** Saved again since (another tab, another admin): taking it up replaces that version. */
  readonly outdated = input(false);
  readonly outdatedText = input('Enregistré depuis : les reprendre remplacera cette version');
  readonly resume = output();
  readonly discard = output();

  protected readonly when = computed(() => parisDateTime(this.savedAt()));
}
