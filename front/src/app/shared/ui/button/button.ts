import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';

/** danger: a destructive action that cannot be undone (back-office). */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/**
 * Site button, on a native <a> or <button> so that links stay links (SEO, middle click) and
 * buttons stay buttons. Icons go inside: <a yonaButton routerLink="/recettes">Voir plus <svg yonaIcon="arrow-right" /></a>
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
    '[class.button--danger]': "variant() === 'danger'",
  },
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
}
