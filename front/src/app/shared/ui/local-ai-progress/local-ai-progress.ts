import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { AiStage, formatDuration } from '../../../core/local-ai/local-ai-format';
import { Icon } from '../icon/icon';

/** What the model running on this computer is doing now, how long it has taken, and what it costs the machine. */
@Component({
  selector: 'yona-local-ai-progress',
  imports: [Icon],
  template: `
    <ol class="stages" role="list" aria-live="polite">
      @for (stage of stages(); track stage.label) {
        <li class="stage" [class.is-waiting]="stage.state === 'waiting'">
          @switch (stage.state) {
            @case ('done') {
              <svg yonaIcon="circle-check" class="stage__icon stage__icon--done" [size]="18"></svg>
            }
            @case ('running') {
              <svg yonaIcon="loader-circle" class="stage__icon spin" [size]="18"></svg>
            }
            @default {
              <svg yonaIcon="clock" class="stage__icon" [size]="18"></svg>
            }
          }
          <div>
            <p class="stage__label">{{ stage.label }}</p>
            @if (stage.detail) {
              <p class="stage__detail">{{ stage.detail }}</p>
            }
          </div>
        </li>
      }
    </ol>
    @if (share() !== null) {
      <div class="track" role="progressbar" aria-label="Avancement" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="percent()">
        <div class="bar" [style.transform]="'scaleX(' + share() + ')'"></div>
      </div>
    }
    <p class="elapsed">Temps écoulé : {{ elapsed() }}</p>
    <p class="warning">
      <svg yonaIcon="triangle-alert" [size]="18"></svg>
      L'ordinateur peut ralentir tant que l'IA travaille : elle utilise la carte graphique et beaucoup de mémoire. Gardez cet onglet ouvert
    </p>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-3);
    }

    .stages {
      display: grid;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .stage {
      display: flex;
      gap: var(--space-2);
    }

    .stage.is-waiting {
      opacity: 0.55;
    }

    .stage__icon {
      flex: none;
      margin-top: 2px;
      color: var(--color-text-muted);
    }

    .stage__icon--done {
      color: var(--color-accent);
    }

    .stage__label {
      font-weight: 600;
    }

    .stage__detail,
    .elapsed {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    .track {
      height: 0.5rem;
      overflow: hidden;
      border-radius: var(--radius-md);
      background-color: var(--color-surface);
    }

    .bar {
      height: 100%;
      background-color: var(--color-accent);
      transform-origin: left;
      transition: transform var(--duration-base) var(--ease-out);
    }

    .warning {
      display: flex;
      gap: var(--space-2);
      font-size: var(--text-sm);
      color: var(--color-text-muted);

      svg {
        flex: none;
        color: var(--color-accent);
      }
    }

    .spin {
      animation: spin 900ms linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocalAiProgress {
  readonly stages = input.required<AiStage[]>();
  /** From 0 to 1; null when it cannot be told. */
  readonly share = input<number | null>(null);

  protected readonly percent = computed(() => Math.round((this.share() ?? 0) * 100));
  private readonly seconds = signal(0);
  protected readonly elapsed = computed(() => formatDuration(this.seconds()));

  constructor() {
    const started = Date.now();
    const timer = setInterval(() => this.seconds.set((Date.now() - started) / 1000), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
