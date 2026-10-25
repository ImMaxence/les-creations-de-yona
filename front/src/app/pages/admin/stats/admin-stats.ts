import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { LucideHardDrive, LucideRefreshCw } from '@lucide/angular';
import { Api } from '../../../core/api/generated/api';
import { getStats } from '../../../core/api/generated/fn/admin-stats/get-stats';
import { NamedCount } from '../../../core/api/generated/models/named-count';
import { ParisDatePipe } from '../../../shared/format/paris-date.pipe';
import { formatBytes } from '../../../shared/format/units';
import { Button } from '../../../shared/ui/button/button';

const MONTH = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });
const MONTH_YEAR = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const PERCENT = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 });

/** A bar of a one-series chart: its share of the largest value, for its length. */
interface Bar {
  label: string;
  count: number;
  share: number;
}

/**
 * Dashboard of the back-office: what the site holds, how it grows, and the room the photos take
 * on the server's disk. Charts have a single series, in the theme's accent color; every value is
 * written next to its bar, or in the table under the monthly chart.
 */
@Component({
  selector: 'yona-admin-stats',
  imports: [Button, ParisDatePipe, LucideHardDrive, LucideRefreshCw],
  templateUrl: './admin-stats.html',
  styleUrl: './admin-stats.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminStats {
  private readonly api = inject(Api);

  protected readonly stats = resource({ loader: () => this.api.invoke(getStats, {}) });
  protected readonly formatBytes = formatBytes;

  protected readonly months = computed(() => {
    const months = this.stats.value()?.recipesPerMonth ?? [];
    const max = Math.max(1, ...months.map((month) => month.count));
    return months.map((month) => {
      const date = new Date(`${month.month}-01T00:00:00Z`);
      return {
        short: MONTH.format(date).replace('.', ''),
        long: MONTH_YEAR.format(date),
        count: month.count,
        share: month.count / max,
        // Labelled on the bar: the busiest month and the current one; the rest in the tooltip and table
        labelled: month.count > 0 && (month.count === max || month === months.at(-1)),
      };
    });
  });
  protected readonly categories = computed(() => bars(this.stats.value()?.recipesPerCategory ?? []));
  protected readonly ingredients = computed(() => bars(this.stats.value()?.topIngredients ?? []));

  /** Shares of the disk: the photos, everything else used, and the free room. */
  protected readonly storage = computed(() => {
    const storage = this.stats.value()?.storage;
    if (!storage) {
      return null;
    }
    const used = storage.diskTotalBytes - storage.diskFreeBytes;
    const images = storage.imageBytes ?? 0;
    const other = Math.max(0, used - images);
    const share = (bytes: number) => (storage.diskTotalBytes ? bytes / storage.diskTotalBytes : 0);
    return {
      ...storage,
      used,
      other,
      imagesShare: share(images),
      otherShare: share(other),
      freeShare: share(storage.diskFreeBytes),
      usedShare: share(used),
    };
  });

  protected percent(share: number): string {
    // A few hundred megabytes on a large disk: "< 0,1 %" rather than a misleading "0 %"
    return share > 0 && share < 0.001 ? '< 0,1 %' : PERCENT.format(share);
  }

  protected plural(count: number, one: string, many: string): string {
    return `${count} ${count > 1 ? many : one}`;
  }
}

function bars(counts: NamedCount[]): Bar[] {
  const max = Math.max(1, ...counts.map((item) => item.count));
  return counts.map((item) => ({ label: item.name, count: item.count, share: item.count / max }));
}
