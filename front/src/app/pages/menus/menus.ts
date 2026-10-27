import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteData } from '../../core/site/site-data';
import { Reveal } from '../../shared/motion/reveal';
import { RECIPES_PATH } from '../../shared/routing/links';
import { MenuCard } from './menu-card';

/** "Menus": those put together by Yona for an occasion, the latest updated first. */
@Component({
  selector: 'yona-menus',
  imports: [MenuCard, Reveal, RouterLink],
  template: `
    <section class="container menus">
      <header class="menus__head">
        <p class="eyebrow enter">Pour chaque occasion</p>
        <h1 class="enter" style="--delay: 60ms">Menus</h1>
        <p class="menus__lead enter" style="--delay: 120ms">
          Des recettes réunies pour une fête, un goûter ou un repas entre amis : toutes à la liste de courses en un geste
        </p>
      </header>

      @if (menus().length) {
        <ul role="list" class="menus__grid">
          @for (menu of menus(); track menu.slug; let i = $index) {
            <li yonaReveal [revealDelay]="(i % 3) * 90"><yona-menu-card [menu]="menu" /></li>
          }
        </ul>
      } @else {
        <p class="menus__empty">
          Les premiers menus arrivent bientôt. En attendant, <a [routerLink]="recipesPath">toutes les recettes</a>
        </p>
      }
    </section>
  `,
  styleUrl: './menus.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Menus {
  protected readonly menus = inject(SiteData).menus;
  protected readonly recipesPath = RECIPES_PATH;
}
