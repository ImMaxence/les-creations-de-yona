import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../../core/api/generated/api';
import { attempt } from '../../../core/api/attempt';
import { getStats } from '../../../core/api/generated/fn/admin-stats/get-stats';
import { deleteSearchMisses } from '../../../core/api/generated/fn/admin-search-misses/delete-search-misses';
import { IncompleteRecipe } from '../../../core/api/generated/models/incomplete-recipe';
import { NamedCount } from '../../../core/api/generated/models/named-count';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { ParisDatePipe } from '../../../shared/format/paris-date.pipe';
import { formatBytes } from '../../../shared/format/units';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';

const MONTH = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });
const MONTH_YEAR = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const PERCENT = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 });

/** The property of the site in Google Analytics: visits, most viewed pages, where visitors come from. */
const ANALYTICS_URL = 'https://analytics.google.com/';

const MISSING_LABELS: Record<IncompleteRecipe['missing'][number], string> = {
  PHOTO: 'Photo',
  INTRO: 'Introduction',
  TIME: 'Temps',
  SERVINGS: 'Portions',
  DIFFICULTY: 'Difficulté',
};

/** A bar of a one-series chart: its share of the largest value, for its length. */
interface Bar {
  label: string;
  count: number;
  share: number;
  /** The recipe it stands for, linked from its label. */
  recipeId?: number;
}

/**
 * Dashboard of the back-office: what the site holds, how it grows, and the room the photos take
 * on the server's disk; then what to work on: recipes to complete, forgotten drafts, old recipes,
 * and what visitors searched for in vain. Charts have a single series, in the theme's accent
 * color; every value is written next to its bar, or in the table under the monthly chart. Visits
 * are in Google Analytics, linked from here. "Exporter en PDF" prints the page (print styles
 * keep the figures only), the browser offering to save it as a PDF.
 */
@Component({
  selector: 'yona-admin-stats',
  imports: [
    Icon,
    RouterLink,
    Button,
    ParisDatePipe,
  ],
  templateUrl: './admin-stats.html',
  styleUrl: './admin-stats.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminStats {
  private readonly api = inject(Api);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  protected readonly stats = resource({ loader: () => this.api.invoke(getStats, {}) });
  protected readonly formatBytes = formatBytes;
  protected readonly analyticsUrl = ANALYTICS_URL;
  protected readonly missingLabels = MISSING_LABELS;

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
  protected readonly mostViewed = computed(() => {
    const recipes = this.stats.value()?.mostViewedRecipes ?? [];
    return bars(recipes.map((recipe) => ({ name: recipe.title, count: recipe.viewCount }))).map((bar, index) => ({
      ...bar,
      recipeId: recipes[index].id,
    }));
  });

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

  /** The tables of the charts are printed open; the browser offers to save the print as a PDF. */
  protected exportPdf(): void {
    const closed = [...document.querySelectorAll<HTMLDetailsElement>('details:not([open])')];
    closed.forEach((details) => (details.open = true));
    window.print();
    closed.forEach((details) => (details.open = false));
  }

  /** One text, or all of them (term undefined). */
  protected async forgetSearch(term?: string): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: term ? 'Effacer cette recherche ?' : 'Effacer toutes les recherches ?',
      message: term
        ? `« ${term} » disparaîtra de la liste ; elle reviendra si un visiteur la cherche encore.`
        : 'La liste repartira de zéro avec les prochaines recherches sans résultat.',
      confirmLabel: 'Effacer',
    });
    if (confirmed && (await attempt(this.api.invoke(deleteSearchMisses, { term }))).ok) {
      this.toaster.success(term ? 'Recherche effacée.' : 'Recherches effacées.');
      this.stats.reload();
    }
  }
}

function bars(counts: NamedCount[]): Bar[] {
  const max = Math.max(1, ...counts.map((item) => item.count));
  return counts.map((item) => ({ label: item.name, count: item.count, share: item.count / max }));
}
