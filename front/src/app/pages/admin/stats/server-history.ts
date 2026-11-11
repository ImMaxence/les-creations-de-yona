import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { Api } from '../../../core/api/generated/api';
import { getServerHistory } from '../../../core/api/generated/fn/admin-stats/get-server-history';
import { ServerPoint } from '../../../core/api/generated/models/server-point';
import { parisDateTime } from '../../../shared/format/paris-time';
import { Skeleton } from '../../../shared/ui/skeleton/skeleton';

const WIDTH = 600;
const HEIGHT = 140;
const MEGABYTE = 1024 * 1024;
const DAY = 24 * 60 * 60 * 1000;

export type Period = 7 | 30 | 90;

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
  unit: string;
  max: number;
  series: Series[];
  summary: string;
}

/** The first step at or above the value, with some room above the curve. */
function niceMax(value: number, steps: number[]): number {
  return steps.find((step) => step >= value * 1.15) ?? steps[steps.length - 1]!;
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

/**
 * Memory and processor over the last 7, 30 or 90 days, measured by the backend every 10 minutes
 * and kept 90 days: how it behaves over time (its memory after a day, the busy hours). Each point
 * is a slice of the period: the processor's average, the memory's peak.
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

    @if (history.value(); as points) {
      @if (points.length) {
        <div class="live__charts">
          @for (chart of charts(); track chart.title) {
            <figure class="live-chart">
              <figcaption class="live-chart__title">{{ chart.title }}</figcaption>
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
                      <span class="tip__when">{{ dateTime(points[index]!.at) }}</span>
                      @for (series of chart.series; track series.label) {
                        <span>{{ series.label }} <strong>{{ format(series.values[index] ?? null, chart.unit) }}</strong></span>
                      }
                    </span>
                  }
                </div>
              </div>
              <p class="live-chart__axis" aria-hidden="true"><span>il y a {{ days() }} jours</span><span>maintenant</span></p>
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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServerHistoryChart {
  private readonly api = inject(Api);

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
  protected readonly shares = computed(() => timeShares(this.history.value() ?? [], this.days(), Date.now()));

  protected readonly charts = computed<Chart[]>(() => {
    const points = this.history.value() ?? [];
    const shares = this.shares();
    // A slice of the backend (10 minutes, or the period in 180) and more without a measure: it was stopped
    const periodSeconds = this.days() * 24 * 60 * 60;
    const gap = (2.5 * Math.max(600, periodSeconds / 180)) / periodSeconds;
    const cpu = [
      points.map((point) => (point.backendCpu == null ? null : point.backendCpu * 100)),
      points.map((point) => (point.machineCpu == null ? null : point.machineCpu * 100)),
    ];
    const memory = [
      points.map((point) => (point.backendMemoryBytes == null ? null : point.backendMemoryBytes / MEGABYTE)),
      points.map((point) => point.heapUsedBytes / MEGABYTE),
    ];
    const cpuMax = niceMax(Math.max(0, ...cpu.flat().map((value) => value ?? 0)), [10, 25, 50, 100]);
    const memoryMax = niceMax(Math.max(0, ...memory.flat().map((value) => value ?? 0)), [100, 200, 300, 400, 500, 600, 800, 1000, 1500, 2000, 4000]);
    const series = (label: string, tone: Series['tone'], values: (number | null)[], max: number, unit: string): Series => ({
      label,
      tone,
      values,
      path: historyPath(values, shares, max, gap),
      peak: this.format(values.reduce<number | null>((top, value) => (value === null ? top : Math.max(top ?? 0, value)), null), unit),
    });
    const cpuSeries = [series('Backend', 'mark', cpu[0]!, cpuMax, '%'), series('Machine', 'rest', cpu[1]!, cpuMax, '%')];
    const memorySeries = [series('Backend', 'mark', memory[0]!, memoryMax, 'Mo'), series('dont données Java', 'rest', memory[1]!, memoryMax, 'Mo')];
    const summary = (title: string, list: Series[]) => `${title}, ${this.days()} derniers jours : ${list.map((each) => `${each.label} au plus ${each.peak}`).join(', ')}`;
    return [
      { title: 'Processeur (moyenne)', unit: '%', max: cpuMax, series: cpuSeries, summary: summary('Processeur', cpuSeries) },
      { title: 'Mémoire (pics)', unit: 'Mo', max: memoryMax, series: memorySeries, summary: summary('Mémoire', memorySeries) },
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

  protected format(value: number | null, unit: string): string {
    if (value === null) {
      return '—';
    }
    return unit === '%' ? `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %` : `${Math.round(value)} Mo`;
  }
}
