import { ChangeDetectionStrategy, Component, computed, inject, input, model, resource } from '@angular/core';
import { Api } from '../../../core/api/generated/api';
import { listAdminCapEntries } from '../../../core/api/generated/fn/admin-mon-cap/list-admin-cap-entries';
import { AdminCapEntrySummary } from '../../../core/api/generated/models/admin-cap-entry-summary';
import { TitleSearch, TitledItem } from '../title-search/title-search';

export interface ChosenArticle {
  id: number;
  title: string;
  /** Its page: /mon-cap/{slug}. Follows the title until the article is published. */
  slug: string;
  published: boolean;
}

interface ArticleItem extends TitledItem {
  article: AdminCapEntrySummary;
}

/** An article of "Mon CAP", found by typing part of its title, drafts included (see TitleSearch). */
@Component({
  selector: 'yona-article-search',
  imports: [TitleSearch],
  template: `
    <yona-title-search
      label="Rechercher un article"
      removeLabel="Retirer l'article"
      noMatchText="Aucun article ne correspond"
      icon="graduation-cap"
      [hint]="hint()"
      [exclude]="excluded()"
      [items]="items()"
      [chosen]="chosenItem()"
      (chosenChange)="choose($event)"
    />
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleSearch {
  readonly hint = input('');
  /** The article being written: not a link to itself. */
  readonly current = input<number | null>(null);
  readonly chosen = model<ChosenArticle | null>(null);

  private readonly api = inject(Api);
  private readonly articles = resource({ loader: () => this.api.invoke(listAdminCapEntries) });

  protected readonly items = computed<ArticleItem[]>(() =>
    (this.articles.value() ?? []).map((article) => ({
      id: article.id,
      title: article.title,
      note: article.status === 'PUBLISHED' ? undefined : 'Non publié',
      article,
    })),
  );
  protected readonly excluded = computed<ReadonlySet<number>>(() => {
    const current = this.current();
    return new Set(current ? [current] : []);
  });
  protected readonly chosenItem = computed<TitledItem | null>(() => {
    const chosen = this.chosen();
    return chosen && { id: chosen.id, title: chosen.title };
  });

  protected choose(item: TitledItem | null): void {
    const article = (item as ArticleItem | null)?.article;
    this.chosen.set(
      article ? { id: article.id, title: article.title, slug: article.slug, published: article.status === 'PUBLISHED' } : null,
    );
  }
}
