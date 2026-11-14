import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CapArticle as CapArticleModel } from '../../core/api/generated/models/cap-article';
import { GlossaryTermResponse } from '../../core/api/generated/models/glossary-term-response';
import { glossaryMatcher } from '../../shared/format/glossary';
import { CapArticleView } from '../../shared/ui/cap-article/cap-article-view';

/** An article of "Mon CAP", on its own page: /mon-cap/{slug}. */
@Component({
  selector: 'yona-cap-article',
  imports: [CapArticleView],
  template: `
    <div class="container page enter">
      <yona-cap-article-view [article]="article()" [glossary]="matcher()" backLinks />
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
  /** From glossaryResolver: the words underlined in its texts. */
  readonly glossary = input<GlossaryTermResponse[]>([]);

  protected readonly matcher = computed(() => glossaryMatcher(this.glossary()));
}
