import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { MonthTotals } from '../../../core/api/generated/models/month-totals';
import { formatEuros } from '../../../shared/format/units';
import { barPath, roundScale } from './accounting-format';

const MONTHS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
const FULL_MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const WIDTH = 720;
const HEIGHT = 200;
const TOP = 12;
const BOTTOM = 24;
const LEFT = 48;
const BAR = 14;
/** Between the two bars of a month: the surface shows through. */
const GAP = 2;

/**
 * Money in and out, month by month: two bars a month (blue in, orange out, validated for colour
 * blindness in light and dark), a legend, and the detail of a month on hover or focus. The same
 * figures are in the table under it.
 */
@Component({
  selector: 'yona-accounting-chart',
  template: `
    <div class="chart">
      <ul role="list" class="legend" aria-hidden="true">
        <li><span class="legend__key legend__key--in"></span>Entrées</li>
        <li><span class="legend__key legend__key--out"></span>Dépenses</li>
      </ul>
      <svg class="plot" [attr.viewBox]="'0 0 ' + width + ' ' + height" role="img" aria-label="Entrées et dépenses par mois, détaillées dans le tableau ci-dessous">
        @for (tick of ticks(); track tick.value) {
          <line class="grid" [attr.x1]="left" [attr.x2]="width" [attr.y1]="tick.y" [attr.y2]="tick.y" />
          <text class="axis" [attr.x]="left - 8" [attr.y]="tick.y + 4" text-anchor="end">{{ tick.label }}</text>
        }
        @for (column of columns(); track column.month; let i = $index) {
          <g class="column" [class.is-hovered]="hovered() === i">
            @if (column.incomeHeight > 0) {
              <path class="bar bar--in" [attr.d]="bar(column.x - BAR - GAP / 2, column.incomeHeight)" />
            }
            @if (column.expenseHeight > 0) {
              <path class="bar bar--out" [attr.d]="bar(column.x + GAP / 2, column.expenseHeight)" />
            }
            <text class="axis" [attr.x]="column.x" [attr.y]="height - 6" text-anchor="middle">{{ column.label }}</text>
            <!-- The hit area: the whole column, bigger than the bars -->
            <rect
              class="hit"
              tabindex="0"
              [attr.x]="column.x - step() / 2"
              [attr.y]="top"
              [attr.width]="step()"
              [attr.height]="plotHeight"
              [attr.aria-label]="column.description"
              (pointerenter)="hovered.set(i)"
              (pointerleave)="hovered.set(null)"
              (focus)="hovered.set(i)"
              (blur)="hovered.set(null)"
            />
          </g>
        }
        <line class="baseline" [attr.x1]="left" [attr.x2]="width" [attr.y1]="top + plotHeight" [attr.y2]="top + plotHeight" />
      </svg>
      @if (hoveredColumn(); as column) {
        <div class="tooltip" [style.left.%]="(column.x / width) * 100" role="status">
          <p class="tooltip__title">{{ column.fullLabel }}</p>
          <p class="tooltip__row"><span class="tooltip__key tooltip__key--in"></span><strong>{{ euros(column.income) }}</strong> entrées</p>
          <p class="tooltip__row"><span class="tooltip__key tooltip__key--out"></span><strong>{{ euros(column.expense) }}</strong> dépenses</p>
          <p class="tooltip__row tooltip__row--balance">Solde <strong>{{ euros(column.income - column.expense) }}</strong></p>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      --series-in: light-dark(#2a78d6, #3987e5);
      --series-out: light-dark(#eb6834, #d95926);
      display: block;
    }

    .chart {
      position: relative;
    }

    .legend {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-4);
      margin-bottom: var(--space-2);
      font-size: var(--text-xs);
      color: var(--color-text-muted);

      li {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
      }
    }

    .legend__key {
      width: 0.75rem;
      height: 0.75rem;
      border-radius: 3px;
    }

    .legend__key--in,
    .bar--in {
      background-color: var(--series-in);
      fill: var(--series-in);
    }

    .legend__key--out,
    .bar--out {
      background-color: var(--series-out);
      fill: var(--series-out);
    }

    .plot {
      display: block;
      width: 100%;
      height: auto;
      overflow: visible;
    }

    .grid {
      stroke: var(--color-line);
      stroke-width: 1;
    }

    .baseline {
      stroke: color-mix(in srgb, var(--color-text) 30%, transparent);
      stroke-width: 1;
    }

    .axis {
      fill: var(--color-text-muted);
      font-size: 11px;
      font-variant-numeric: tabular-nums;
    }

    .hit {
      fill: transparent;
      outline: none;
      cursor: default;
    }

    .column.is-hovered .bar {
      filter: brightness(1.12);
    }

    .column.is-hovered .hit {
      fill: color-mix(in srgb, var(--color-text) 5%, transparent);
    }

    .tooltip {
      position: absolute;
      z-index: 2;
      top: 1.5rem;
      min-width: 10rem;
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      background-color: var(--color-bg);
      box-shadow: 0 0.5rem 1.5rem -0.75rem color-mix(in srgb, var(--color-text) 45%, transparent);
      font-size: var(--text-xs);
      transform: translateX(-50%);
      pointer-events: none;
    }

    .tooltip__title {
      margin-bottom: var(--space-1);
      font-weight: 700;
    }

    .tooltip__row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--color-text-muted);

      strong {
        color: var(--color-text);
        font-variant-numeric: tabular-nums;
      }
    }

    .tooltip__row--balance {
      margin-top: var(--space-1);
      padding-top: var(--space-1);
      border-top: 1px solid var(--color-line);
    }

    .tooltip__key {
      width: 0.75rem;
      height: 2px;
      border-radius: 1px;
    }

    .tooltip__key--in {
      background-color: var(--series-in);
    }

    .tooltip__key--out {
      background-color: var(--series-out);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountingChart {
  readonly months = input.required<MonthTotals[]>();

  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;
  protected readonly top = TOP;
  protected readonly left = LEFT;
  protected readonly plotHeight = HEIGHT - TOP - BOTTOM;
  protected readonly BAR = BAR;
  protected readonly GAP = GAP;
  protected readonly hovered = signal<number | null>(null);
  protected readonly euros = formatEuros;

  protected readonly step = computed(() => (WIDTH - LEFT) / Math.max(1, this.months().length));
  /** A round top for the scale: 100, 200, 500, 1 000… */
  private readonly max = computed(() => roundScale(Math.max(0, ...this.months().flatMap((month) => [month.totals.income, month.totals.expense]))));
  protected readonly ticks = computed(() =>
    [0, 0.5, 1].map((share) => ({
      value: share,
      y: TOP + this.plotHeight * (1 - share),
      label: `${Math.round(this.max() * share).toLocaleString('fr-FR')} €`,
    })),
  );
  protected readonly columns = computed(() =>
    this.months().map((month, index) => ({
      month: month.month,
      label: MONTHS[month.month - 1] ?? String(month.month),
      fullLabel: FULL_MONTHS[month.month - 1] ?? String(month.month),
      x: LEFT + this.step() * (index + 0.5),
      income: month.totals.income,
      expense: month.totals.expense,
      incomeHeight: (month.totals.income / this.max()) * this.plotHeight,
      expenseHeight: (month.totals.expense / this.max()) * this.plotHeight,
      description: `${FULL_MONTHS[month.month - 1]} : ${formatEuros(month.totals.income)} d'entrées, ${formatEuros(month.totals.expense)} de dépenses`,
    })),
  );
  protected readonly hoveredColumn = computed(() => {
    const index = this.hovered();
    return index === null ? null : (this.columns()[index] ?? null);
  });

  /** A bar standing on the baseline, its top corners rounded (4 px). */
  protected bar(x: number, height: number): string {
    return barPath(x, height, BAR, TOP + this.plotHeight);
  }
}
