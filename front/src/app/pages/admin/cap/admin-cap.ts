import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { duplicateCapEntry } from '../../../core/api/generated/fn/admin-mon-cap/duplicate-cap-entry';
import { listAdminCapEntries } from '../../../core/api/generated/fn/admin-mon-cap/list-admin-cap-entries';
import { AdminCapEntrySummary } from '../../../core/api/generated/models/admin-cap-entry-summary';
import { Toaster } from '../../../core/notifications/toaster';
import { ParisDatePipe } from '../../../shared/format/paris-date.pipe';
import { CAP_PATH } from '../../../shared/routing/links';
import { Button } from '../../../shared/ui/button/button';
import { CoverImage } from '../../../shared/ui/cover-image/cover-image';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { Icon } from '../../../shared/ui/icon/icon';
import { BLOCK_TYPES, CAP_TEMPLATES, CapTemplate } from './cap-templates';
import { Skeleton } from '../../../shared/ui/skeleton/skeleton';
import { PublicationStatusBadge } from '../publication-status/publication-status';

/** "Mon CAP": the articles, the latest first; "Nouvel article" starts from a model. */
@Component({
  selector: 'yona-admin-cap',
  imports: [Button, CoverImage, Dialog, Icon, ParisDatePipe, PublicationStatusBadge, RouterLink, Skeleton],
  template: `
    <section class="admin-section" aria-labelledby="cap-title">
      <div class="admin-section__head">
        <h2 id="cap-title">Mon CAP</h2>
        <div class="admin-section__actions">
          <a yonaButton variant="ghost" target="_blank" [routerLink]="capPath"><svg yonaIcon="external-link"></svg>Voir sur le site</a>
          <button yonaButton type="button" (click)="choosing.set(true)"><svg yonaIcon="plus"></svg>Nouvel article</button>
        </div>
      </div>
      <p class="field__hint">Les articles du CAP, sur le site du plus récent au plus ancien, chacun avec sa page</p>

      @if (entries.value(); as list) {
        @if (list.length) {
          <ul role="list" class="admin-list">
            @for (entry of list; track entry.id) {
              <li class="admin-row">
                <yona-cover-image class="admin-thumb" [imageId]="entry.imageId" sizes="4rem" />
                <a class="admin-row__main article-link" [routerLink]="[entry.id]">
                  <span class="admin-row__title">{{ entry.title }}</span>
                  <span class="admin-row__meta">
                    {{ entry.happenedOn | parisDate }} · {{ entry.blockCount }} bloc{{ entry.blockCount > 1 ? 's' : '' }} ·
                    {{ entry.style === 'NOTEBOOK' ? 'Carnet' : 'Classique' }}
                    <yona-publication-status [status]="entry.status" [scheduledAt]="entry.scheduledAt" [failure]="entry.publicationFailure" />
                    @if (entry.featured) {
                      <span class="badge badge--featured">Coup de cœur</span>
                    }
                  </span>
                </a>
                <div class="admin-row__actions">
                  @if (entry.status === 'PUBLISHED') {
                    <a class="icon-button" target="_blank" [routerLink]="[capPath, entry.slug]" [attr.aria-label]="'Voir ' + entry.title + ' sur le site'" data-tooltip="Voir sur le site">
                      <svg yonaIcon="external-link" [size]="18"></svg>
                    </a>
                  }
                  <button type="button" class="icon-button" [attr.aria-label]="'Dupliquer « ' + entry.title + ' »'" data-tooltip="Dupliquer" [disabled]="duplicating() === entry.id" (click)="duplicate(entry)">
                    <svg yonaIcon="copy-plus" [size]="18"></svg>
                  </button>
                  <a class="icon-button" [routerLink]="[entry.id]" [attr.aria-label]="'Modifier ' + entry.title" data-tooltip="Modifier"><svg yonaIcon="pencil" [size]="18"></svg></a>
                </div>
              </li>
            }
          </ul>
        } @else {
          <p class="admin-empty">Aucun article pour le moment : « Nouvel article » pour écrire le premier</p>
        }
      } @else if (entries.isLoading()) {
        <yona-skeleton kind="rows" [count]="4" />
      }
    </section>

    <yona-dialog title="Nouvel article" subtitle="Choisissez un modèle, ou laissez l'IA écrire : les blocs se changent ensuite" size="lg" [(open)]="choosing">
      <ul role="list" class="templates">
        @for (template of templates; track template.id) {
          <li>
            <button type="button" class="template" (click)="start(template)">
              <span class="template__name">{{ template.name }}</span>
              <span class="template__purpose">{{ template.purpose }}</span>
              <span class="template__blocks" aria-hidden="true">
                @for (type of blockTypes(template); track $index) {
                  <span class="template__block"><svg [yonaIcon]="type.icon" [size]="14"></svg>{{ type.label }}</span>
                } @empty {
                  <span class="template__block template__block--empty">Aucun bloc</span>
                }
              </span>
            </button>
          </li>
        }
      </ul>
      <button type="button" class="template template--ai" (click)="startWithAi()">
        <svg yonaIcon="sparkles" [size]="22" [strokeWidth]="1.75"></svg>
        <span class="template__ai-text">
          <span class="template__name">Écrire avec l'IA</span>
          <span class="template__purpose">À partir de vos notes, tapées ou en photo : l'IA propose le titre et les blocs, vous ajoutez les photos</span>
        </span>
      </button>
    </yona-dialog>
  `,
  styles: `
    .article-link {
      color: inherit;
      text-decoration: none;
    }

    .templates {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
      gap: var(--space-3);
    }

    .template {
      display: grid;
      gap: var(--space-2);
      align-content: start;
      width: 100%;
      height: 100%;
      padding: var(--space-4);
      border: 2px solid var(--color-line);
      border-radius: var(--radius-lg);
      background-color: var(--color-bg);
      text-align: start;
      transition: border-color var(--duration-base) var(--ease-out);

      &:hover,
      &:focus-visible {
        border-color: var(--color-accent);
      }
    }

    .template__name {
      font-family: var(--font-display);
      font-size: var(--text-xl);
    }

    .template__purpose {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    .template__blocks {
      display: grid;
      gap: var(--space-1);
      margin-top: var(--space-2);
    }

    .template__block {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-sm);
      background-color: var(--color-surface);
      font-size: var(--text-xs);
      font-weight: 600;
    }

    .template__block--empty {
      color: var(--color-text-muted);
    }

    .template--ai {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      margin-top: var(--space-3);
      border-style: dashed;

      > svg {
        flex: none;
        color: var(--color-accent);
      }
    }

    .template__ai-text {
      display: grid;
      gap: var(--space-1);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminCap {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);

  protected readonly capPath = CAP_PATH;
  protected readonly templates = CAP_TEMPLATES;
  protected readonly entries = resource({ loader: () => this.api.invoke(listAdminCapEntries) });
  protected readonly choosing = signal(false);
  /** The article being copied: its button waits. */
  protected readonly duplicating = signal<number | null>(null);

  protected blockTypes(template: CapTemplate) {
    return template.blocks().map((block) => BLOCK_TYPES.find((type) => type.type === block.type)!);
  }

  protected start(template: CapTemplate): void {
    this.choosing.set(false);
    void this.router.navigate(['/admin/mon-cap/nouveau'], { queryParams: { modele: template.id } });
  }

  /** A new draft with the same date, style, photos and blocks, opened in the editor. */
  protected async duplicate(entry: AdminCapEntrySummary): Promise<void> {
    this.duplicating.set(entry.id);
    const copy = await attempt(this.api.invoke(duplicateCapEntry, { id: entry.id }));
    this.duplicating.set(null);
    if (copy.ok) {
      this.toaster.success(`Copie créée en brouillon : « ${copy.value.title} »`);
      await this.router.navigate(['/admin/mon-cap', copy.value.id]);
    }
  }

  /** An empty article, the window of the AI open: it lays the blocks down itself. */
  protected startWithAi(): void {
    this.choosing.set(false);
    void this.router.navigate(['/admin/mon-cap/nouveau'], { queryParams: { modele: 'vide', ia: '' } });
  }
}
