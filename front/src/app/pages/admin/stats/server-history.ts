import { ChangeDetectionStrategy, Component, computed, inject, input, resource, signal } from '@angular/core';
import { Api } from '../../../core/api/generated/api';
import { getServerHistory } from '../../../core/api/generated/fn/admin-stats/get-server-history';
import { Power } from '../../../core/api/generated/models/power';
import { ServerPoint } from '../../../core/api/generated/models/server-point';
import { parisDateTime, parisDay } from '../../../shared/format/paris-time';
import { formatBytes, formatEuros } from '../../../shared/format/units';
import { Skeleton } from '../../../shared/ui/skeleton/skeleton';
import { ChartUnit, formatEnergy, formatValue, formatWatts, niceMax } from './server-units';

const WIDTH = 600;
const HEIGHT = 140;
const MEGABYTE = 1024 * 1024;
const DAY = 24 * 60 * 60 * 1000;

export type Period = 7 | 30 | 90;

/** "machine": processor and memory of the backend; "energy": estimated draw and traffic of the server (2.21). */
export type HistoryKind = 'machine' | 'energy';

interface Series {
  label: string;
  tone: 'mark' | 'rest';
  path: string;
  /** The highest of the period, in the legend. */
  peak: string;
  values: (number | null)[];
}

interface Chart {
  title: string;
  unit: ChartUnit;
  max: number;
  series: Series[];
  summary: string;
  /** No value at all yet: a sentence instead of the curve. */
  empty: string | null;
}

/** Where each point stands in the period, from 0 (its start) to 1 (now). */
export function timeShares(points: readonly ServerPoint[], days: Period, now: number): number[] {
  const from = now - days * DAY;
  return points.map((point) => Math.min(1, Math.max(0, (Date.parse(point.at) - from) / (now - from))));
}

/** An SVG path through the values, at their place in time; a gap where a value is unknown or a measure is missing. */
export function historyPath(values: readonly (number | null)[], shares: readonly number[], max: number, gap: number): string {
  let d = '';
  let previous: number | null = null;
  values.forEach((value, index) => {
    const share = shares[index]!;
    if (value === null) {
      previous = null;
      return;
    }
    const x = share * WIDTH;
    const y = HEIGHT - (Math.min(value, max) / max) * HEIGHT;
    // The backend stopped (a deployment, a night off): the curve breaks rather than lies
    const joined = previous !== null && share - previous <= gap;
    d += `${joined ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    previous = share;
  });
  return d;
}

/** Bytes per second → Mo per hour, or null. */
function perHour(bytesPerSecond: number | null | undefined): number | null {
  return bytesPerSecond == null ? null : (bytesPerSecond * 3600) / MEGABYTE;
}

/**
 * The last 7, 30 or 90 days, measured by the backend every 10 minutes and kept 90 days. Each point is
 * a slice of the period. "machine": the processor's average and the memory's peak, how the backend
 * behaves over time (its memory after a day, the busy hours). "energy" (2.21): the estimated draw of
 * the server and the traffic of the server and of the site, averages of each slice, with the totals of
 * the period above them.
 */
@Component({
  selector: 'yona-server-history',
  imports: [Skeleton],
  template: `
    <div class="history__head">
      <h4 class="history__title">Historique</h4>
      <div class="periods" role="group" aria-label="Période">
        @for (option of periods; track option) {
          <button type="button" class="periods__option" [attr.aria-pressed]="days() === option" (click)="days.set(option)">{{ option }} jours</button>
        }
      </div>
    </div>

    @if (history.value(); as view) {
      @if (kind() === 'energy') {
        @if (totals(); as sums) {
          <dl class="totals">
            <div>
              <dt>Énergie estimée</dt>
              <dd>{{ sums.energy }}</dd>
              <dd class="totals__detail">{{ sums.energyDetail }}</dd>
            </div>
            <div>
              <dt>Réseau du serveur</dt>
              <dd>{{ sums.hostSent }}</dd>
              <dd class="totals__detail">{{ sums.hostReceived }}</dd>
            </div>
            <div>
              <dt>Trafic du site</dt>
              <dd>{{ sums.siteSent }}</dd>
              <dd class="totals__detail">{{ sums.siteReceived }}</dd>
            </div>
          </dl>
          @if (sums.since) {
            <p class="field__hint">Mesuré depuis le {{ sums.since }} : ces chiffres arrivent avec la version 2.21</p>
          }
        }
      }
      @if (view.points.length) {
        <div class="live__charts">
          @for (chart of charts(); track chart.title) {
            <figure class="live-chart">
              <figcaption class="live-chart__title">{{ chart.title }}</figcaption>
              @if (chart.empty) {
                <p class="field__hint">{{ chart.empty }}</p>
              } @else {
                <ul role="list" class="live-chart__legend">
                  @for (series of chart.series; track series.label) {
                    <li><span class="key" [class.key--rest]="series.tone === 'rest'"></span>{{ series.label }} <strong>au plus {{ series.peak }}</strong></li>
                  }
                </ul>
                <div class="live-chart__plot">
                  <span class="live-chart__tick live-chart__tick--top">{{ chart.max }} {{ chart.unit }}</span>
                  <span class="live-chart__tick live-chart__tick--middle">{{ chart.max / 2 }}</span>
                  <span class="live-chart__tick live-chart__tick--bottom">0</span>
                  <div class="live-chart__area" (pointermove)="hover($event)" (pointerleave)="hovered.set(null)">
                    <svg role="img" [attr.aria-label]="chart.summary" [attr.viewBox]="'0 0 ' + width + ' ' + height" preserveAspectRatio="none">
                      <line class="grid" x1="0" [attr.x2]="width" [attr.y1]="height / 2" [attr.y2]="height / 2" />
                      <line class="baseline" x1="0" [attr.x2]="width" [attr.y1]="height" [attr.y2]="height" />
                      @for (series of chart.series; track series.label) {
                        <path [class]="'curve curve--' + series.tone" [attr.d]="series.path" />
                      }
                    </svg>
                    @let index = hovered();
                    @if (index !== null) {
                      <span class="crosshair" [style.left.%]="shares()[index]! * 100"></span>
                      <span class="tip" [class.tip--left]="shares()[index]! > 0.6" [style.left.%]="shares()[index]! * 100">
                        <span class="tip__when">{{ dateTime(view.points[index]!.at) }}</span>
                        @for (series of chart.series; track series.label) {
                          <span>{{ series.label }} <strong>{{ format(series.values[index] ?? null, chart.unit) }}</strong></span>
                        }
                      </span>
                    }
                  </div>
                </div>
                <p class="live-chart__axis" aria-hidden="true"><span>il y a {{ days() }} jours</span><span>maintenant</span></p>
              }
            </figure>
          }
        </div>
      } @else {
        <p class="field__hint">Les mesures commencent : une toutes les 10 minutes, la courbe se dessine au fil des heures</p>
      }
    } @else if (history.isLoading()) {
      <yona-skeleton kind="tiles" [count]="2" />
    }
  `,
  styleUrls: ['./server-live.scss'],
  styles: `
    :host {
      display: grid;
      gap: var(--space-3);
    }

    .history__head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
    }

    .history__title {
      font-size: var(--text-base);
      font-weight: 700;
    }

    /* Three choices side by side, the chosen one raised */
    .periods {
      display: inline-flex;
      gap: var(--space-1);
      padding: var(--space-1);
      border-radius: var(--radius-md);
      background-color: color-mix(in srgb, var(--color-text) 6%, var(--color-bg));
    }

    .periods__option {
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-sm);
      color: var(--color-text-muted);
      font-size: var(--text-sm);
      font-weight: 600;
      transition:
        background-color var(--duration-fast) var(--ease-out),
        color var(--duration-fast) var(--ease-out);

      &[aria-pressed='true'] {
        background-color: var(--color-bg);
        box-shadow: var(--shadow-sm);
        color: var(--color-text);
      }

      &:focus-visible {
        outline: 2px solid var(--color-accent);
        outline-offset: 1px;
      }
    }

    /* The totals of the period, one figure each */
    .totals {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 12rem), 1fr));
      gap: var(--space-3);
      margin: 0;

      > div {
        display: grid;
        align-content: start;
        gap: var(--space-1);
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--color-line);
        border-radius: var(--radius-md);
      }

      dt {
        font-size: var(--text-xs);
        font-weight: 600;
        color: var(--color-text-muted);
      }

      dd {
        margin: 0;
        font-family: var(--font-display);
        font-size: var(--text-xl);
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
    }

    .totals .totals__detail {
      font-family: inherit;
      font-size: var(--text-sm);
      font-weight: 500;
      color: var(--color-text-muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServerHistoryChart {
  private readonly api = inject(Api);

  readonly kind = input<HistoryKind>('machine');
  /** The figures of the estimate: the price of a kWh, in the detail of the energy. */
  readonly power = input<Power | null>(null);

  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;
  protected readonly dateTime = parisDateTime;
  protected readonly periods: Period[] = [7, 30, 90];
  protected readonly days = signal<Period>(7);
  protected readonly history = resource({
    params: () => this.days(),
    loader: ({ params }) => this.api.invoke(getServerHistory, { days: params }),
  });
  protected readonly hovered = signal<number | null>(null);
  protected readonly shares = computed(() => timeShares(this.history.value()?.points ?? [], this.days(), Date.now()));

  /** The period in figures, written as they are read. */
  protected readonly totals = computed(() => {
    const totals = this.history.value()?.totals;
    if (!totals) {
      return null;
    }
    const price = this.power()?.eurosPerKwh;
    const energyDetail = [
      totals.euros != null ? `≈ ${formatEuros(totals.euros)}${price ? ` (${formatEuros(price)} le kWh)` : ''}` : null,
      totals.averageWatts != null ? `${formatWatts(totals.averageWatts)} en moyenne` : null,
    ].filter((part) => part !== null);
    // Measures that start inside the period: said, or the totals would look small
    const since = totals.since && Date.parse(totals.since) > Date.now() - this.days() * DAY + 2 * 60 * 60 * 1000 ? parisDay(totals.since) : null;
    return {
      energy: totals.energyKwh != null ? `≈ ${formatEnergy(totals.energyKwh)}` : 'Pas encore mesurée',
      energyDetail: energyDetail.join(' · ') || 'Une estimation toutes les 10 minutes',
      hostSent: totals.hostSentBytes != null ? `${formatBytes(totals.hostSentBytes)} envoyés` : 'Pas encore mesuré',
      hostReceived: totals.hostReceivedBytes != null ? `${formatBytes(totals.hostReceivedBytes)} reçus` : 'Toute la carte réseau du serveur',
      siteSent: totals.siteSentBytes != null ? `${formatBytes(totals.siteSentBytes)} envoyés` : 'Pas encore mesuré',
      siteReceived: totals.siteReceivedBytes != null ? `${formatBytes(totals.siteReceivedBytes)} reçus des visiteurs` : 'Pages, API et photos du site',
      since,
    };
  });

  protected readonly charts = computed<Chart[]>(() => {
    const points = this.history.value()?.points ?? [];
    const shares = this.shares();
    // A slice of the backend (10 minutes, or the period in 180) and more without a measure: it was stopped
    const periodSeconds = this.days() * 24 * 60 * 60;
    const gap = (2.5 * Math.max(600, periodSeconds / 180)) / periodSeconds;
    const series = (label: string, tone: Series['tone'], values: (number | null)[], max: number, unit: ChartUnit): Series => ({
      label,
      tone,
      values,
      path: historyPath(values, shares, max, gap),
      peak: this.format(values.reduce<number | null>((top, value) => (value === null ? top : Math.max(top ?? 0, value)), null), unit),
    });
    const chart = (title: string, unit: ChartUnit, lines: [string, Series['tone'], (number | null)[]][], empty: string): Chart => {
      const max = niceMax(lines.flatMap(([, , values]) => values), unit);
      const list = lines.map(([label, tone, values]) => series(label, tone, values, max, unit));
      return {
        title,
        unit,
        max,
        series: list,
        summary: `${title}, ${this.days()} derniers jours : ${list.map((each) => `${each.label} au plus ${each.peak}`).join(', ')}`,
        empty: lines.every(([, , values]) => values.every((value) => value === null)) ? empty : null,
      };
    };
    if (this.kind() === 'energy') {
      return [
        chart('Consommation estimée (moyenne)', 'W', [['Serveur', 'mark', points.map((point) => point.watts ?? null)]],
          'Pas encore de mesure : la première arrive 20 minutes après la mise en ligne de la 2.21'),
        chart(
          'Réseau du serveur (moyenne)',
          'Mo/h',
          [
            ['Envoyé', 'mark', points.map((point) => perHour(point.hostSentPerSecond))],
            ['Reçu', 'rest', points.map((point) => perHour(point.hostReceivedPerSecond))],
          ],
          'Pas de mesure : le backend ne lit pas les compteurs réseau du serveur (dossier /proc/1/net non monté)',
        ),
        chart(
          'Trafic du site (moyenne)',
          'Mo/h',
          [
            ['Envoyé aux visiteurs', 'mark', points.map((point) => perHour(point.siteSentPerSecond))],
            ['Reçu', 'rest', points.map((point) => perHour(point.siteReceivedPerSecond))],
          ],
          'Pas de mesure : la passerelle du site ne répond pas au backend',
        ),
      ];
    }
    return [
      chart(
        'Processeur (moyenne)',
        '%',
        [
          ['Backend', 'mark', points.map((point) => (point.backendCpu == null ? null : point.backendCpu * 100))],
          ['Machine', 'rest', points.map((point) => (point.machineCpu == null ? null : point.machineCpu * 100))],
        ],
        'Pas encore de mesure',
      ),
      chart(
        'Mémoire (pics)',
        'Mo',
        [
          ['Backend', 'mark', points.map((point) => (point.backendMemoryBytes == null ? null : point.backendMemoryBytes / MEGABYTE))],
          ['dont données Java', 'rest', points.map((point) => point.heapUsedBytes / MEGABYTE)],
        ],
        'Pas encore de mesure',
      ),
    ];
  });

  protected hover(event: PointerEvent): void {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const share = (event.clientX - box.left) / box.width;
    const shares = this.shares();
    let nearest: number | null = null;
    shares.forEach((each, index) => {
      if (nearest === null || Math.abs(each - share) < Math.abs(shares[nearest]! - share)) {
        nearest = index;
      }
    });
    this.hovered.set(nearest);
  }

  protected format(value: number | null, unit: ChartUnit): string {
    return formatValue(value, unit);
  }
}
