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

/** "Essayer avec un exemple": parts, quantities, times and a mold, to see what the AI fills in. */
const EXAMPLE_RECIPE = `Tarte aux pommes et caramel au beurre salé, pour 8 personnes.
Préparation 30 min, repos 1 h au frigo, cuisson 40 min à 180 °C.
Moule rond de 26 cm.

Pour la pâte : 250 g de farine, 125 g de beurre froid, 80 g de sucre glace, 1 œuf, 1 pincée de sel.
Pour le caramel : 150 g de sucre, 60 g de beurre demi-sel, 20 cl de crème liquide.
Pour la garniture : 6 pommes, 1 sachet de sucre vanillé.

Mélange la farine, le sucre glace et le sel. Ajoute le beurre en morceaux et sable du bout des doigts. Incorpore l'œuf puis forme une boule. Laisse reposer 1 heure au frigo.
Fais fondre le sucre à sec dans une casserole jusqu'à obtenir un caramel ambré. Ajoute le beurre puis la crème chaude en remuant. Laisse tiédir.
Étale la pâte et fonce le moule. Pèle les pommes et coupe-les en fines lamelles. Dispose-les en rosace et saupoudre de sucre vanillé.
Enfourne 40 minutes à 180 °C. Verse le caramel sur la tarte à la sortie du four.

Astuce : encore meilleure tiède, avec une boule de glace à la vanille.`;

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
    <yona-dialog title="Remplir avec l'IA" [subtitle]="engine() === 'gemini' ? 'Gemini, de Google, en ligne' : recipeModel.name + ', sur cet ordinateur'" [closeOnBackdrop]="!reading()" [(open)]="open">
      <div class="ai">
        <div class="ai__engines" role="group" aria-label="Quelle IA utiliser">
          <button type="button" class="engine" [attr.aria-pressed]="engine() === 'gemini'" [disabled]="reading() || !!geminiUnavailable()" (click)="chooseEngine('gemini')">
            <span class="engine__name">Gemini</span>
            <span class="engine__detail">Google, en ligne. Texte ou photo</span>
          </button>
          <button type="button" class="engine" [attr.aria-pressed]="engine() === 'local'" [disabled]="reading()" (click)="chooseEngine('local')">
            <span class="engine__name">IA locale</span>
            <span class="engine__detail">{{ recipeModel.name }}, sur cet ordinateur. Texte seulement</span>
          </button>
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
            que Gemini. Pour lire une photo, choisissez Gemini. Relisez tout avant d'enregistrer
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
          <div class="ai__below-text">
            <span class="field__hint">{{ text().length }} / {{ maxTextLength }} caractères</span>
            <!-- Only on an empty field: never in place of a recipe already pasted -->
            @if (!text()) {
              <button yonaButton variant="ghost" type="button" [disabled]="reading()" (click)="text.set(example)">
                <svg yonaIcon="sparkles"></svg>Essayer avec un exemple
              </button>
            }
          </div>
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
          <span class="field__hint">JPEG ou PNG, 10 Mo maximum : recette manuscrite, capture d'écran. Une photo est toujours lue par Gemini, de Google</span>
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
              Chargement de {{ recipeModel.name }}… Cela peut prendre quelques minutes
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
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
      gap: var(--space-2);
    }

    .engine {
      display: grid;
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
      font-weight: 600;
    }

    .engine__detail {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    .ai__text {
      min-height: 8rem;
    }

    .ai__below-text {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
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
  protected readonly example = EXAMPLE_RECIPE;
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
