import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { parisDateTime } from '../../../shared/format/paris-time';
import { Icon } from '../../../shared/ui/icon/icon';
import { IconName } from '../../../shared/ui/icon/icons';

/** As the API holds it: a recipe's or an article's. */
export type ApiPublicationStatus = 'DRAFT' | 'PUBLISHED' | 'FAILED';

/**
 * As the back-office shows it: a draft with a time of publication is "Programmé", a status of its
 * own for the admin, though still a draft for the API (DRAFT with a scheduledAt).
 */
export type PublicationStatus = ApiPublicationStatus | 'SCHEDULED';

export function shownStatus(item: { status: ApiPublicationStatus; scheduledAt?: string | null }): PublicationStatus {
  return item.status === 'DRAFT' && item.scheduledAt ? 'SCHEDULED' : item.status;
}

/** The colour of each status (.badge--… of admin-layout.scss): grey draft, blue scheduled, green published, red failure. */
const LOOKS: Record<PublicationStatus, { badge: string; icon?: IconName; label: string; feminine: string }> = {
  DRAFT: { badge: 'badge--draft', label: 'Brouillon', feminine: 'Brouillon' },
  SCHEDULED: { badge: 'badge--scheduled', icon: 'calendar-clock', label: 'Programmé', feminine: 'Programmée' },
  PUBLISHED: { badge: 'badge--published', label: 'Publié', feminine: 'Publiée' },
  FAILED: { badge: 'badge--failed', icon: 'triangle-alert', label: 'Échec', feminine: 'Échec' },
};

/** "Publiée" for a recipe, "Publié" for an article. */
export function statusLabel(status: PublicationStatus, feminine = false): string {
  return feminine ? LOOKS[status].feminine : LOOKS[status].label;
}

/**
 * The status of a recipe or an article, in its colour, in the lists of the back-office: a scheduled
 * one says when; a failed one, when it should have been and why (on hover).
 * <yona-publication-status [status]="recipe.status" [scheduledAt]="recipe.scheduledAt" feminine />
 */
@Component({
  selector: 'yona-publication-status',
  imports: [Icon],
  template: `
    @let status = shown();
    <span class="badge" [class]="'badge ' + look().badge">
      @if (look().icon; as icon) {
        <svg [yonaIcon]="icon" [size]="12"></svg>
      }
      {{ feminine() ? look().feminine : look().label }}
      @if (status === 'SCHEDULED' && scheduledAt(); as at) {
        · {{ when(at) }}
      }
    </span>
    @if (status === 'FAILED' && scheduledAt(); as at) {
      <span class="badge badge--failed-time" [title]="failure() ?? ''">
        <svg yonaIcon="calendar-clock" [size]="12"></svg>Prévu{{ feminine() ? 'e' : '' }} {{ when(at) }}
      </span>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicationStatusBadge {
  readonly status = input.required<ApiPublicationStatus>();
  readonly scheduledAt = input<string | null | undefined>(null);
  /** Why a failed one was not published. */
  readonly failure = input<string | null | undefined>(null);
  /** A recipe: "Publiée", "Programmée". */
  readonly feminine = input(false, { transform: booleanAttribute });

  protected readonly shown = computed(() => shownStatus({ status: this.status(), scheduledAt: this.scheduledAt() }));
  protected readonly look = computed(() => LOOKS[this.shown()]);
  protected readonly when = parisDateTime;
}
