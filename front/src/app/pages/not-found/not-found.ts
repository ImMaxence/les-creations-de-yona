import { ChangeDetectionStrategy, Component, RESPONSE_INIT, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight, LucideCookingPot } from '@lucide/angular';
import { RECIPES_PATH } from '../../shared/routing/links';
import { Button } from '../../shared/ui/button/button';

@Component({
  selector: 'yona-not-found',
  imports: [RouterLink, Button, LucideCookingPot, LucideArrowRight],
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
