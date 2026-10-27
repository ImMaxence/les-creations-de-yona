import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  booleanAttribute,
  afterNextRender,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Icon } from '../icon/icon';

export interface SelectOption<T> {
  value: T;
  label: string;
}

let nextId = 0;

/**
 * Drop-down list styled like the rest of the site (a native <select> opens the system's own
 * list). Follows the ARIA "select-only combobox" pattern: arrows, Home/End, Enter or Space to
 * choose, Escape to close, and typing a letter jumps to the matching option.
 * Two-way binding: <yona-select [(value)]="size" [options]="sizes" label="Recettes par page" />
 * Long lists (ingredients) can be "searchable": a field at the top of the open list filters them.
 */
@Component({
  selector: 'yona-select',
  imports: [Icon],
  templateUrl: './select.html',
  styleUrl: './select.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.opens-up]': "direction() === 'up'",
    '[class.is-large]': "size() === 'large'",
    '(document:click)': 'closeOnOutsideClick($event)',
  },
})
export class Select<T> {
  readonly options = input.required<SelectOption<T>[]>();
  readonly value = model<T>();
  /** Accessible name, read by screen readers. */
  readonly label = input.required<string>();
  readonly placeholder = input('Choisir…');
  /** "up" near the bottom of the page. */
  readonly direction = input<'up' | 'down'>('down');
  readonly disabled = input(false);
  /** "large": as tall as the site's search fields, next to them. */
  readonly size = input<'medium' | 'large'>('medium');
  /** A filter field at the top of the open list, accents and case ignored. */
  readonly searchable = input(false, { transform: booleanAttribute });
  /**
   * A list to pick from rather than a value to hold ("Ajouter un ingrédient"): the choice is sent
   * through `picked` and the button keeps showing the placeholder.
   */
  readonly pickOnly = input(false, { transform: booleanAttribute });
  readonly picked = output<T>();

  protected readonly id = `select-${nextId++}`;
  protected readonly open = signal(false);
  /** Position in shown(), not in options(). */
  protected readonly activeIndex = signal(-1);
  protected readonly filter = signal('');
  /** Options matching the filter, with their position in options(). */
  protected readonly shown = computed(() => {
    const typed = normalize(this.filter());
    return this.options()
      .map((option, index) => ({ option, index }))
      .filter(({ option }) => !typed || normalize(option.label).includes(typed));
  });
  protected readonly selectedIndex = computed(() =>
    this.options().findIndex((option) => Object.is(option.value, this.value())),
  );
  protected readonly selectedLabel = computed(
    () => this.options()[this.selectedIndex()]?.label ?? this.placeholder(),
  );

  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly filterInput = viewChild<ElementRef<HTMLInputElement>>('filterInput');
  private readonly injector = inject(Injector);

  protected toggle(): void {
    if (this.open()) {
      this.close();
    } else {
      this.show(this.selectedIndex());
    }
  }

  protected choose(position: number): void {
    const option = this.shown()[position]?.option;
    if (option && this.pickOnly()) {
      this.picked.emit(option.value);
    } else if (option) {
      this.value.set(option.value);
    }
    this.close();
    this.trigger().nativeElement.focus();
  }

  protected onFilterInput(event: Event): void {
    this.filter.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(0);
  }

  /** From the button, or from the filter field (where letters and spaces are typed). */
  protected onKeydown(event: KeyboardEvent, fromFilter = false): void {
    const last = this.shown().length - 1;
    const moves: Record<string, () => number> = {
      ArrowDown: () => Math.min(last, this.activeIndex() + 1),
      ArrowUp: () => Math.max(0, this.activeIndex() - 1),
      Home: () => 0,
      End: () => last,
    };

    if (event.key in moves) {
      event.preventDefault();
      if (this.open()) {
        this.activeIndex.set(moves[event.key]());
        this.revealActive();
      } else {
        this.show(this.selectedIndex());
      }
    } else if (event.key === 'Enter' || (event.key === ' ' && !fromFilter)) {
      event.preventDefault();
      if (this.open()) {
        this.choose(this.activeIndex());
      } else {
        this.show(this.selectedIndex());
      }
    } else if (event.key === 'Escape' && this.open()) {
      event.preventDefault();
      this.close();
      this.trigger().nativeElement.focus();
    } else if (event.key === 'Tab') {
      this.close();
    } else if (event.key.length === 1 && !fromFilter) {
      this.jumpTo(event.key);
    }
  }

  protected closeOnOutsideClick(event: MouseEvent): void {
    if (this.open() && !this.host.contains(event.target as Node)) {
      this.close();
    }
  }

  private show(index: number): void {
    this.filter.set('');
    this.open.set(true);
    this.activeIndex.set(Math.max(0, index));
    if (this.searchable()) {
      afterNextRender(() => this.filterInput()?.nativeElement.focus(), { injector: this.injector });
    }
    this.revealActive();
  }

  private close(): void {
    this.open.set(false);
  }

  /** The list shows no scroll bar: it follows the keyboard (and opens on the chosen option). */
  private revealActive(): void {
    afterNextRender(
      () => this.host.querySelector(`#${this.id}-${this.activeIndex()}`)?.scrollIntoView({ block: 'nearest' }),
      { injector: this.injector },
    );
  }

  private jumpTo(letter: string): void {
    const start = this.activeIndex() + 1;
    const options = this.shown().map(({ option }) => option);
    const matches = (option: SelectOption<T>) =>
      option.label.toLocaleLowerCase('fr').startsWith(letter.toLocaleLowerCase('fr'));
    const index = [...options.slice(start), ...options.slice(0, start)].findIndex(matches);
    if (index >= 0) {
      this.show((start + index) % options.length);
    }
  }
}

/** "Crème" and "creme" match. */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr').trim();
}
