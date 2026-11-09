import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { uploadImage } from '../../../core/api/generated/fn/admin-images/upload-image';
import { createObservation } from '../../../core/api/generated/fn/admin-mon-cap/create-observation';
import { deleteObservation } from '../../../core/api/generated/fn/admin-mon-cap/delete-observation';
import { listAdminObservations } from '../../../core/api/generated/fn/admin-mon-cap/list-admin-observations';
import { updateObservation } from '../../../core/api/generated/fn/admin-mon-cap/update-observation';
import { searchRecipes } from '../../../core/api/generated/fn/admin-recipes/search-recipes';
import { GalleryImage } from '../../../core/api/generated/models/gallery-image';
import { ObservationResponse } from '../../../core/api/generated/models/observation-response';
import { RecipeAdminSummary } from '../../../core/api/generated/models/recipe-admin-summary';
import { ImageUploads } from '../../../core/api/image-uploads';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { ParisDatePipe } from '../../../shared/format/paris-date.pipe';
import { OBSERVATIONS_PATH } from '../../../shared/routing/links';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';
import { ImageUpload } from '../../../shared/ui/image-upload/image-upload';
import { Pagination } from '../../../shared/ui/pagination/pagination';
import { Select, SelectOption } from '../../../shared/ui/select/select';

const PAGE_SIZE = 20;
const MAX_BODY_LENGTH = 5000;
const NO_RECIPE = 0;

/** Today in Paris, as the date field wants it. */
function today(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
}

/** "Mes observations": what was noticed while cooking, about a recipe or about none ("Pas de recette"). */
@Component({
  selector: 'yona-admin-observations',
  imports: [Button, Icon, ImageUpload, Pagination, ParisDatePipe, RouterLink, Select],
  template: `
    <section class="admin-section" aria-labelledby="observations-title">
      <div class="admin-section__head">
        <h2 id="observations-title">Observations</h2>
        <a yonaButton variant="ghost" target="_blank" [routerLink]="observationsPath"><svg yonaIcon="external-link"></svg>Voir sur le site</a>
      </div>
      <p class="field__hint">Une observation liée à une recette s'affiche aussi sur la page de cette recette</p>

      <form class="admin-panel" (submit)="save($event)">
        <h3>{{ editing() ? 'Modifier « ' + editing()!.title + ' »' : 'Ajouter une observation' }}</h3>
        <div class="field">
          <label class="field__label" for="observation-title-input">Titre</label>
          <input id="observation-title-input" class="input" maxlength="150" placeholder="Ma crème a tranché" [value]="title()" (input)="title.set($any($event.target).value)" />
        </div>
        <div class="field">
          <label class="field__label" for="observation-date">Date</label>
          <input id="observation-date" class="input" type="date" [value]="date()" (input)="date.set($any($event.target).value)" />
        </div>
        <div class="field">
          <span class="field__label">Recette</span>
          <yona-select label="Recette" [options]="recipeOptions()" [value]="recipeId()" (valueChange)="recipeId.set($event ?? noRecipe)" />
        </div>
        <div class="field">
          <label class="field__label" for="observation-body">Texte</label>
          <textarea id="observation-body" class="input" rows="6" [maxLength]="maxBodyLength" [value]="body()" (input)="body.set($any($event.target).value)"></textarea>
          <span class="field__hint">Markdown accepté. {{ body().length }} / {{ maxBodyLength }} caractères</span>
        </div>
        <div class="field">
          <span class="field__label">Photo (facultative)</span>
          <yona-image-upload
            [imageId]="imageId()"
            [aiSuggestion]="title()"
            [progress]="uploadProgress()"
            (fileChosen)="upload($event)"
            (galleryImageChosen)="imageId.set($event)"
            (removed)="imageId.set(null)"
            (retouched)="imageId.set($event)"
          />
        </div>
        <label class="checkbox-field">
          <input type="checkbox" [checked]="published()" (change)="published.set($any($event.target).checked)" />
          Publiée sur le site
        </label>
        <div class="admin-toolbar">
          <button yonaButton type="submit" [disabled]="saving()"><svg yonaIcon="save"></svg>{{ editing() ? 'Enregistrer' : 'Ajouter' }}</button>
          @if (editing()) {
            <button yonaButton variant="ghost" type="button" (click)="cancel()">Annuler</button>
          }
        </div>
      </form>

      @if (observations.value(); as result) {
        @if (result.content.length) {
          <ul role="list" class="admin-list">
            @for (observation of result.content; track observation.id) {
              <li class="admin-row">
                <span class="admin-row__main">
                  <span class="admin-row__title">{{ observation.title }}</span>
                  <span class="admin-row__meta">
                    {{ observation.observedOn | parisDate }} · {{ observation.recipe?.title ?? 'Pas de recette' }}
                    @if (!observation.published) {
                      <span class="badge badge--draft">Brouillon</span>
                    }
                  </span>
                </span>
                <div class="admin-row__actions">
                  <button type="button" class="icon-button" [attr.aria-label]="'Modifier ' + observation.title" (click)="edit(observation)"><svg yonaIcon="pencil" [size]="18"></svg></button>
                  <button type="button" class="icon-button icon-button--danger" [attr.aria-label]="'Supprimer ' + observation.title" (click)="remove(observation)"><svg yonaIcon="trash" [size]="18"></svg></button>
                </div>
              </li>
            }
          </ul>
          @if (result.totalPages > 1) {
            <yona-pagination buttons [page]="page() + 1" [totalPages]="result.totalPages" (pageChange)="page.set($event - 1)" />
          }
        } @else {
          <p class="admin-empty">Aucune observation pour le moment</p>
        }
      } @else if (observations.isLoading()) {
        <p class="admin-empty">Chargement…</p>
      }
    </section>
  `,
  styles: `
    h3 {
      font-size: var(--text-lg);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminObservations {
  private readonly api = inject(Api);
  private readonly imageUploads = inject(ImageUploads);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  protected readonly observationsPath = OBSERVATIONS_PATH;
  protected readonly maxBodyLength = MAX_BODY_LENGTH;
  protected readonly noRecipe = NO_RECIPE;
  protected readonly page = signal(0);
  protected readonly observations = resource({
    params: () => this.page(),
    loader: ({ params }) => this.api.invoke(listAdminObservations, { page: params, size: PAGE_SIZE }),
  });
  private readonly recipes = resource({ loader: () => this.loadRecipes() });
  protected readonly recipeOptions = computed<SelectOption<number>[]>(() => [
    { value: NO_RECIPE, label: 'Pas de recette' },
    ...(this.recipes.value() ?? []).map((recipe) => ({
      value: recipe.id,
      label: recipe.status === 'PUBLISHED' ? recipe.title : `${recipe.title} (non publiée)`,
    })),
  ]);

  /** The observation being changed; null while adding a new one. */
  protected readonly editing = signal<ObservationResponse | null>(null);
  protected readonly title = signal('');
  protected readonly date = signal(today());
  protected readonly recipeId = signal<number>(NO_RECIPE);
  protected readonly body = signal('');
  protected readonly imageId = signal<string | null>(null);
  protected readonly published = signal(true);
  protected readonly saving = signal(false);
  /** Share of a new photo sent (0 to 1) while it uploads. */
  protected readonly uploadProgress = signal<number | null>(null);

  /** A new photo goes to the gallery, and the observation shows it. */
  protected async upload(file: File): Promise<void> {
    this.uploadProgress.set(0);
    const sent = await attempt(this.imageUploads.send<GalleryImage>(uploadImage.PATH, file, (share) => this.uploadProgress.set(share), 'POST'));
    this.uploadProgress.set(null);
    if (sent.ok) {
      this.imageId.set(sent.value.id);
    }
  }

  protected edit(observation: ObservationResponse): void {
    this.editing.set(observation);
    this.title.set(observation.title);
    this.date.set(observation.observedOn);
    this.recipeId.set(observation.recipe?.id ?? NO_RECIPE);
    this.body.set(observation.body);
    this.imageId.set(observation.imageId ?? null);
    this.published.set(observation.published);
  }

  protected cancel(): void {
    this.editing.set(null);
    this.title.set('');
    this.date.set(today());
    this.recipeId.set(NO_RECIPE);
    this.body.set('');
    this.imageId.set(null);
    this.published.set(true);
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.title().trim() || !this.date() || !this.body().trim()) {
      this.toaster.error('Donnez un titre, une date et un texte à cette observation');
      return;
    }
    const body = {
      title: this.title().trim(),
      body: this.body().trim(),
      observedOn: this.date(),
      imageId: this.imageId() ?? undefined,
      recipeId: this.recipeId() === NO_RECIPE ? undefined : this.recipeId(),
      published: this.published(),
    };
    const editing = this.editing();
    this.saving.set(true);
    const saved = await attempt(
      editing ? this.api.invoke(updateObservation, { id: editing.id, body }) : this.api.invoke(createObservation, { body }),
    );
    this.saving.set(false);
    if (saved.ok) {
      this.toaster.success(editing ? 'Observation enregistrée' : 'Observation ajoutée');
      this.cancel();
      this.observations.reload();
    }
  }

  protected async remove(observation: ObservationResponse): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Mettre cette observation à la corbeille ?',
      message: `« ${observation.title} » disparaît du site et reste 30 jours dans la corbeille, d'où elle peut être restaurée`,
      confirmLabel: 'Mettre à la corbeille',
    });
    if (confirmed && (await attempt(this.api.invoke(deleteObservation, { id: observation.id }))).ok) {
      this.toaster.success('Observation mise à la corbeille');
      if (this.editing()?.id === observation.id) {
        this.cancel();
      }
      this.observations.reload();
    }
  }

  private async loadRecipes(): Promise<RecipeAdminSummary[]> {
    const recipes: RecipeAdminSummary[] = [];
    for (let page = 0, totalPages = 1; page < totalPages; page++) {
      const result = await this.api.invoke(searchRecipes, { page, size: 50, sort: ['title,asc'] });
      recipes.push(...result.content);
      totalPages = result.totalPages;
    }
    return recipes;
  }
}
