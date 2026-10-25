import { ChangeDetectionStrategy, Component, ElementRef, signal, viewChild } from '@angular/core';

/** Buttons and links named only by their aria-label: icons without text. */
const TARGETS = 'button[aria-label], a[aria-label]';
const HOVER_DELAY_MS = 250;
const GAP_PX = 8;
const EDGE_PX = 8;

/**
 * Tooltips of every icon without text, once for a whole area (the back-office): the icon's
 * aria-label shows on mouse hover or keyboard focus, so no button has to declare its own. The
 * bubble is a popover, shown in the top layer: above modal dialogs too. Screen readers already
 * read the aria-label, so the bubble stays hidden from them. Touch screens, without hover, are
 * left alone. A data-no-tooltip ancestor opts a part out.
 */
@Component({
  selector: 'yona-tooltip-layer',
  template: `<div #bubble class="tooltip" popover="manual" aria-hidden="true" [class.is-open]="text() !== null"></div>`,
  styleUrl: './tooltip-layer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:pointerover)': 'onPointerOver($event)',
    '(document:pointerout)': 'onPointerOut($event)',
    '(document:focusin)': 'onFocusIn($event)',
    '(document:focusout)': 'hide()',
    '(document:pointerdown)': 'hide()',
    '(document:keydown.escape)': 'hide()',
    '(window:scroll)': 'hide()',
    '(window:resize)': 'hide()',
  },
})
export class TooltipLayer {
  protected readonly text = signal<string | null>(null);
  private readonly bubble = viewChild.required<ElementRef<HTMLElement>>('bubble');
  private current: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  protected onPointerOver(event: PointerEvent): void {
    const target = this.targetOf(event.target);
    if (event.pointerType !== 'mouse' || !target || target === this.current) {
      return;
    }
    this.hide();
    this.current = target;
    this.timer = setTimeout(() => this.show(target), HOVER_DELAY_MS);
  }

  protected onPointerOut(event: PointerEvent): void {
    // Moving within the same button (onto its icon) is not leaving it
    if (this.current && !this.current.contains(event.relatedTarget as Node | null)) {
      this.hide();
    }
  }

  protected onFocusIn(event: FocusEvent): void {
    const target = this.targetOf(event.target);
    if (target?.matches(':focus-visible')) {
      this.hide();
      this.current = target;
      this.show(target);
    }
  }

  protected hide(): void {
    clearTimeout(this.timer);
    this.current = null;
    if (this.text() !== null) {
      this.text.set(null);
      const bubble = this.bubble().nativeElement;
      if (bubble.matches(':popover-open')) {
        bubble.hidePopover();
      }
    }
  }

  /** The icon-only button or link under the pointer or focused, if any. */
  private targetOf(node: EventTarget | null): HTMLElement | null {
    const target = node instanceof Element ? node.closest<HTMLElement>(TARGETS) : null;
    if (!target || target.closest('[data-no-tooltip]') || target.matches(':disabled')) {
      return null;
    }
    // innerText ignores hidden text: a label shown on large screens only still counts as none
    return target.innerText.trim() ? null : target;
  }

  private show(target: HTMLElement): void {
    if (!target.isConnected) {
      return;
    }
    const bubble = this.bubble().nativeElement;
    this.text.set(target.getAttribute('aria-label'));
    // Written at once (not at the next change detection), to be measured right below
    bubble.textContent = this.text();
    if ('showPopover' in bubble && !bubble.matches(':popover-open')) {
      bubble.showPopover();
    }
    const anchor = target.getBoundingClientRect();
    const { width, height } = bubble.getBoundingClientRect();
    // Above the icon, or below it when there is no room; never past the sides of the screen
    const above = anchor.top - height - GAP_PX;
    const top = above >= EDGE_PX ? above : anchor.bottom + GAP_PX;
    const left = Math.min(
      Math.max(EDGE_PX, anchor.left + anchor.width / 2 - width / 2),
      window.innerWidth - width - EDGE_PX,
    );
    bubble.style.top = `${top}px`;
    bubble.style.left = `${left}px`;
  }
}
