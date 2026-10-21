import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

/**
 * Site button, on a native <a> or <button> so that links stay links (SEO, middle click) and
 * buttons stay buttons. Icons go inside: <a yonaButton routerLink="/recettes">Voir plus <svg lucideArrowRight /></a>
 */
@Component({
  selector: 'a[yonaButton], button[yonaButton]',
  template: '<ng-content />',
  styleUrl: './button.scss',
  // Global, namespaced styles: they must reach the projected icons
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'button',
    '[class.button--secondary]': "variant() === 'secondary'",
    '[class.button--ghost]': "variant() === 'ghost'",
  },
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
}
