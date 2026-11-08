import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, input, model, signal } from '@angular/core';
import { LocalModel, modelBytes } from '../../../core/local-ai/local-models';
import { TransferRate, formatDuration } from '../../../core/local-ai/local-ai-format';
import { NotEnoughSpaceError, deleteModel, downloadModel, missingFiles, webGpuProblem } from '../../../core/local-ai/model-store';
import { formatBytes } from '../../format/units';
import { Button } from '../button/button';
import { Icon } from '../icon/icon';

const ISSUES_URL = 'https://github.com/ImMaxence/les-creations-de-yona/issues/new';

function transferDetails(done: number, total: number, perSecond: number | null): string {
  const figures = [`${formatBytes(done)} sur ${formatBytes(total)}`, `reste ${formatBytes(total - done)}`];
  if (perSecond) {
    figures.push(`${formatBytes(perSecond)}/s`, `environ ${formatDuration((total - done) / perSecond)}`);
  }
  return figures.join(' · ');
}

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
          <p class="field__hint">
            <strong>{{ fullName() }}</strong> : à télécharger une seule fois ({{ size() }}), directement depuis Hugging Face. Il reste dans le cache de ce navigateur, sur le disque de cet ordinateur (effacer les données du site le supprime). Prévoyez du temps et une bonne connexion
          </p>
          <button yonaButton variant="secondary" type="button" (click)="download()"><svg yonaIcon="download"></svg>Télécharger le modèle</button>
        </div>
        <a class="report" target="_blank" rel="noopener noreferrer" [href]="reportUrl()">
          <svg yonaIcon="external-link" [size]="14"></svg>Le téléchargement ne marche pas ? Signaler le problème sur GitHub
        </a>
        @if (problem(); as message) {
          <p class="status status--error" role="alert"><svg yonaIcon="circle-alert" [size]="18"></svg>{{ message }}</p>
        }
      }
      @case ('downloading') {
        <div class="progress">
          <span aria-live="polite">Téléchargement depuis Hugging Face… {{ percent() }} %</span>
          <div class="track" role="progressbar" aria-label="Téléchargement du modèle" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="percent()">
            <div class="bar" [style.transform]="'scaleX(' + share() + ')'"></div>
          </div>
          @if (transfer(); as details) {
            <span class="field__hint">{{ details }}</span>
          }
          <button yonaButton variant="ghost" type="button" (click)="cancel()">Arrêter</button>
          <a class="report" target="_blank" rel="noopener noreferrer" [href]="reportUrl()">
            <svg yonaIcon="external-link" [size]="14"></svg>Le téléchargement ne marche pas ? Signaler le problème sur GitHub
          </a>
        </div>
      }
      @case ('ready') {
        <div class="row">
          <p class="status"><svg yonaIcon="circle-check" [size]="18"></svg>{{ fullName() }}, prêt dans ce navigateur</p>
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

    .report {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      margin-top: var(--space-2);
      font-size: var(--text-sm);
      color: var(--color-accent);
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
  protected readonly size = computed(() => formatBytes(modelBytes(this.localModel())));
  protected readonly fullName = computed(() => {
    const { name, companion } = this.localModel();
    return companion ? `${name}, avec ${companion}` : name;
  });
  /** A GitHub issue already filled in with what is needed to look into it. */
  protected readonly reportUrl = computed(() => {
    const { name, repo, revision } = this.localModel();
    const title = `Téléchargement du modèle en échec : ${name}`;
    const body = `Ce qui se passe :\n\n\nModèle : ${repo}@${revision}\nNavigateur : ${navigator.userAgent}`;
    return `${ISSUES_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  });
  /** Downloaded, left, speed and time left. */
  protected readonly transfer = signal<string | null>(null);
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
      const rate = new TransferRate();
      let shownAt = 0;
      await downloadModel(
        this.localModel(),
        (done, total) => {
          const now = performance.now();
          rate.add(now, done);
          this.share.set(done / total);
          // Twice a second: readable, where every chunk received would make the figures flicker
          if (now - shownAt > 500) {
            shownAt = now;
            this.transfer.set(transferDetails(done, total, rate.perSecond()));
          }
        },
        this.controller.signal,
      );
      this.setReady(true);
    } catch (error) {
      this.transfer.set(null);
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
