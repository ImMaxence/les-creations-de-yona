import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CapArticle as CapArticleModel } from '../../core/api/generated/models/cap-article';
import { CapArticleView } from '../../shared/ui/cap-article/cap-article-view';

/** An article of "Mon CAP", on its own page: /mon-cap/{slug}. */
@Component({
  selector: 'yona-cap-article',
  imports: [CapArticleView],
  template: `
    <div class="container page enter">
      <yona-cap-article-view [article]="article()" backLinks />
    </div>
  `,
  styles: `
    .page {
      padding-block: var(--space-7) var(--space-8);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class CapArticle {
  /** From capArticleResolver. */
  readonly article = input.required<CapArticleModel>();
}
