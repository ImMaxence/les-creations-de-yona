import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, model, output, signal } from '@angular/core';
import { Api } from '../../../core/api/generated/api';
import { fillRecipeWithAi } from '../../../core/api/generated/fn/admin-recipe-ai/fill-recipe-with-ai';
import { getRecipeAiLocalPrompt } from '../../../core/api/generated/fn/admin-recipe-ai/get-recipe-ai-local-prompt';
import { readRecipeAiLocalAnswer } from '../../../core/api/generated/fn/admin-recipe-ai/read-recipe-ai-local-answer';
import { RecipeAiDraft } from '../../../core/api/generated/models/recipe-ai-draft';
import { RECIPE_MODEL } from '../../../core/local-ai/local-models';
import { readRecipeLocally } from '../../../core/local-ai/read-recipe-locally';
import { Button } from '../../../shared/ui/button/button';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { Icon } from '../../../shared/ui/icon/icon';
import { PHOTO_ACCEPT, photoFileError } from '../../../shared/ui/image-upload/photo-file';
import { LocalModelSetup } from '../../../shared/ui/local-model-setup/local-model-setup';

const MAX_TEXT_LENGTH = 20_000;
/** Errors after which the button must be greyed out: the editor asks for the status again. */
const LASTING_ERRORS = new Set(['AI_NOT_CONFIGURED', 'AI_KEY_REFUSED', 'AI_DAILY_QUOTA']);

type Engine = 'gemini' | 'local';

const ENGINE_KEY = 'yona-recipe-ai-engine';

function storedEngine(): Engine {
  try {
    return localStorage.getItem(ENGINE_KEY) === 'local' ? 'local' : 'gemini';
  } catch {
    return 'gemini';
  }
}

/**
 * "Remplir avec l'IA": a pasted recipe and/or the photo of one, read by Gemini; or a pasted recipe
 * read by a model running in this browser. The draft read is handed to the editor, which fills the
 * form; nothing is saved here. The API's errors are shown as a toast (adminErrorsInterceptor) and
 * kept under the button.
 */
@Component({
  selector: 'yona-recipe-ai-dialog',
  imports: [Button, Dialog, Icon, LocalModelSetup],
  template: `
    <yona-dialog title="Remplir avec l'IA" subtitle="Gemini ou IA locale" [closeOnBackdrop]="!reading()" [(open)]="open">
      <div class="ai">
        <div class="ai__engines" role="group" aria-label="Quelle IA">
          <button type="button" class="pill" [attr.aria-pressed]="engine() === 'gemini'" [disabled]="reading() || !!geminiUnavailable()" (click)="chooseEngine('gemini')">Gemini</button>
          <button type="button" class="pill" [attr.aria-pressed]="engine() === 'local'" [disabled]="reading()" (click)="chooseEngine('local')">IA locale</button>
        </div>
        @if (engine() === 'gemini') {
          <p class="field__hint">
            Collez une recette (notes, message, page recopiée) ou envoyez la photo d'une recette écrite : le formulaire se
            remplit, rien n'est enregistré. Relisez tout avant d'enregistrer. N'envoyez rien de personnel : sur l'offre
            gratuite, Google peut relire ce qu'on lui envoie
          </p>
        } @else {
          <p class="field__hint">
            Collez une recette : le modèle tourne sur cet ordinateur, le texte n'est envoyé à aucun service d'IA. Plus lent
            que Gemini. Relisez tout avant d'enregistrer
          </p>
          @if (open()) {
            <yona-local-model-setup [localModel]="recipeModel" [(ready)]="localReady" />
          }
        }
        <div class="field">
          <label class="field__label" for="ai-text">Texte de la recette</label>
          <textarea
            id="ai-text"
            class="input ai__text"
            rows="6"
            [maxLength]="maxTextLength"
            placeholder="Crêpes pour 4 : 250 g de farine, 4 œufs, 50 cl de lait…"
            [disabled]="reading()"
            [value]="text()"
            (input)="text.set($any($event.target).value)"
          ></textarea>
          <span class="field__hint">{{ text().length }} / {{ maxTextLength }} caractères</span>
        </div>
        @if (engine() === 'gemini') {
        <div class="field">
          <span class="field__label">Photo (facultative)</span>
          <input #file type="file" class="visually-hidden" tabindex="-1" aria-hidden="true" [accept]="accept" (change)="choosePhoto($event)" />
          @if (photoUrl(); as url) {
            <div class="ai__photo">
              <img [src]="url" alt="Photo de la recette à lire" />
              <button yonaButton variant="ghost" type="button" [disabled]="reading()" (click)="removePhoto()">
                <svg yonaIcon="x"></svg>Retirer la photo
              </button>
            </div>
          } @else {
            <div>
              <button yonaButton variant="secondary" type="button" [disabled]="reading()" (click)="file.click()">
                <svg yonaIcon="image-up"></svg>Choisir une photo
              </button>
            </div>
          }
          <span class="field__hint">JPEG ou PNG, 10 Mo maximum : recette manuscrite, capture d'écran</span>
        </div>
        }
        @if (reading()) {
          <p class="ai__status" role="status">
            <svg yonaIcon="loader-circle" class="spin" [size]="18"></svg>
            @if (engine() === 'gemini') {
              Gemini lit la recette… Cela prend de quelques secondes à une minute
            } @else if (written() > 0) {
              Écriture de la recette… {{ written() }} caractères
            } @else {
              Chargement du modèle… Cela peut prendre quelques minutes
            }
          </p>
        } @else if (error(); as message) {
          <p class="ai__status ai__status--error" role="alert">
            <svg yonaIcon="circle-alert" [size]="18"></svg>
            {{ message }}
          </p>
        }
      </div>
      <ng-container dialogActions>
        @if (reading() && engine() === 'local') {
          <button yonaButton variant="secondary" type="button" (click)="stop()">Arrêter</button>
        } @else {
          <button yonaButton variant="secondary" type="button" [disabled]="reading()" (click)="open.set(false)">Annuler</button>
        }
        <button yonaButton type="button" [disabled]="!canRead()" (click)="read()">
          <svg yonaIcon="sparkles"></svg>{{ reading() ? 'Lecture…' : 'Remplir le formulaire' }}
        </button>
      </ng-container>
    </yona-dialog>
  `,
  styles: `
    .ai {
      display: grid;
      gap: var(--space-4);
    }

    .ai__engines {
      display: flex;
      gap: var(--space-2);
    }

    .ai__text {
      min-height: 8rem;
    }

    .ai__photo {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3);

      img {
        max-width: 12rem;
        max-height: 12rem;
        border-radius: var(--radius-md);
        object-fit: contain;
        background-color: var(--color-surface);
      }
    }

    .ai__status {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--color-text-muted);
    }

    .ai__status--error {
      color: var(--color-danger);
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
export class RecipeAiDialog {
  private readonly api = inject(Api);

  readonly open = model(false);
  /** The recipe read, for the editor to fill the form with. */
  readonly filled = output<RecipeAiDraft>();
  /** Not configured, key refused, daily quota used: the button has to be greyed out. */
  readonly unavailable = output<void>();
  /** Why Gemini cannot be used now; null when it can. */
  readonly geminiUnavailable = input<string | null>(null);

  protected readonly recipeModel = RECIPE_MODEL;
  private readonly chosenEngine = signal<Engine>(storedEngine());
  /** Gemini out of service: the local model, whatever was chosen. */
  protected readonly engine = computed<Engine>(() => (this.geminiUnavailable() ? 'local' : this.chosenEngine()));
  protected readonly localReady = signal(false);
  protected readonly written = signal(0);
  private controller: AbortController | null = null;
  protected readonly accept = PHOTO_ACCEPT;
  protected readonly maxTextLength = MAX_TEXT_LENGTH;
  protected readonly text = signal('');
  private readonly photo = signal<File | null>(null);
  protected readonly photoUrl = signal<string | null>(null);
  protected readonly reading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly canRead = computed(
    () => !this.reading() && (this.engine() === 'gemini' ? !!this.text().trim() || !!this.photo() : !!this.text().trim() && this.localReady()),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.stop();
      this.revokePhotoUrl();
    });
  }

  protected chooseEngine(engine: Engine): void {
    this.chosenEngine.set(engine);
    this.error.set(null);
    try {
      localStorage.setItem(ENGINE_KEY, engine);
    } catch {
      // Storage disabled: the choice lasts until the page is left
    }
  }

  protected stop(): void {
    this.controller?.abort();
  }

  protected choosePhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    const problem = photoFileError(file);
    if (problem) {
      this.error.set(problem);
      return;
    }
    this.revokePhotoUrl();
    this.error.set(null);
    this.photo.set(file);
    this.photoUrl.set(URL.createObjectURL(file));
  }

  protected removePhoto(): void {
    this.revokePhotoUrl();
    this.photo.set(null);
  }

  protected async read(): Promise<void> {
    this.reading.set(true);
    this.written.set(0);
    this.error.set(null);
    this.controller = new AbortController();
    try {
      const draft = this.engine() === 'gemini' ? await this.readWithGemini() : await this.readLocally(this.controller.signal);
      this.filled.emit(draft);
      this.text.set('');
      this.removePhoto();
      this.open.set(false);
    } catch (error) {
      if (this.controller.signal.aborted) {
        return;
      }
      if (!(error instanceof HttpErrorResponse)) {
        console.error(error);
        this.error.set('Le modèle n’a pas pu lire la recette : fermez les applications lourdes, puis réessayez');
        return;
      }
      const problem = error.error as { code?: string; detail?: string } | null;
      this.error.set(problem?.detail ?? 'La lecture par l’IA a échoué : réessayez dans un instant');
      if (problem?.code && LASTING_ERRORS.has(problem.code)) {
        this.unavailable.emit();
      }
    } finally {
      this.reading.set(false);
      this.controller = null;
    }
  }

  private readWithGemini(): Promise<RecipeAiDraft> {
    return this.api.invoke(fillRecipeWithAi, {
      body: { text: this.text().trim() || undefined, image: this.photo() ?? undefined },
    });
  }

  /** Read in the browser; the backend checks the answer as it does Gemini's. */
  private async readLocally(signal: AbortSignal): Promise<RecipeAiDraft> {
    const { instructions, context } = await this.api.invoke(getRecipeAiLocalPrompt);
    const answer = await readRecipeLocally(
      { instructions, message: `${context}\n\nRecette :\n${this.text().trim()}` },
      (characters) => this.written.set(characters),
      signal,
    );
    return this.api.invoke(readRecipeAiLocalAnswer, { body: { answer } });
  }

  private revokePhotoUrl(): void {
    const url = this.photoUrl();
    if (url) {
      URL.revokeObjectURL(url);
      this.photoUrl.set(null);
    }
  }
}
