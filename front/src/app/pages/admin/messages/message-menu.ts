import { ChangeDetectionStrategy, Component, ElementRef, signal, viewChild } from '@angular/core';
import { Icon } from '../../../shared/ui/icon/icon';
import { IconName } from '../../../shared/ui/icon/icons';

/** A choice of the menu of a message: "Répondre", "Copier", "Supprimer". */
export interface MessageAction {
  label: string;
  icon: IconName;
  /** In red: "Supprimer". */
  danger?: boolean;
  run: () => void;
}

/** Room kept between the menu and the edges of the screen, and between the message and its menu. */
const EDGE = 16;
const GAP = 8;
/** The height of a choice of the menu (see .action), to place it before it is drawn. */
const ACTION_HEIGHT = 48;

/** The tap that ends the long press is no tap on the menu. */
const OPENING_MS = 400;

/**
 * As on Instagram, on a phone: a long press on a message lifts it over the conversation, dimmed and
 * blurred, its choices under it (above it, near the bottom of the screen). A copy of the message is
 * shown, where it was: the conversation does not move. A tap beside it, Échap or a choice closes it.
 * A native <dialog> (showModal): above everything, the focus kept inside.
 */
@Component({
  selector: 'yona-message-menu',
  imports: [Icon],
  template: `
    <dialog #dialog class="menu" tabindex="-1" aria-label="Options du message" (close)="onClosed()" (click)="onClick($event)">
      @if (place(); as at) {
        <div class="stage" [class.is-mine]="at.mine" [style.top.px]="at.top" [style.left.px]="at.left" [style.width.px]="at.width">
          <ol #copy role="list" class="copy" aria-hidden="true" [style.max-height.px]="at.maxHeight"></ol>
          <ul role="menu" class="actions" aria-label="Options du message">
            @for (action of actions(); track action.label) {
              <li role="none">
                <button type="button" role="menuitem" class="action" [class.is-danger]="action.danger" (click)="choose(action)">
                  {{ action.label }}<svg [yonaIcon]="action.icon" [size]="20"></svg>
                </button>
              </li>
            }
          </ul>
        </div>
      }
    </dialog>
  `,
  styleUrl: './message-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageMenu {
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly copy = viewChild<ElementRef<HTMLElement>>('copy');

  protected readonly actions = signal<MessageAction[]>([]);
  protected readonly place = signal<{ top: number; left: number; width: number; maxHeight: number; mine: boolean } | null>(null);
  private openedAt = 0;

  /** The message's row (li.message), copied over the dimmed conversation, its choices with it. */
  open(row: HTMLElement, actions: MessageAction[]): void {
    const rect = row.getBoundingClientRect();
    const view = row.ownerDocument.defaultView;
    const height = view?.visualViewport?.height ?? view?.innerHeight ?? rect.bottom;
    const menu = actions.length * ACTION_HEIGHT + 2 * GAP;
    // The message where it was; pushed up for its menu to fit under it, cut when taller than the room left
    const maxHeight = Math.max(ACTION_HEIGHT, height - 2 * EDGE - GAP - menu);
    const shown = Math.min(rect.height, maxHeight);
    const top = Math.max(EDGE, Math.min(rect.top, height - EDGE - menu - GAP - shown));
    this.actions.set(actions);
    this.place.set({ top, left: rect.left, width: rect.width, maxHeight, mine: row.classList.contains('is-mine') });
    const dialog = this.dialog().nativeElement;
    dialog.showModal();
    // showModal() focuses the first choice, and Safari then shows its focus ring after a long press
    dialog.focus();
    this.openedAt = Date.now();
    // Drawn now (place set): the copy of the message, without its buttons nor its entrance
    queueMicrotask(() => this.fill(row));
  }

  private fill(row: HTMLElement): void {
    const copy = this.copy()?.nativeElement;
    if (!copy) {
      requestAnimationFrame(() => this.fill(row));
      return;
    }
    const clone = row.cloneNode(true) as HTMLElement;
    clone.classList.remove('is-arrived', 'is-swiping', 'is-swiped');
    clone.removeAttribute('data-id');
    clone.querySelectorAll('.message__actions, yona-swipe-hint').forEach((element) => element.remove());
    clone.querySelectorAll<HTMLElement>('.message__face, .message__content').forEach((part) => {
      part.style.translate = '';
      part.style.transition = '';
    });
    clone.style.contentVisibility = 'visible';
    clone.inert = true;
    copy.replaceChildren(clone);
  }

  close(): void {
    const dialog = this.dialog().nativeElement;
    if (dialog.open) {
      dialog.close();
    }
  }

  protected choose(action: MessageAction): void {
    this.close();
    action.run();
  }

  /** A tap beside the message and its menu closes it; not the end of the long press that opened it. */
  protected onClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (Date.now() - this.openedAt > OPENING_MS && !target.closest('.actions')) {
      this.close();
    }
  }

  protected onClosed(): void {
    this.place.set(null);
    this.actions.set([]);
  }
}
