import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, input, model, signal } from '@angular/core';
import { LocalModel, modelBytes } from '../../../core/local-ai/local-models';
import { NotEnoughSpaceError, deleteModel, downloadModel, missingFiles, webGpuProblem } from '../../../core/local-ai/model-store';
import { Button } from '../button/button';
import { Icon } from '../icon/icon';

type State = 'checking' | 'unsupported' | 'missing' | 'downloading' | 'ready';

/**
 * Download of a model that runs in this browser: once, then kept here. Says what cannot work, what
 * the download weighs, how far it is; and gives the space back on demand.
 */
@Component({
  selector: 'yona-local-model-setup',
  imports: [Button, Icon],
  template: `
    @switch (state()) {
      @case ('unsupported') {
        <p class="status status--error" role="alert"><svg yonaIcon="circle-alert" [size]="18"></svg>{{ problem() }}</p>
      }
      @case ('missing') {
        <div class="row">
          <p class="field__hint">À télécharger une seule fois ({{ size() }}), puis gardé dans ce navigateur. Prévoyez du temps et une bonne connexion</p>
          <button yonaButton variant="secondary" type="button" (click)="download()"><svg yonaIcon="download"></svg>Télécharger le modèle</button>
        </div>
        @if (problem(); as message) {
          <p class="status status--error" role="alert"><svg yonaIcon="circle-alert" [size]="18"></svg>{{ message }}</p>
        }
      }
      @case ('downloading') {
        <div class="progress">
          <span aria-live="polite">Téléchargement du modèle… {{ percent() }} %</span>
          <div class="track" role="progressbar" aria-label="Téléchargement du modèle" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="percent()">
            <div class="bar" [style.transform]="'scaleX(' + share() + ')'"></div>
          </div>
          <button yonaButton variant="ghost" type="button" (click)="cancel()">Arrêter</button>
        </div>
      }
      @case ('ready') {
        <div class="row">
          <p class="status"><svg yonaIcon="circle-check" [size]="18"></svg>Modèle prêt dans ce navigateur</p>
          <button yonaButton variant="ghost" type="button" (click)="remove()"><svg yonaIcon="trash"></svg>Supprimer ({{ size() }})</button>
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
    }

    .status {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--color-text-muted);
    }

    .status--error {
      color: var(--color-danger);
    }

    .progress {
      display: grid;
      gap: var(--space-2);
      justify-items: start;
    }

    .track {
      width: 100%;
      height: 0.5rem;
      overflow: hidden;
      border-radius: var(--radius-md);
      background-color: var(--color-surface);
    }

    .bar {
      height: 100%;
      background-color: var(--color-accent);
      transform-origin: left;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocalModelSetup {
  readonly localModel = input.required<LocalModel>();
  /** True once the model can be used here. */
  readonly ready = model(false);

  protected readonly state = signal<State>('checking');
  protected readonly problem = signal<string | null>(null);
  protected readonly share = signal(0);
  protected readonly percent = computed(() => Math.floor(this.share() * 100));
  protected readonly size = computed(() => `${(modelBytes(this.localModel()) / 1e9).toFixed(1).replace('.', ',')} Go`);
  private controller: AbortController | null = null;

  constructor() {
    afterNextRender(() => void this.check());
    inject(DestroyRef).onDestroy(() => this.cancel());
  }

  protected async download(): Promise<void> {
    this.problem.set(null);
    this.state.set('downloading');
    this.controller = new AbortController();
    try {
      await downloadModel(this.localModel(), (share) => this.share.set(share), this.controller.signal);
      this.setReady(true);
    } catch (error) {
      this.state.set('missing');
      if (error instanceof NotEnoughSpaceError) {
        this.problem.set(`Pas assez de place dans ce navigateur : il faut ${this.size()} de libres`);
      } else if (!this.controller?.signal.aborted) {
        this.problem.set('Le téléchargement s’est interrompu : vérifiez votre connexion, il reprendra au dernier fichier terminé');
      }
    } finally {
      this.controller = null;
    }
  }

  protected cancel(): void {
    this.controller?.abort();
  }

  protected async remove(): Promise<void> {
    await deleteModel(this.localModel());
    this.setReady(false);
  }

  private async check(): Promise<void> {
    const problem = await webGpuProblem();
    if (problem) {
      this.problem.set(problem);
      this.state.set('unsupported');
      return;
    }
    this.setReady((await missingFiles(this.localModel())).length === 0);
  }

  private setReady(ready: boolean): void {
    this.ready.set(ready);
    this.state.set(ready ? 'ready' : 'missing');
  }
}
