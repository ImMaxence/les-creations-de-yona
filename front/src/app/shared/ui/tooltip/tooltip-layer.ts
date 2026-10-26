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
  // is-open is set by show() and hide() themselves: the bubble must be visible to be measured
  template: `<div #bubble class="tooltip" popover="manual" aria-hidden="true"></div>`,
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
      bubble.classList.remove('is-open');
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
    // Written and shown at once (not at the next change detection): a hidden bubble measures 0 × 0
    bubble.textContent = this.text();
    bubble.classList.add('is-open');
    if ('showPopover' in bubble && !bubble.matches(':popover-open')) {
      bubble.showPopover();
    }
    const { top, left } = placeBeside(target.getBoundingClientRect(), bubble.getBoundingClientRect());
    bubble.style.top = `${top}px`;
    bubble.style.left = `${left}px`;
  }
}

/**
 * Beside the icon, never over it: on its right, vertically centered; on its left when the right
 * has no room; above it (or below) when neither side has. Never past the edges of the screen.
 */
function placeBeside(anchor: DOMRect, bubble: { width: number; height: number }): { top: number; left: number } {
  const { width, height } = bubble;
  const centeredTop = clamp(anchor.top + anchor.height / 2 - height / 2, EDGE_PX, window.innerHeight - height - EDGE_PX);
  if (anchor.right + GAP_PX + width <= window.innerWidth - EDGE_PX) {
    return { top: centeredTop, left: anchor.right + GAP_PX };
  }
  if (anchor.left - GAP_PX - width >= EDGE_PX) {
    return { top: centeredTop, left: anchor.left - GAP_PX - width };
  }
  const above = anchor.top - height - GAP_PX;
  return {
    top: above >= EDGE_PX ? above : anchor.bottom + GAP_PX,
    left: clamp(anchor.left + anchor.width / 2 - width / 2, EDGE_PX, window.innerWidth - width - EDGE_PX),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(min, value), max);
}
