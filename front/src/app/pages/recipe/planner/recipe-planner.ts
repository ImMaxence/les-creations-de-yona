import { ChangeDetectionStrategy, Component, afterNextRender, computed, input, signal } from '@angular/core';
import { formatMinutes } from '../../../shared/format/units';
import { Icon } from '../../../shared/ui/icon/icon';

type PlanMode = 'start' | 'serve';

const STEP_MINUTES = 5;
const DAY_MINUTES = 24 * 60;

/**
 * "Organiser mon temps": from the time the visitor starts, the time the recipe is ready, or the
 * other way round, from the time to serve, the time to start. Preparation, rest (rising, chilling…)
 * and cooking are added up. Clock times only exist in the browser: the server renders the panel
 * without them.
 */
@Component({
  selector: 'yona-recipe-planner',
  imports: [Icon],
  templateUrl: './recipe-planner.html',
  styleUrl: './recipe-planner.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipePlanner {
  readonly prepMinutes = input<number | null | undefined>(null);
  readonly restMinutes = input<number | null | undefined>(null);
  readonly cookMinutes = input<number | null | undefined>(null);

  protected readonly mode = signal<PlanMode>('start');
  /** "14:30", as the time field gives it; empty until the browser fills in the current time. */
  protected readonly time = signal('');

  protected readonly total = computed(
    () => (this.prepMinutes() ?? 0) + (this.restMinutes() ?? 0) + (this.cookMinutes() ?? 0),
  );
  /** "30 min de préparation, 2 h de repos et 45 min de cuisson". */
  protected readonly parts = computed(() => {
    const parts = [
      [this.prepMinutes(), 'de préparation'],
      [this.restMinutes(), 'de repos'],
      [this.cookMinutes(), 'de cuisson'],
    ]
      .filter((part): part is [number, string] => !!part[0])
      .map(([minutes, label]) => `${formatMinutes(minutes)} ${label}`);
    return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} et ${parts.at(-1)}` : (parts[0] ?? '');
  });
  /** The other end of the recipe, "16:15", with "le lendemain" when it passes midnight. */
  protected readonly result = computed(() => {
    const minutes = parseTime(this.time());
    if (minutes === null) {
      return null;
    }
    const other = this.mode() === 'start' ? minutes + this.total() : minutes - this.total();
    const day = Math.floor(other / DAY_MINUTES);
    const clock = formatClock(((other % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES);
    return { clock, day: day > 0 ? 'le lendemain' : day < 0 ? 'la veille' : '' };
  });

  constructor() {
    afterNextRender(() => {
      const now = new Date();
      const minutes = Math.ceil((now.getHours() * 60 + now.getMinutes()) / STEP_MINUTES) * STEP_MINUTES;
      const rounded = minutes % DAY_MINUTES;
      // The time field wants "09:05"
      this.time.set(`${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`);
    });
  }

  protected formatTotal(): string {
    return formatMinutes(this.total());
  }

  protected setMode(mode: PlanMode): void {
    this.mode.set(mode);
  }

  protected onTime(event: Event): void {
    this.time.set((event.target as HTMLInputElement).value);
  }
}

/** "14:30" → 870; null when empty. */
function parseTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** 975 → "16 h 15", the way times are written in French. */
function formatClock(minutes: number): string {
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}
