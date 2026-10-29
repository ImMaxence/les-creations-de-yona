import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Api } from '../../../core/api/generated/api';
import { getServerUsage } from '../../../core/api/generated/fn/admin-stats/get-server-usage';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';

/** Measures kept: the curves cover the last 60 of them. */
const MAX_SAMPLES = 60;

/** Drawing box of the curves, stretched to the width of the panel (strokes keep their width). */
const WIDTH = 600;
const HEIGHT = 140;

const MEGABYTE = 1024 * 1024;

interface Sample {
  at: number;
  /** Percent of the processors given to the backend; null when unknown. */
  backendCpu: number | null;
  machineCpu: number | null;
  /** Mo. */
  backendMemory: number | null;
  javaMemory: number;
}

interface Series {
  label: string;
  /** "mark" (the backend, accent color, solid) or "rest" (gray, dashed). */
  tone: 'mark' | 'rest';
  path: string;
  /** Last value, written in the legend. */
  last: string;
  /** Each sample, or null: for the hover. */
  values: (number | null)[];
}

interface Chart {
  title: string;
  unit: string;
  max: number;
  series: Series[];
  summary: string;
}

/**
 * Live curves of the processor and the memory of the backend: a measure every 1, 2 or 5 seconds
 * (GET /api/admin/stats/server, light), the last 60 drawn, while "Suivre en direct" is on and the
 * page is shown. Two charts, one unit each: the backend in the theme's accent color, solid; the
 * machine, or the Java data, in gray, dashed. Hovering shows the values of a moment.
 */
@Component({
  selector: 'yona-server-live',
  imports: [Button, Icon],
  template: `
    <div class="live__head no-print">
      <button yonaButton [variant]="running() ? 'primary' : 'secondary'" type="button" [attr.aria-pressed]="running()" (click)="toggle()">
        <svg [yonaIcon]="running() ? 'pause' : 'play'"></svg>{{ running() ? 'Arrêter le direct' : 'Suivre en direct' }}
      </button>
      <div class="live__every" role="group" aria-label="Une mesure toutes les">
        @for (seconds of intervals; track seconds) {
          <button type="button" class="pill" [attr.aria-pressed]="interval() === seconds" (click)="every(seconds)">{{ seconds }} s</button>
        }
      </div>
      @if (running()) {
        <span class="live__dot" aria-hidden="true"></span><span class="live__status">En direct</span>
      }
    </div>

    @if (samples().length) {
      <div class="live__charts">
        @for (chart of charts(); track chart.title) {
          <figure class="live-chart">
            <figcaption class="live-chart__title">{{ chart.title }}</figcaption>
            <ul role="list" class="live-chart__legend">
              @for (series of chart.series; track series.label) {
                <li><span class="key" [class.key--rest]="series.tone === 'rest'"></span>{{ series.label }} <strong>{{ series.last }}</strong></li>
              }
            </ul>
            <div class="live-chart__plot">
              <span class="live-chart__tick live-chart__tick--top">{{ chart.max }} {{ chart.unit }}</span>
              <span class="live-chart__tick live-chart__tick--middle">{{ chart.max / 2 }}</span>
              <span class="live-chart__tick live-chart__tick--bottom">0</span>
              <div
                class="live-chart__area"
                (pointermove)="hover($event)"
                (pointerleave)="hovered.set(null)"
              >
                <svg role="img" [attr.aria-label]="chart.summary" [attr.viewBox]="'0 0 ' + width + ' ' + height" preserveAspectRatio="none">
                  <line class="grid" x1="0" [attr.x2]="width" [attr.y1]="height / 2" [attr.y2]="height / 2" />
                  <line class="baseline" x1="0" [attr.x2]="width" [attr.y1]="height" [attr.y2]="height" />
                  @for (series of chart.series; track series.label) {
                    <path [class]="'curve curve--' + series.tone" [attr.d]="series.path" />
                  }
                </svg>
                @let index = hovered();
                @if (index !== null) {
                  <span class="crosshair" [style.left.%]="xShare(index) * 100"></span>
                  @for (series of chart.series; track series.label) {
                    @if (series.values[index] !== null) {
                      <span
                        class="point"
                        [class.point--rest]="series.tone === 'rest'"
                        [style.left.%]="xShare(index) * 100"
                        [style.top.%]="(1 - series.values[index]! / chart.max) * 100"
                      ></span>
                    }
                  }
                  <span class="tip" [class.tip--left]="xShare(index) > 0.6" [style.left.%]="xShare(index) * 100">
                    <span class="tip__when">{{ ago(index) }}</span>
                    @for (series of chart.series; track series.label) {
                      <span>{{ series.label }} <strong>{{ format(series.values[index], chart.unit) }}</strong></span>
                    }
                  </span>
                }
              </div>
            </div>
            <p class="live-chart__axis" aria-hidden="true"><span>il y a {{ span() }}</span><span>maintenant</span></p>
          </figure>
        }
      </div>
    } @else if (running()) {
      <p class="field__hint">Première mesure…</p>
    }
  `,
  styleUrl: './server-live.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServerLive {
  private readonly api = inject(Api);
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;
  protected readonly intervals = [1, 2, 5];
  protected readonly interval = signal(2);
  protected readonly running = signal(false);
  protected readonly samples = signal<Sample[]>([]);
  /** Index of the sample under the pointer. */
  protected readonly hovered = signal<number | null>(null);
  /** "2 min", the time covered by a full chart. */
  protected readonly span = computed(() => {
    const seconds = MAX_SAMPLES * this.interval();
    return seconds >= 60 ? `${seconds / 60} min` : `${seconds} s`;
  });

  protected readonly charts = computed<Chart[]>(() => {
    const samples = this.samples();
    const cpuMax = niceMax(Math.max(...samples.flatMap((sample) => [sample.backendCpu ?? 0, sample.machineCpu ?? 0])), [10, 25, 50, 100]);
    const memoryMax = niceMax(
      Math.max(...samples.map((sample) => Math.max(sample.backendMemory ?? 0, sample.javaMemory))),
      [100, 200, 300, 400, 500, 600, 800, 1000, 1500, 2000],
    );
    const series = (label: string, tone: Series['tone'], values: (number | null)[], max: number, unit: string): Series => ({
      label,
      tone,
      values,
      path: path(values, max),
      last: this.format(values.at(-1) ?? null, unit),
    });
    const cpu = [
      series('Backend', 'mark', samples.map((sample) => sample.backendCpu), cpuMax, '%'),
      series('Machine', 'rest', samples.map((sample) => sample.machineCpu), cpuMax, '%'),
    ];
    const memory = [
      series('Backend', 'mark', samples.map((sample) => sample.backendMemory), memoryMax, 'Mo'),
      series('dont données Java', 'rest', samples.map((sample) => sample.javaMemory), memoryMax, 'Mo'),
    ];
    return [
      { title: 'Processeur', unit: '%', max: cpuMax, series: cpu, summary: summary('Processeur', cpu) },
      { title: 'Mémoire', unit: 'Mo', max: memoryMax, series: memory, summary: summary('Mémoire', memory) },
    ];
  });

  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const onVisibility = () => this.schedule(0);
    if (this.browser) {
      // Hidden tab: no measure, the backend is left alone
      this.document.addEventListener('visibilitychange', onVisibility);
    }
    inject(DestroyRef).onDestroy(() => {
      this.stop();
      this.document.removeEventListener('visibilitychange', onVisibility);
    });
  }

  protected toggle(): void {
    if (this.running()) {
      this.stop();
    } else {
      this.running.set(true);
      this.samples.set([]);
      this.schedule(0);
    }
  }

  protected every(seconds: number): void {
    this.interval.set(seconds);
    if (this.running()) {
      this.schedule(seconds * 1000);
    }
  }

  protected hover(event: PointerEvent): void {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const share = (event.clientX - box.left) / box.width;
    const count = this.samples().length;
    const index = Math.round(share * (MAX_SAMPLES - 1)) - (MAX_SAMPLES - count);
    this.hovered.set(index >= 0 && index < count ? index : null);
  }

  /** Samples fill the chart from the right: the latest is always "maintenant". */
  protected xShare(index: number): number {
    return (index + MAX_SAMPLES - this.samples().length) / (MAX_SAMPLES - 1);
  }

  protected ago(index: number): string {
    const samples = this.samples();
    const seconds = Math.round((samples[samples.length - 1].at - samples[index].at) / 1000);
    return seconds === 0 ? 'maintenant' : `il y a ${seconds} s`;
  }

  protected format(value: number | null, unit: string): string {
    if (value === null) {
      return '—';
    }
    return unit === '%' ? `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %` : `${Math.round(value)} Mo`;
  }

  private stop(): void {
    this.running.set(false);
    this.hovered.set(null);
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private schedule(delay: number): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.running() && this.browser && this.document.visibilityState === 'visible') {
      this.timer = setTimeout(() => void this.measure(), delay);
    }
  }

  private async measure(): Promise<void> {
    this.timer = null;
    try {
      const usage = await this.api.invoke(getServerUsage);
      const sample: Sample = {
        at: Date.now(),
        backendCpu: usage.backendCpuLoad == null ? null : usage.backendCpuLoad * 100,
        machineCpu: usage.machineCpuLoad == null ? null : usage.machineCpuLoad * 100,
        backendMemory: usage.backendMemoryBytes == null ? null : usage.backendMemoryBytes / MEGABYTE,
        javaMemory: usage.heapUsedBytes / MEGABYTE,
      };
      this.samples.update((samples) => [...samples, sample].slice(-MAX_SAMPLES));
    } catch {
      // Session ended or server down: the error is shown once, the direct stops
      this.stop();
      return;
    }
    this.schedule(this.interval() * 1000);
  }
}

/** The first step at or above the value, with some room above the curve. */
function niceMax(value: number, steps: number[]): number {
  return steps.find((step) => step >= value * 1.15) ?? steps[steps.length - 1];
}

/** An SVG path through the values, right-aligned; a gap where a value is unknown. */
function path(values: (number | null)[], max: number): string {
  const offset = MAX_SAMPLES - values.length;
  let drawing = false;
  let d = '';
  values.forEach((value, index) => {
    if (value === null) {
      drawing = false;
      return;
    }
    const x = ((index + offset) / (MAX_SAMPLES - 1)) * WIDTH;
    const y = HEIGHT - (Math.min(value, max) / max) * HEIGHT;
    d += `${drawing ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    drawing = true;
  });
  return d;
}

function summary(title: string, series: Series[]): string {
  return `${title}, en direct : ${series.map((each) => `${each.label} ${each.last}`).join(', ')}`;
}
