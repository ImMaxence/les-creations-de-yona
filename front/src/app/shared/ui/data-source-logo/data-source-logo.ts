import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from '../icon/icon';

export type DataSourceName = 'ciqual' | 'open-food-facts';

/**
 * Where nutrition facts come from, beside its name. Open Food Facts: its own mark (open-food-facts.org, the
 * icon of its logo), naming the source of the data. Ciqual: the official site was down when this was written, and
 * the "République française" mark of the Anses is reserved to the State: a plain icon until its own logo can be
 * used.
 */
@Component({
  selector: 'yona-data-source-logo',
  imports: [Icon],
  template: `
    @if (name() === 'open-food-facts') {
      <svg viewBox="0 0 178 178" [attr.width]="size()" [attr.height]="size()" aria-hidden="true" focusable="false">
        <g transform="translate(-33.85,-30.075)">
          <path d="m61.62 122.32c0-33.82 27.41-61.23 61.23-61.23s61.23 27.41 61.23 61.23z" fill="#ff8c14" />
          <path d="m168.55 122.32c0 25.24-20.46 45.71-45.71 45.71-25.24 0-45.71-20.46-45.71-45.71z" fill="#fff" />
          <circle cx="143.58" cy="82.78" r="3.37" fill="#8c3c00" />
          <circle cx="159.98" cy="97.84" r="3.37" fill="#8c3c00" />
          <circle cx="141.43" cy="101.52" r="3.37" fill="#8c3c00" />
          <path
            d="m93.15 175.84-10.88 25.97 14.32 6 10.97-26.19c4.89 1.26 10.01 1.93 15.29 1.93 33.76 0 61.23-27.47 61.23-61.23h-15.52c0 25.2-20.5 45.71-45.71 45.71s-45.71-20.5-45.71-45.71h-15.52c0 22.99 12.74 43.05 31.53 53.52z"
            fill="currentColor"
          />
          <path d="m148.17 30.34c-12.04 0-22.5 6.71-27.88 16.59 4.14 3.86 7.27 8.79 8.89 14.38 14.01-3.14 24.53-15.53 24.77-30.43-1.87-.35-3.8-.53-5.78-.53z" fill="#00641e" />
          <path d="m98.68 38.42c-2.38 0-4.7.27-6.94.77 3.83 13.23 16.03 22.91 30.5 22.91 2.38 0 4.7-.27 6.94-.77-3.83-13.23-16.03-22.91-30.5-22.91z" fill="#00961e" />
        </g>
      </svg>
    } @else {
      <svg yonaIcon="carrot" [size]="size()" [strokeWidth]="1.75"></svg>
    }
  `,
  styles: `
    :host {
      display: inline-grid;
      flex: none;
      place-items: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataSourceLogo {
  readonly name = input.required<DataSourceName>();
  readonly size = input(18);
}
