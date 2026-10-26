import { ChangeDetectionStrategy, Component, DOCUMENT, RESPONSE_INIT, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from '../../shared/ui/button/button';
import { Icon } from '../../shared/ui/icon/icon';

/** Shown in place of a page whose data could not be loaded (API down, unexpected error). */
@Component({
  selector: 'yona-server-error',
  imports: [Icon, RouterLink, Button],
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
