import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, model, output, resource, signal, untracked } from '@angular/core';
import { Api } from '../../../core/api/generated/api';
import { getClaudeAvailability } from '../../../core/api/generated/fn/admin-claude/get-claude-availability';
import { getCapAiLocalPrompt } from '../../../core/api/generated/fn/admin-mon-cap-ai/get-cap-ai-local-prompt';
import { readCapAiLocalAnswer } from '../../../core/api/generated/fn/admin-mon-cap-ai/read-cap-ai-local-answer';
import { writeCapArticleWithAi } from '../../../core/api/generated/fn/admin-mon-cap-ai/write-cap-article-with-ai';
import { CapAiDraft } from '../../../core/api/generated/models/cap-ai-draft';
import { AiEngine, claudeName, engineInUse, localStages, storeEngine, storedEngine } from '../../../core/local-ai/ai-engine';
import { AiStage, isPhoneOrTablet } from '../../../core/local-ai/local-ai-format';
import { RECIPE_MODEL } from '../../../core/local-ai/local-models';
import { RecipeReaderProgress, readRecipeLocally } from '../../../core/local-ai/read-recipe-locally';
import { AiEngines } from '../../../shared/ui/ai-engines/ai-engines';
import { Button } from '../../../shared/ui/button/button';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { Dictation } from '../../../shared/ui/dictation/dictation';
import { Icon } from '../../../shared/ui/icon/icon';
import { Segmented } from '../../../shared/ui/segmented/segmented';
import { PHOTO_ACCEPT, photoFileError } from '../../../shared/ui/image-upload/photo-file';
import { LocalAiProgress } from '../../../shared/ui/local-ai-progress/local-ai-progress';
import { LocalModelSetup } from '../../../shared/ui/local-model-setup/local-model-setup';
import { CAP_AI_EXAMPLES, CAP_AI_FORMS, CapAiForm } from './cap-ai';

const MAX_TEXT_LENGTH = 20_000;
/** Errors after which Gemini must be greyed out: the editor asks for the status again. */
const LASTING_ERRORS = new Set(['AI_NOT_CONFIGURED', 'AI_KEY_REFUSED', 'AI_DAILY_QUOTA']);
/** The same for Claude: the window asks for its status again. */
const LASTING_CLAUDE_ERRORS = new Set(['CLAUDE_NOT_CONFIGURED', 'CLAUDE_KEY_REFUSED', 'CLAUDE_NO_CREDIT']);

const LOCAL_WORK = {
  reading: 'Lecture des notes',
  readingDetail: 'Le modèle lit les notes et les consignes du site',
  writing: 'Écriture de l’article',
  writingDetail: 'Les blocs se rempliront à la fin',
};

/**
 * "Écrire avec l'IA", in an article of "Mon CAP": notes typed or photographed, written into a title
 * and blocks by Gemini, or by the model of the browser (typed notes only). The article written is
 * handed to the editor; nothing is saved here. Buttons put example notes in the field, one per shape.
 */
@Component({
  selector: 'yona-cap-ai-dialog',
  imports: [AiEngines, Button, Dialog, Dictation, Icon, LocalAiProgress, LocalModelSetup, Segmented],
  template: `
    <yona-dialog title="Écrire avec l'IA" [subtitle]="subtitle()" [closeOnBackdrop]="!writing()" [(open)]="open">
      <div class="ai">
        <yona-ai-engines
          [engine]="engine()"
          [disabled]="writing()"
          [geminiUnavailable]="!!geminiUnavailable()"
          [claude]="claude.value() ?? null"
          onlineReads="Notes tapées ou en photo"
          localReads="Notes tapées seulement"
          (chosen)="chooseEngine($event)"
        />
        @if (engine() === 'claude') {
          <p class="field__hint">
            Écrivez ou dictez vos notes en vrac, ou envoyez la photo de vos notes : Claude propose un titre et les blocs, rien
            n'est enregistré. Payant : quelques centimes par article, sur le compte Anthropic du site. Relisez tout et ajoutez
            vos photos avant d'enregistrer
          </p>
        } @else if (engine() === 'gemini') {
          <p class="field__hint">
            Écrivez vos notes en vrac (ce que vous avez fait, ce qui a marché ou raté, ce qu'on vous a dit) ou envoyez la photo de
            vos notes : l'IA propose un titre et les blocs, rien n'est enregistré. Elle n'invente rien, mais relisez tout et
            ajoutez vos photos avant d'enregistrer. N'envoyez rien de personnel : sur l'offre gratuite, Google peut relire ce qu'on
            lui envoie
          </p>
        } @else {
          <p class="field__hint">
            Écrivez vos notes en vrac : le modèle tourne sur cet ordinateur, rien n'est envoyé à Google ni à un autre service d'IA.
            Plus lent que Gemini, et l'ordinateur peut ralentir pendant l'écriture. Relisez tout et ajoutez vos photos avant
            d'enregistrer
          </p>
          @if (open()) {
            <yona-local-model-setup [localModel]="localModel" [(ready)]="localReady" />
          }
        }

        <fieldset class="field forms">
          <legend class="field__label">Forme de l'article</legend>
          <div class="segmented" yonaSegmented role="radiogroup" aria-label="Forme de l'article">
            @for (option of forms; track option.form) {
              <label class="segmented__option" [class.is-chosen]="form() === option.form">
                <input type="radio" name="cap-ai-form" [value]="option.form" [checked]="form() === option.form" [disabled]="writing()" (change)="form.set(option.form)" />
                {{ option.label }}
              </label>
            }
          </div>
        </fieldset>

        <div class="field">
          <label class="field__label" for="cap-ai-text">Vos notes</label>
          <yona-dictation [disabled]="writing()" (transcribed)="addDictation($event)" />
          <!-- Only on an empty field: never in place of notes already typed -->
          @if (!text()) {
            <div class="examples" role="group" aria-label="Exemples de notes">
              <span class="field__hint">Essayer avec un exemple :</span>
              @for (example of examples; track example.label) {
                <button type="button" class="example" [disabled]="writing()" (click)="useExample(example)">
                  <svg yonaIcon="sparkles" [size]="14"></svg>{{ example.label }}
                </button>
              }
            </div>
          }
          <textarea
            id="cap-ai-text"
            class="input ai__text"
            rows="10"
            [maxLength]="maxTextLength"
            placeholder="Examen blanc ce matin : tarte aux pommes et choux. Ce qui a marché, ce qui a raté, ce que la formatrice a dit…"
            [disabled]="writing()"
            [value]="text()"
            (input)="text.set($any($event.target).value)"
          ></textarea>
          <span class="field__hint">{{ text().length }} / {{ maxTextLength }} caractères</span>
        </div>

        @if (engine() !== 'local') {
          <div class="field">
            <span class="field__label">Photo de vos notes (facultative)</span>
            <input #file type="file" class="visually-hidden" tabindex="-1" aria-hidden="true" [accept]="accept" (change)="choosePhoto($event)" />
            @if (photoUrl(); as url) {
              <div class="ai__photo">
                <img [src]="url" alt="Photo des notes à lire" />
                <button yonaButton variant="ghost" type="button" [disabled]="writing()" (click)="removePhoto()">
                  <svg yonaIcon="x"></svg>Retirer la photo
                </button>
              </div>
            } @else {
              <div>
                <button yonaButton variant="secondary" type="button" [disabled]="writing()" (click)="file.click()">
                  <svg yonaIcon="image-up"></svg>Choisir une photo
                </button>
              </div>
            }
            <span class="field__hint">JPEG ou PNG, 10 Mo maximum : notes de cours, fiche technique. Pas la photo d'une réalisation : celle-là va dans les blocs</span>
          </div>
        }

        @if (writing() && engine() === 'local') {
          <yona-local-ai-progress [stages]="localStages()" />
        } @else if (writing()) {
          <p class="ai__status" role="status">
            <svg yonaIcon="loader-circle" class="spin" [size]="18"></svg>
            {{ onlineName() }} écrit l'article… Cela prend de quelques secondes à une minute
          </p>
        } @else if (error(); as message) {
          <p class="ai__status ai__status--error" role="alert">
            <svg yonaIcon="circle-alert" [size]="18"></svg>
            {{ message }}
          </p>
        }
      </div>
      <ng-container dialogActions>
        @if (writing() && engine() === 'local') {
          <button yonaButton variant="secondary" type="button" (click)="stop()">Arrêter</button>
        } @else {
          <button yonaButton variant="secondary" type="button" [disabled]="writing()" (click)="open.set(false)">Annuler</button>
        }
        <button yonaButton type="button" [disabled]="!canWrite()" (click)="write()">
          <svg yonaIcon="sparkles"></svg>{{ writing() ? 'Écriture…' : 'Écrire l’article' }}
        </button>
      </ng-container>
    </yona-dialog>
  `,
  styles: `
    @use 'mixins' as m;

    .ai {
      display: grid;
      gap: var(--space-4);
    }

    .forms {
      margin: 0;
      padding: 0;
      border: 0;
    }

    // Pills of styles/_segmented.scss; on two lines on a phone, the corners less round
    .segmented {
      border-radius: var(--radius-lg);
    }

    .ai__text {
      min-height: 11rem;
    }

    .examples {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
    }

    .example {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1) var(--space-3);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-pill);
      background-color: var(--color-surface);
      color: var(--color-text);
      font-size: var(--text-sm);
      font-weight: 600;
      cursor: pointer;
      transition: border-color var(--duration-base) var(--ease-out);

      svg {
        color: var(--color-accent);
      }

      &:hover:not(:disabled),
      &:focus-visible {
        border-color: var(--color-accent);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
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
export class CapAiDialog {
  private readonly api = inject(Api);

  readonly open = model(false);
  /** The shape chosen when the window opens: the model of "Nouvel article", or the AI's choice. */
  readonly initialForm = input<CapAiForm>('AUTO');
  /** The article written, for the editor to fill the blocks with. */
  readonly written = output<CapAiDraft>();
  /** Not configured, key refused, daily quota used: Gemini has to be greyed out. */
  readonly unavailable = output<void>();
  /** Why Gemini cannot be used now; null when it can. */
  readonly geminiUnavailable = input<string | null>(null);

  protected readonly localModel = RECIPE_MODEL;
  protected readonly onPhone = isPhoneOrTablet();
  protected readonly forms = CAP_AI_FORMS;
  protected readonly examples = CAP_AI_EXAMPLES;
  private readonly chosenEngine = signal<AiEngine>(storedEngine());
  /** Whether Claude can be chosen, and its model: asked when the window is created. */
  protected readonly claude = resource({ loader: () => this.api.invoke(getClaudeAvailability) });
  protected readonly engine = computed(() =>
    engineInUse(this.chosenEngine(), { gemini: !this.geminiUnavailable(), claude: !!this.claude.value()?.available, onPhone: this.onPhone }),
  );
  protected readonly onlineName = computed(() => (this.engine() === 'claude' ? claudeName(this.claude.value()?.model) : 'Gemini'));
  protected readonly subtitle = computed(() => {
    switch (this.engine()) {
      case 'claude':
        return `${this.onlineName()} d’Anthropic, en ligne`;
      case 'gemini':
        return 'Gemini de Google, en ligne';
      default:
        return `${this.localModel.name}, sur cet ordinateur`;
    }
  });
  protected readonly localReady = signal(false);
  private readonly localProgress = signal<RecipeReaderProgress>({ type: 'files', share: 0 });
  protected readonly localStages = computed<AiStage[]>(() => localStages(this.localProgress(), LOCAL_WORK));
  private controller: AbortController | null = null;
  protected readonly accept = PHOTO_ACCEPT;
  protected readonly maxTextLength = MAX_TEXT_LENGTH;
  protected readonly form = signal<CapAiForm>('AUTO');
  protected readonly text = signal('');
  private readonly photo = signal<File | null>(null);
  protected readonly photoUrl = signal<string | null>(null);
  protected readonly writing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly canWrite = computed(
    () => !this.writing() && (this.engine() !== 'local' ? !!this.text().trim() || !!this.photo() : !!this.text().trim() && this.localReady()),
  );

  constructor() {
    // Each opening starts from the shape of the article's model, until changed
    effect(() => {
      if (this.open()) {
        const form = this.initialForm();
        untracked(() => this.form.set(form));
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.stop();
      this.revokePhotoUrl();
    });
  }

  protected chooseEngine(engine: AiEngine): void {
    this.chosenEngine.set(engine);
    this.error.set(null);
    storeEngine(engine);
  }

  /** What was dictated, after what was typed. */
  protected addDictation(dictated: string): void {
    this.text.update((text) => (text.trim() ? `${text.trimEnd()}\n${dictated}` : dictated).slice(0, MAX_TEXT_LENGTH));
  }

  protected useExample(example: (typeof CAP_AI_EXAMPLES)[number]): void {
    this.text.set(example.notes);
    this.form.set(example.form);
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

  protected async write(): Promise<void> {
    this.writing.set(true);
    this.localProgress.set({ type: 'files', share: 0 });
    this.error.set(null);
    this.controller = new AbortController();
    try {
      const draft = this.engine() === 'local' ? await this.writeLocally(this.controller.signal) : await this.writeOnline();
      this.written.emit(draft);
      this.text.set('');
      this.removePhoto();
      this.open.set(false);
    } catch (error) {
      if (this.controller.signal.aborted) {
        return;
      }
      if (!(error instanceof HttpErrorResponse)) {
        console.error(error);
        this.error.set('Le modèle n’a pas pu écrire l’article : fermez les applications lourdes, puis réessayez');
        return;
      }
      const problem = error.error as { code?: string; detail?: string } | null;
      this.error.set(problem?.detail ?? 'L’écriture par l’IA a échoué : réessayez dans un instant');
      if (problem?.code && LASTING_ERRORS.has(problem.code)) {
        this.unavailable.emit();
      }
      if (problem?.code && LASTING_CLAUDE_ERRORS.has(problem.code)) {
        this.claude.reload();
      }
    } finally {
      this.writing.set(false);
      this.controller = null;
    }
  }

  private writeOnline(): Promise<CapAiDraft> {
    return this.api.invoke(writeCapArticleWithAi, {
      body: {
        text: this.text().trim() || undefined,
        image: this.photo() ?? undefined,
        form: this.form(),
        engine: this.engine() === 'claude' ? 'CLAUDE' : 'GEMINI',
      },
    });
  }

  /** Written in the browser (the worker of the recipes: it only follows the instructions); checked by the backend as Gemini's. */
  private async writeLocally(signal: AbortSignal): Promise<CapAiDraft> {
    const { instructions, message } = await this.api.invoke(getCapAiLocalPrompt, { body: { text: this.text().trim(), form: this.form() } });
    const answer = await readRecipeLocally({ instructions, message }, (progress) => this.localProgress.set(progress), signal);
    return this.api.invoke(readCapAiLocalAnswer, { body: { answer } });
  }

  private revokePhotoUrl(): void {
    const url = this.photoUrl();
    if (url) {
      URL.revokeObjectURL(url);
      this.photoUrl.set(null);
    }
  }
}
