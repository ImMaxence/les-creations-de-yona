import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/** The first letter of a name, in capitals; "?" for no name at all. */
export function initialOf(name: string): string {
  return [...name.trim()][0]?.toLocaleUpperCase('fr') ?? '?';
}

/**
 * The photo of the admin's Google account or, without one (or if it does not load), the first
 * letter of their name. Decorative: the name is written beside it.
 */
@Component({
  selector: 'yona-admin-avatar',
  template: `
    @if (picture() && !failed()) {
      <!-- Google refuses these photos to a page that says where it comes from -->
      <img [src]="picture()" alt="" referrerpolicy="no-referrer" (error)="failed.set(true)" />
    } @else {
      <span aria-hidden="true">{{ initial() }}</span>
    }
  `,
  styles: `
    :host {
      display: grid;
      flex: none;
      place-items: center;
      width: 2.5rem;
      height: 2.5rem;
      overflow: hidden;
      border-radius: 50%;
      background-color: var(--color-accent);
      color: var(--color-on-accent);
      font-family: var(--font-display);
      font-size: var(--text-lg);
      font-weight: 600;
      line-height: 1;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAvatar {
  readonly name = input.required<string>();
  readonly picture = input<string | null>();

  protected readonly failed = signal(false);
  protected readonly initial = computed(() => initialOf(this.name()));
}
