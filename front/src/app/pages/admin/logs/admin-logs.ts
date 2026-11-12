import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { archiveErrorLog } from '../../../core/api/generated/fn/admin-error-log/archive-error-log';
import { eraseErrorLog } from '../../../core/api/generated/fn/admin-error-log/erase-error-log';
import { getErrorLogSummary } from '../../../core/api/generated/fn/admin-error-log/get-error-log-summary';
import { listErrorLog } from '../../../core/api/generated/fn/admin-error-log/list-error-log';
import { ErrorLogLine } from '../../../core/api/generated/models/error-log-line';
import { ErrorLogSummary } from '../../../core/api/generated/models/error-log-summary';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { parisDateTime } from '../../../shared/format/paris-time';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';
import { InfiniteList } from '../../../shared/ui/infinite-scroll/infinite-list';
import { InfiniteScroll } from '../../../shared/ui/infinite-scroll/infinite-scroll';
import { Segmented } from '../../../shared/ui/segmented/segmented';
import { Select, SelectOption } from '../../../shared/ui/select/select';
import { Skeleton } from '../../../shared/ui/skeleton/skeleton';
import { AdminLive } from '../layout/admin-live';
import { AdminWatch } from '../layout/admin-watch';

type Level = ErrorLogLine['level'];
type Source = ErrorLogLine['source'];

const PAGE_SIZE = 30;

/** "fr.lescreationsdeyona.ai.Gemini" → "ai.Gemini": the part that says where. */
export function shortLogger(logger: string | null | undefined): string | null {
  if (!logger) {
    return null;
  }
  return logger.startsWith('fr.lescreationsdeyona.') ? logger.slice('fr.lescreationsdeyona.'.length) : logger;
}

/**
 * "Journaux": the errors and warnings of the site, the latest first (30 days). The backend's own
 * (a backup that failed, Gemini out of reach, a request gone wrong) and those of the visitors'
 * browsers (a page that broke). The same problem again adds to its count. Opening the page clears
 * the badge of the menu; the lines new since the last visit say so. A line archived (the problem
 * handled) leaves the list without being erased, and comes back to it on its own, marked "Revenue",
 * if the problem happens again.
 */
@Component({
  selector: 'yona-admin-logs',
  imports: [Button, Icon, InfiniteScroll, Segmented, Select, Skeleton],
  template: `
    <section class="admin-section" aria-labelledby="logs-title">
      <div class="admin-section__head">
        <h2 id="logs-title">Journaux</h2>
        <div class="admin-section__actions">
          <button yonaButton variant="secondary" type="button" (click)="reload()"><svg yonaIcon="refresh-cw"></svg>Actualiser</button>
          @if (!archived() && (summary()?.lines ?? 0) > 0) {
            <button yonaButton variant="secondary" type="button" (click)="archiveAll()"><svg yonaIcon="archive"></svg>Tout archiver</button>
          }
          @if ((summary()?.lines ?? 0) + (summary()?.archived ?? 0) > 0) {
            <button yonaButton variant="ghost" type="button" (click)="eraseAll()"><svg yonaIcon="trash"></svg>Tout effacer</button>
          }
        </div>
      </div>
      <p class="field__hint">
        Les erreurs et avertissements du site, 30 jours : ceux du serveur et ceux des navigateurs des visiteurs. Une même
        erreur qui revient s'ajoute à son compteur. Archivez une ligne une fois le problème traité : elle quitte la liste,
        et y revient d'elle-même si l'erreur se reproduit. Effacez-la pour l'oublier
      </p>

      @if (summary(); as counts) {
        <div class="counters">
          <div class="counter" [class.counter--alert]="counts.errorsLast24Hours > 0">
            <span class="counter__value">{{ counts.errorsLast24Hours }}</span>
            <span class="counter__label">erreur{{ counts.errorsLast24Hours > 1 ? 's' : '' }} ces dernières 24 h</span>
          </div>
          <div class="counter">
            <span class="counter__value">{{ counts.warningsLast24Hours }}</span>
            <span class="counter__label">avertissement{{ counts.warningsLast24Hours > 1 ? 's' : '' }} ces dernières 24 h</span>
          </div>
          <div class="counter">
            <span class="counter__value">{{ counts.lines }}</span>
            <span class="counter__label">ligne{{ counts.lines > 1 ? 's' : '' }} à traiter sur 30 jours</span>
          </div>
          <div class="counter">
            <span class="counter__value counter__value--small">{{ counts.lastErrorAt ? dateTime(counts.lastErrorAt) : 'Aucune' }}</span>
            <span class="counter__label">dernière erreur</span>
          </div>
        </div>
      } @else {
        <yona-skeleton kind="figures" [count]="4" />
      }

      <div class="segmented" yonaSegmented role="radiogroup" aria-label="Lignes">
        <button type="button" class="segmented__option" role="radio" [attr.aria-checked]="!archived()" (click)="archived.set(false)">
          À traiter{{ summary() ? ' (' + summary()!.lines + ')' : '' }}
        </button>
        <button type="button" class="segmented__option" role="radio" [attr.aria-checked]="archived()" (click)="archived.set(true)">
          <svg yonaIcon="archive" [size]="16"></svg>Archivées{{ summary() ? ' (' + summary()!.archived + ')' : '' }}
        </button>
      </div>

      <div class="admin-toolbar">
        <yona-select label="Gravité" [options]="levelOptions" [value]="level()" (valueChange)="level.set($event ?? 'ALL')" />
        <yona-select label="Origine" [options]="sourceOptions" [value]="source()" (valueChange)="source.set($event ?? 'ALL')" />
      </div>

      @if (lines.items().length) {
        <ul role="list" class="admin-list admin-list--infinite" [class.is-busy]="lines.isLoading()">
          @for (line of lines.items(); track line.id) {
            <li class="admin-row log" [class.is-new]="isNew(line)">
              <div class="admin-row__main">
                <span class="log__tags">
                  @if (isNew(line)) {
                    <span class="badge badge--featured">Nouveau</span>
                  }
                  @if (line.cameBack) {
                    <span class="badge badge--failed-time" data-tooltip="Archivée, puis l’erreur s’est reproduite">Revenue</span>
                  }
                  <span class="badge" [class.badge--failed]="line.level === 'ERROR'" [class.badge--scheduled]="line.level === 'WARN'">
                    {{ line.level === 'ERROR' ? 'Erreur' : 'Avertissement' }}
                  </span>
                  <span class="badge badge--draft">{{ line.source === 'BACKEND' ? 'Serveur' : 'Navigateur' }}</span>
                  @if (line.occurrences > 1) {
                    <span class="log__times">× {{ line.occurrences }}</span>
                  }
                </span>
                <span class="log__message">{{ line.message }}</span>
                <span class="admin-row__meta">
                  {{ line.occurrences > 1 ? 'Dernière fois ' : '' }}{{ dateTime(line.lastSeenAt) }}
                  @if (line.occurrences > 1) {
                    · première fois {{ dateTime(line.firstSeenAt) }}
                  }
                  @if (shortLogger(line.logger); as logger) {
                    · <code>{{ logger }}</code>
                  }
                  @if (line.page) {
                    · page <code>{{ line.page }}</code>
                  }
                  @if (line.archivedAt) {
                    · archivée {{ dateTime(line.archivedAt) }}
                  }
                </span>
                @if (line.detail) {
                  <details class="log__detail">
                    <summary>Détail technique</summary>
                    <pre>{{ line.detail }}</pre>
                  </details>
                }
              </div>
              <div class="admin-row__actions">
                <button type="button" class="icon-button" aria-label="Copier le détail" (click)="copy(line)"><svg yonaIcon="copy" [size]="18"></svg></button>
                @if (line.archivedAt) {
                  <button type="button" class="icon-button" aria-label="Remettre dans la liste" (click)="archive(line, false)"><svg yonaIcon="archive-restore" [size]="18"></svg></button>
                } @else {
                  <button type="button" class="icon-button" aria-label="Archiver : problème traité" (click)="archive(line, true)"><svg yonaIcon="archive" [size]="18"></svg></button>
                }
                <button type="button" class="icon-button icon-button--danger" aria-label="Effacer cette ligne" (click)="erase(line)"><svg yonaIcon="trash" [size]="18"></svg></button>
              </div>
            </li>
          }
        </ul>
      } @else if (lines.isEmpty()) {
        <p class="admin-empty">{{ archived() ? 'Aucune ligne archivée' : 'Rien à signaler : aucune erreur ni aucun avertissement à traiter' }}</p>
      } @else if (lines.isLoading()) {
        <yona-skeleton kind="rows" [count]="5" />
      }
      <yona-infinite-scroll skeleton="rows" [list]="lines" />
    </section>
  `,
  styles: `
    .counters {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
      gap: var(--space-3);
    }

    .counter {
      display: grid;
      gap: var(--space-1);
      padding: var(--space-4);
      border-radius: var(--radius-lg);
      background-color: var(--color-surface);
    }

    .counter--alert {
      box-shadow: inset 0 0 0 2px var(--color-danger);

      .counter__value {
        color: var(--color-danger);
      }
    }

    .counter__value {
      font-family: var(--font-display);
      font-size: var(--text-2xl);
      line-height: 1.1;
    }

    .counter__value--small {
      font-size: var(--text-base);
      font-family: inherit;
      font-weight: 700;
    }

    .counter__label {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    .admin-row.is-new {
      box-shadow:
        inset 3px 0 0 var(--color-accent),
        0 0 0 1px var(--color-line);
    }

    .log {
      align-items: flex-start;
    }

    .log__tags {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
    }

    .log__times {
      font-size: var(--text-xs);
      font-weight: 700;
      color: var(--color-text-muted);
    }

    .log__message {
      font-weight: 600;
      overflow-wrap: anywhere;
    }

    code {
      font-size: var(--text-xs);
      overflow-wrap: anywhere;
    }

    .log__detail {
      font-size: var(--text-xs);

      summary {
        width: fit-content;
        font-weight: 600;
        color: var(--color-accent-strong);
        cursor: pointer;
      }

      pre {
        max-height: 20rem;
        margin-top: var(--space-2);
        padding: var(--space-3);
        overflow: auto;
        border-radius: var(--radius-sm);
        background-color: var(--color-surface);
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminLogs {
  private readonly api = inject(Api);
  private readonly watch = inject(AdminWatch);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  protected readonly dateTime = parisDateTime;
  protected readonly shortLogger = shortLogger;
  protected readonly levelOptions: SelectOption<Level | 'ALL'>[] = [
    { value: 'ALL', label: 'Erreurs et avertissements' },
    { value: 'ERROR', label: 'Erreurs', badge: 'failed' },
    { value: 'WARN', label: 'Avertissements', badge: 'scheduled' },
  ];
  protected readonly sourceOptions: SelectOption<Source | 'ALL'>[] = [
    { value: 'ALL', label: 'Serveur et navigateurs' },
    { value: 'BACKEND', label: 'Serveur' },
    { value: 'BROWSER', label: 'Navigateurs des visiteurs' },
  ];
  protected readonly level = signal<Level | 'ALL'>('ALL');
  protected readonly source = signal<Source | 'ALL'>('ALL');
  /** The lines archived (problems handled) rather than those to handle. */
  protected readonly archived = signal(false);
  protected readonly summary = signal<ErrorLogSummary | null>(null);
  /** The last visit: what came after it is new. Kept for this visit. */
  private readonly since = signal<string | null>(null);
  protected readonly lines = new InfiniteList({
    params: () => ({ level: this.level(), source: this.source(), archived: this.archived() }),
    load: (page, { level, source, archived }) =>
      this.api.invoke(listErrorLog, {
        level: level === 'ALL' ? undefined : level,
        source: source === 'ALL' ? undefined : source,
        archived,
        page,
        size: PAGE_SIZE,
      }),
    key: (line) => line.id,
  });

  constructor() {
    void this.loadSummary(true);
    inject(AdminLive).on('LOGS', () => {
      this.reload();
      void this.watch.logsSeen();
    });
  }

  /** The first time, read before being marked seen: the lines new at this visit stay so until the next one. */
  private async loadSummary(first = false): Promise<void> {
    const loaded = await attempt(this.api.invoke(getErrorLogSummary));
    if (!loaded.ok) {
      return;
    }
    this.summary.set(loaded.value);
    if (first) {
      this.since.set(loaded.value.since);
      await this.watch.logsSeen();
    }
  }

  protected isNew(line: ErrorLogLine): boolean {
    const since = this.since();
    return !line.archivedAt && !!since && Date.parse(line.lastSeenAt) > Date.parse(since);
  }

  /** Out of the list, the problem handled; or back in it. */
  protected async archive(line: ErrorLogLine, archived: boolean): Promise<void> {
    if ((await attempt(this.api.invoke(archiveErrorLog, { ids: [line.id], archived }))).ok) {
      this.toaster.success(archived ? 'Ligne archivée : elle reviendra si l’erreur se reproduit' : 'Ligne remise dans la liste');
      this.reload();
    }
  }

  protected async archiveAll(): Promise<void> {
    const count = this.summary()?.lines ?? 0;
    const confirmed = await this.confirm.ask({
      title: 'Tout archiver ?',
      message: `${count > 1 ? `Les ${count} lignes` : 'La ligne'} à traiter quitte${count > 1 ? 'nt' : ''} la liste sans être effacée${count > 1 ? 's' : ''}, quels que soient les filtres. Une erreur qui se reproduit y revient d’elle-même`,
      confirmLabel: 'Tout archiver',
    });
    if (confirmed && (await attempt(this.api.invoke(archiveErrorLog, { archived: true }))).ok) {
      this.toaster.success('Journal archivé');
      this.reload();
    }
  }

  protected reload(): void {
    this.lines.reload();
    void this.loadSummary();
  }

  protected async copy(line: ErrorLogLine): Promise<void> {
    const text = [line.message, line.logger, line.page, line.detail].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      this.toaster.success('Détail copié');
    } catch {
      this.toaster.error('Le détail n’a pas pu être copié');
    }
  }

  protected async erase(line: ErrorLogLine): Promise<void> {
    if ((await attempt(this.api.invoke(eraseErrorLog, { ids: [line.id] }))).ok) {
      this.reload();
    }
  }

  protected async eraseAll(): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Effacer tout le journal ?',
      message: 'Les erreurs et avertissements des 30 derniers jours disparaissent, archivés compris. Ceux qui reviendront s’afficheront de nouveau',
      confirmLabel: 'Tout effacer',
    });
    if (confirmed && (await attempt(this.api.invoke(eraseErrorLog, {}))).ok) {
      this.toaster.success('Journal effacé');
      this.reload();
    }
  }
}
