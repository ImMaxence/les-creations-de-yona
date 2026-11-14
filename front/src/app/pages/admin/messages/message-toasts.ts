import { ChangeDetectionStrategy, Component, DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UnseenMessage } from '../../../core/api/generated/models/unseen-message';
import { Icon } from '../../../shared/ui/icon/icon';
import { AdminAvatar } from '../layout/admin-avatar/admin-avatar';

/** Long enough to read two lines; counted only while the page is in sight and the toast is not pointed at. */
export const TOAST_MS = 8_000;

/** More would hide the page: the oldest goes. */
export const MAX_TOASTS = 3;

/** "Léa" for "Léa Martin", "lea@exemple.fr" for an admin without a name. */
export function firstNameOf(message: UnseenMessage): string {
  return message.authorName.includes('@') ? message.authorName : message.authorName.split(/\s+/)[0]!;
}

/** The start of the message, or its photos when it has no text. */
export function toastText(message: UnseenMessage): string {
  if (message.text) {
    return message.text;
  }
  return message.photos > 1 ? `${message.photos} photos` : 'Une photo';
}

/**
 * The messages of the others as they come, at the top right of every page of the back-office (2.18), as a chat
 * shows them: who, in which group, the start of what they wrote. The newest on top, one per group (the next one of
 * a group takes its place), three at most. Each goes after a few seconds, or at once when opened or closed.
 */
@Injectable({ providedIn: 'root' })
export class MessageToasts {
  private readonly document = inject(DOCUMENT);
  readonly shown = signal<UnseenMessage[]>([]);
  /** The message ids already shown: a count asked again does not show the same one twice. */
  private readonly told = new Set<number>();
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly held = new Set<number>();

  constructor() {
    // Hidden, the page keeps its toasts for when the admin comes back
    this.document.addEventListener('visibilitychange', () => {
      for (const message of this.shown()) {
        if (this.document.visibilityState === 'visible') {
          this.start(message.id);
        } else {
          this.stop(message.id);
        }
      }
    });
  }

  show(message: UnseenMessage): void {
    if (this.told.has(message.id)) {
      return;
    }
    this.told.add(message.id);
    // Its group's toast replaced, the oldest gone beyond three
    const shown = [message, ...this.shown().filter((other) => other.groupId !== message.groupId)].slice(0, MAX_TOASTS);
    this.shown()
      .filter((other) => !shown.includes(other))
      .forEach((other) => this.dismiss(other.id));
    this.shown.set(shown);
    if (this.document.visibilityState === 'visible') {
      this.start(message.id);
    }
  }

  dismiss(id: number): void {
    this.stop(id);
    this.held.delete(id);
    this.shown.update((shown) => shown.filter((message) => message.id !== id));
  }

  /** Pointed at or focused: it stays while it is read. */
  hold(id: number): void {
    this.held.add(id);
    this.stop(id);
  }

  release(id: number): void {
    this.held.delete(id);
    this.start(id);
  }

  private start(id: number): void {
    this.stop(id);
    if (!this.held.has(id)) {
      this.timers.set(
        id,
        setTimeout(() => this.dismiss(id), TOAST_MS),
      );
    }
  }

  private stop(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
  }
}

/** The toasts of {@link MessageToasts}, in the admin layout. */
@Component({
  selector: 'yona-message-toasts',
  imports: [AdminAvatar, Icon],
  template: `
    <!-- Always there, so that screen readers announce what comes into it -->
    <section class="toasts" aria-label="Nouveaux messages" aria-live="polite">
      @for (message of toasts.shown(); track message.id) {
        <article
          class="toast"
          animate.enter="toast-enter"
          animate.leave="toast-leave"
          (mouseenter)="toasts.hold(message.id)"
          (mouseleave)="toasts.release(message.id)"
          (focusin)="toasts.hold(message.id)"
          (focusout)="toasts.release(message.id)"
        >
          <button type="button" class="toast__open" (click)="open(message)">
            <yona-admin-avatar [name]="message.authorName" [picture]="message.authorPicture" />
            <span class="toast__body">
              <span class="toast__head">
                <strong>{{ firstName(message) }}</strong>
                <span class="toast__group">{{ message.groupName }}</span>
              </span>
              <span class="toast__text">{{ text(message) }}</span>
            </span>
          </button>
          <button type="button" class="toast__close" aria-label="Fermer la notification" (click)="toasts.dismiss(message.id)">
            <svg yonaIcon="x" [size]="16"></svg>
          </button>
        </article>
      }
    </section>
  `,
  styles: `
    .toasts {
      position: fixed;
      top: var(--space-4);
      right: var(--space-4);
      z-index: 60;
      display: grid;
      gap: var(--space-2);
      width: min(23rem, calc(100vw - 2rem));
      pointer-events: none;
    }

    .toast {
      position: relative;
      display: flex;
      align-items: flex-start;
      border-radius: var(--radius-md);
      background-color: var(--color-surface);
      box-shadow: var(--shadow-md), 0 0 0 1px var(--color-line);
      pointer-events: auto;
    }

    .toast__open {
      display: flex;
      flex: 1;
      align-items: flex-start;
      gap: var(--space-3);
      min-width: 0;
      padding: var(--space-3) var(--space-2) var(--space-3) var(--space-3);
      border: 0;
      border-radius: inherit;
      background: none;
      color: var(--color-text);
      font: inherit;
      text-align: left;
      cursor: pointer;

      &:focus-visible {
        outline: 2px solid var(--color-accent);
        outline-offset: 2px;
      }
    }

    .toast__body {
      display: grid;
      gap: 2px;
      min-width: 0;
    }

    .toast__head {
      display: flex;
      align-items: baseline;
      gap: var(--space-2);
      min-width: 0;
    }

    .toast__group {
      overflow: hidden;
      font-size: var(--text-xs);
      white-space: nowrap;
      text-overflow: ellipsis;
      color: var(--color-text-muted);
    }

    .toast__text {
      display: -webkit-box;
      overflow: hidden;
      font-size: var(--text-sm);
      overflow-wrap: anywhere;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .toast__close {
      display: grid;
      flex: none;
      place-items: center;
      width: 2.25rem;
      height: 2.25rem;
      margin: var(--space-2) var(--space-2) 0 0;
      border: 0;
      border-radius: 50%;
      background: none;
      color: var(--color-text-muted);
      cursor: pointer;

      &:hover {
        background-color: color-mix(in srgb, var(--color-line) 50%, transparent);
        color: var(--color-text);
      }

      &:focus-visible {
        outline: 2px solid var(--color-accent);
      }
    }

    .toast-enter {
      animation: toast-in var(--duration-base, 200ms) var(--ease-out, ease-out);
    }

    .toast-leave {
      animation: toast-in var(--duration-fast, 150ms) ease-in reverse forwards;
    }

    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateX(1.5rem);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .toast-enter,
      .toast-leave {
        animation: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageToastStack {
  protected readonly toasts = inject(MessageToasts);
  private readonly router = inject(Router);
  protected readonly firstName = firstNameOf;
  protected readonly text = toastText;

  /** Its conversation, the toast gone. */
  protected open(message: UnseenMessage): void {
    this.toasts.dismiss(message.id);
    void this.router.navigate(['/admin/messages'], { queryParams: { groupe: message.groupId } });
  }
}
