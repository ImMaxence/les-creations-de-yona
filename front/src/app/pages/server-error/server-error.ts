import { ChangeDetectionStrategy, Component, DOCUMENT, RESPONSE_INIT, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideRotateCw, LucideUtensilsCrossed } from '@lucide/angular';
import { Button } from '../../shared/ui/button/button';

/** Shown in place of a page whose data could not be loaded (API down, unexpected error). */
@Component({
  selector: 'yona-server-error',
  imports: [RouterLink, Button, LucideUtensilsCrossed, LucideRotateCw],
  templateUrl: './server-error.html',
  styleUrl: '../error-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ServerError {
  private readonly document = inject(DOCUMENT);

  constructor() {
    const response = inject(RESPONSE_INIT, { optional: true });
    if (response) {
      response.status = 503;
    }
  }

  protected reload(): void {
    this.document.location.reload();
  }
}
