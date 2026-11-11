import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ClaudeAvailability } from '../../../core/api/generated/models/claude-availability';
import { AiEngine, claudeName } from '../../../core/local-ai/ai-engine';
import { isPhoneOrTablet } from '../../../core/local-ai/local-ai-format';
import { RECIPE_MODEL } from '../../../core/local-ai/local-models';
import { AiLogo } from '../ai-logo/ai-logo';

/**
 * "Gemini", "Claude" or "IA locale", at the top of the windows of the AI, each with the mark of
 * who makes it: free online, paid online, or on this computer (greyed out on a phone).
 */
@Component({
  selector: 'yona-ai-engines',
  imports: [AiLogo],
  template: `
    <div class="engines" role="group" aria-label="Quelle IA utiliser">
      <button type="button" class="engine" [attr.aria-pressed]="engine() === 'gemini'" [disabled]="disabled() || geminiUnavailable()" (click)="chosen.emit('gemini')">
        <span class="engine__name"><yona-ai-logo name="gemini" />Gemini</span>
        <span class="engine__detail">Google, en ligne, gratuit. {{ onlineReads() }}</span>
      </button>
      <button type="button" class="engine" [attr.aria-pressed]="engine() === 'claude'" [disabled]="disabled() || !claudeAvailable()" (click)="chosen.emit('claude')">
        <span class="engine__name"><yona-ai-logo name="claude" />{{ claudeLabel() }}</span>
        <span class="engine__detail">{{ claudeAvailable() ? 'Anthropic, en ligne, payant. ' + onlineReads() : (claude()?.reason ?? 'Indisponible') }}</span>
      </button>
      <button type="button" class="engine" [attr.aria-pressed]="engine() === 'local'" [disabled]="disabled() || onPhone" (click)="chosen.emit('local')">
        <span class="engine__name"><yona-ai-logo name="google" />IA locale</span>
        <span class="engine__detail">{{ onPhone ? 'Sur ordinateur seulement : ne fonctionne pas sur téléphone ou tablette' : modelName + ', sur cet ordinateur. ' + localReads() }}</span>
      </button>
    </div>
  `,
  styles: `
    .engines {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
      gap: var(--space-2);
    }

    .engine {
      display: grid;
      align-content: start;
      gap: var(--space-1);
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      background: none;
      color: var(--color-text);
      text-align: left;
      cursor: pointer;

      &[aria-pressed='true'] {
        border-color: var(--color-accent);
        box-shadow: inset 0 0 0 1px var(--color-accent);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .engine__name {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-weight: 600;
    }

    .engine__detail {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiEngines {
  readonly engine = input.required<AiEngine>();
  /** While the AI works: no change of engine. */
  readonly disabled = input(false);
  readonly geminiUnavailable = input(false);
  /** Whether Claude can be chosen, and its model; null while unknown. */
  readonly claude = input<ClaudeAvailability | null>(null);
  /** What Gemini and Claude can be given: "Texte ou photo". */
  readonly onlineReads = input('Texte ou photo');
  readonly localReads = input('Texte seulement');
  readonly chosen = output<AiEngine>();

  protected readonly onPhone = isPhoneOrTablet();
  protected readonly modelName = RECIPE_MODEL.name;
  protected readonly claudeAvailable = computed(() => !!this.claude()?.available);
  protected readonly claudeLabel = computed(() => claudeName(this.claude()?.model));
}
