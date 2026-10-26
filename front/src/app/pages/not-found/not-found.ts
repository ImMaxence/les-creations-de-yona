import { ChangeDetectionStrategy, Component, RESPONSE_INIT, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RECIPES_PATH } from '../../shared/routing/links';
import { Button } from '../../shared/ui/button/button';
import { Icon } from '../../shared/ui/icon/icon';

@Component({
  selector: 'yona-not-found',
  imports: [Icon, RouterLink, Button],
  templateUrl: './not-found.html',
  styleUrl: '../error-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class NotFound {
  protected readonly recipesPath = RECIPES_PATH;

  constructor() {
    // Real 404 status for search engines when rendered on the server (null in the browser)
    const response = inject(RESPONSE_INIT, { optional: true });
    if (response) {
      response.status = 404;
    }
  }
}
