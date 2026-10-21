import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideChefHat } from '@lucide/angular';

/** Logo and site name, linking to the home page: site header and phone menu. */
@Component({
  selector: 'yona-brand-logo',
  imports: [RouterLink, LucideChefHat],
  template: `
    <a routerLink="/" class="brand" aria-label="Les créations de Yona, accueil">
      <span class="brand__mark" aria-hidden="true">
        <svg lucideChefHat [size]="20" [strokeWidth]="1.75"></svg>
      </span>
      <span class="brand__name" aria-hidden="true">Les créations <em>de Yona</em></span>
    </a>
  `,
  styleUrl: './brand-logo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandLogo {}
