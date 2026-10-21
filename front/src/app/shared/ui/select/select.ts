import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { LucideCheck, LucideChevronDown } from '@lucide/angular';

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
 */
@Component({
  selector: 'yona-select',
  imports: [LucideCheck, LucideChevronDown],
  templateUrl: './select.html',
  styleUrl: './select.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.opens-up]': "direction() === 'up'",
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

  protected readonly id = `select-${nextId++}`;
  protected readonly open = signal(false);
  protected readonly activeIndex = signal(-1);
  protected readonly selectedIndex = computed(() =>
    this.options().findIndex((option) => Object.is(option.value, this.value())),
  );
  protected readonly selectedLabel = computed(
    () => this.options()[this.selectedIndex()]?.label ?? this.placeholder(),
  );

  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  protected toggle(): void {
    if (this.open()) {
      this.close();
    } else {
      this.show(this.selectedIndex());
    }
  }

  protected choose(index: number): void {
    const option = this.options()[index];
    if (option) {
      this.value.set(option.value);
    }
    this.close();
    this.trigger().nativeElement.focus();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const last = this.options().length - 1;
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
      } else {
        this.show(this.selectedIndex());
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (this.open()) {
        this.choose(this.activeIndex());
      } else {
        this.show(this.selectedIndex());
      }
    } else if (event.key === 'Escape' && this.open()) {
      event.preventDefault();
      this.close();
    } else if (event.key === 'Tab') {
      this.close();
    } else if (event.key.length === 1) {
      this.jumpTo(event.key);
    }
  }

  protected closeOnOutsideClick(event: MouseEvent): void {
    if (this.open() && !this.host.contains(event.target as Node)) {
      this.close();
    }
  }

  private show(index: number): void {
    this.open.set(true);
    this.activeIndex.set(Math.max(0, index));
  }

  private close(): void {
    this.open.set(false);
  }

  private jumpTo(letter: string): void {
    const start = this.activeIndex() + 1;
    const options = this.options();
    const matches = (option: SelectOption<T>) =>
      option.label.toLocaleLowerCase('fr').startsWith(letter.toLocaleLowerCase('fr'));
    const index = [...options.slice(start), ...options.slice(0, start)].findIndex(matches);
    if (index >= 0) {
      this.show((start + index) % options.length);
    }
  }
}
