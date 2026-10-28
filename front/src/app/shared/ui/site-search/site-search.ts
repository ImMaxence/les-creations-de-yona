import { ChangeDetectionStrategy, Component, booleanAttribute, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { RECIPES_PATH } from '../../routing/links';
import { SearchChoice, searchTarget } from '../../search/search-target';
import { SearchBox } from '../search-box/search-box';

/**
 * The search of the site, outside the recipes page (header, home page): the typed text opens the
 * recipes page searched for it, a suggestion opens its recipe, its filtered list or its menu.
 */
@Component({
  selector: 'yona-site-search',
  imports: [SearchBox],
  template: `
    <yona-search-box
      [inline]="inline()"
      [large]="large()"
      [autofocus]="autofocus()"
      (searchSubmitted)="search($event)"
      (picked)="open($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteSearch {
  private readonly router = inject(Router);

  readonly inline = input(false, { transform: booleanAttribute });
  readonly large = input(false, { transform: booleanAttribute });
  readonly autofocus = input(false, { transform: booleanAttribute });
  /** Left for another page: the dialog holding it closes. */
  readonly navigated = output<void>();

  protected search(text: string): void {
    if (!text) {
      return;
    }
    void this.router.navigate([RECIPES_PATH], { queryParams: { q: text } });
    this.navigated.emit();
  }

  protected open(choice: SearchChoice): void {
    const { commands, queryParams } = searchTarget(choice.pick, choice.servings);
    void this.router.navigate(commands, { queryParams });
    this.navigated.emit();
  }
}
