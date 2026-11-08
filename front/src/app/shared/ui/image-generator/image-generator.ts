import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { ImageProgress, generateImage, imageSize, imageStages } from '../../../core/local-ai/generate-image';
import { IMAGE_MODEL } from '../../../core/local-ai/local-models';
import { Button } from '../button/button';
import { Dialog } from '../dialog/dialog';
import { Icon } from '../icon/icon';
import { LocalAiProgress } from '../local-ai-progress/local-ai-progress';
import { LocalModelSetup } from '../local-model-setup/local-model-setup';

const MAX_DESCRIPTION_LENGTH = 1000;

/**
 * "Générer avec l'IA": an image drawn on this computer from a description (FLUX.2 klein, in the
 * browser). The image chosen goes on to the photo editor, like a file. Nothing is sent to anyone.
 */
@Component({
  selector: 'yona-image-generator',
  imports: [Button, Dialog, Icon, LocalAiProgress, LocalModelSetup],
  template: `
    <yona-dialog title="Générer une image avec l'IA" [subtitle]="imageModel.name + ', sur cet ordinateur : rien n’est envoyé'" [closeOnBackdrop]="!progress()" [(open)]="open">
      @if (open()) {
        <div class="generator">
          <yona-local-model-setup [localModel]="imageModel" [(ready)]="ready" />
          @if (ready()) {
            <div class="field">
              <label class="field__label" for="generator-description">Décrivez l'image</label>
              <textarea
                id="generator-description"
                class="input"
                rows="3"
                [maxLength]="maxLength"
                placeholder="Une tarte aux pommes dorée sur une table en bois"
                [disabled]="!!progress()"
                [value]="description()"
                (input)="description.set($any($event.target).value)"
              ></textarea>
              <span class="field__hint">Comptez de 5 à 20 minutes selon l’ordinateur. L’ordinateur peut ralentir : fermez les applications lourdes</span>
            </div>
          }
          @if (progress(); as current) {
            <yona-local-ai-progress [stages]="stages()" [share]="current.share" />
          } @else if (resultUrl(); as url) {
            <img class="result" [src]="url" alt="Image générée" />
          }
          @if (error(); as message) {
            <p class="error" role="alert"><svg yonaIcon="circle-alert" [size]="18"></svg>{{ message }}</p>
          }
        </div>
      }
      <ng-container dialogActions>
        @if (progress()) {
          <button yonaButton variant="secondary" type="button" (click)="cancel()">Arrêter</button>
        } @else {
          <button yonaButton variant="secondary" type="button" (click)="open.set(false)">Annuler</button>
          @if (resultUrl()) {
            <button yonaButton variant="secondary" type="button" [disabled]="!canGenerate()" (click)="generate()"><svg yonaIcon="refresh-cw"></svg>Une autre</button>
            <button yonaButton type="button" (click)="use()"><svg yonaIcon="check"></svg>Utiliser cette image</button>
          } @else {
            <button yonaButton type="button" [disabled]="!canGenerate()" (click)="generate()"><svg yonaIcon="sparkles"></svg>Générer</button>
          }
        }
      </ng-container>
    </yona-dialog>
  `,
  styles: `
    .generator {
      display: grid;
      gap: var(--space-4);
    }

    .result {
      width: 100%;
      border-radius: var(--radius-md);
    }

    .error {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--color-danger);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageGenerator {
  readonly open = model(false);
  readonly portrait = input(false);
  /** Written in advance when opening: the title of the recipe, for instance. */
  readonly suggestion = input('');
  readonly generated = output<File>();

  protected readonly imageModel = IMAGE_MODEL;
  protected readonly maxLength = MAX_DESCRIPTION_LENGTH;
  protected readonly ready = signal(false);
  protected readonly description = signal('');
  protected readonly progress = signal<ImageProgress | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly resultUrl = signal<string | null>(null);
  protected readonly stages = computed(() => {
    const progress = this.progress();
    const { width, height } = imageSize(this.portrait());
    return progress ? imageStages(progress, width, height) : [];
  });
  protected readonly canGenerate = computed(() => this.ready() && !this.progress() && !!this.description().trim());
  private result: Blob | null = null;
  private controller: AbortController | null = null;

  constructor() {
    effect(() => {
      if (this.open()) {
        const suggestion = this.suggestion();
        untracked(() => this.description() || this.description.set(suggestion));
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.cancel();
      this.setResult(null);
    });
  }

  protected async generate(): Promise<void> {
    this.error.set(null);
    this.setResult(null);
    this.controller = new AbortController();
    try {
      const image = await generateImage(this.description().trim(), this.portrait(), (progress) => this.progress.set(progress), this.controller.signal);
      this.setResult(image);
    } catch (error) {
      if (!this.controller.signal.aborted) {
        console.error(error);
        this.error.set('L’image n’a pas pu être générée : fermez les applications lourdes, puis réessayez');
      }
    } finally {
      this.progress.set(null);
      this.controller = null;
    }
  }

  protected cancel(): void {
    this.controller?.abort();
  }

  protected use(): void {
    if (this.result) {
      this.generated.emit(new File([this.result], 'image-ia.png', { type: 'image/png' }));
      this.setResult(null);
      this.open.set(false);
    }
  }

  private setResult(image: Blob | null): void {
    const previous = this.resultUrl();
    if (previous) {
      URL.revokeObjectURL(previous);
    }
    this.result = image;
    this.resultUrl.set(image ? URL.createObjectURL(image) : null);
  }
}
