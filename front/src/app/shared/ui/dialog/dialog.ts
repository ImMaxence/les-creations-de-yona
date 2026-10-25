import { ChangeDetectionStrategy, Component, ElementRef, booleanAttribute, effect, input, model, output, viewChild } from '@angular/core';
import { LucideX } from '@lucide/angular';

export type DialogSize = 'sm' | 'md' | 'lg' | 'full';

let nextId = 0;

/**
 * Every modal of the site. A native <dialog> opened with showModal(): focus kept inside, Escape
 * closes it, the page behind is inert. The head (title, close button) stays at the top and the
 * actions at the bottom; only the content between them scrolls.
 *
 * <yona-dialog title="Supprimer ?" [(open)]="asking">
 *   <p>Contenu…</p>
 *   <ng-container dialogActions><button yonaButton>OK</button></ng-container>
 * </yona-dialog>
 */
@Component({
  selector: 'yona-dialog',
  imports: [LucideX],
  templateUrl: './dialog.html',
  styleUrl: './dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dialog {
  readonly title = input.required<string>();
  /** Under the title, in smaller type (e.g. the status of a previewed recipe). */
  readonly subtitle = input<string>();
  /** sm: a question; md: a form; lg: a grid of photos; full: the whole screen. */
  readonly size = input<DialogSize>('md');
  /** "alertdialog" for a question that needs an answer (confirmation). */
  readonly role = input<'dialog' | 'alertdialog'>('dialog');
  /**
   * Always as tall as the screen allows (within a limit), whatever its content: a list that
   * loads, filters or changes page does not make the dialog jump.
   */
  readonly fixedHeight = input(false, { transform: booleanAttribute });
  /** A click on the dimmed page around closes it (true by default). */
  readonly closeOnBackdrop = input(true, { transform: booleanAttribute });
  readonly open = model(false);
  /** Closed in any way: close button, Escape, backdrop, or open set to false. */
  readonly closed = output();

  protected readonly titleId = `dialog-title-${nextId++}`;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly body = viewChild.required<ElementRef<HTMLElement>>('body');

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.open() && !dialog.open) {
        dialog.showModal();
        this.scrollToTop();
      } else if (!this.open() && dialog.open) {
        dialog.close();
      }
    });
  }

  close(): void {
    this.open.set(false);
  }

  /** E.g. after showing another page of a list. */
  scrollToTop(): void {
    this.body().nativeElement.scrollTop = 0;
  }

  /** The native "close" event: Escape included. */
  protected onClose(): void {
    this.open.set(false);
    this.closed.emit();
  }

  /** The backdrop belongs to the <dialog> itself: a click on it targets the element, not its content. */
  protected onClick(event: MouseEvent): void {
    if (this.closeOnBackdrop() && event.target === this.dialog().nativeElement) {
      this.close();
    }
  }
}
