import { Injector, afterNextRender, signal } from '@angular/core';

/** Typing in one field goes back in one step, unless it stops this long… */
const PAUSE_MS = 1000;
/** …or lasts longer than this: a long paragraph goes back a few words at a time. */
const LONGEST_STEP_MS = 4000;
const MAX_STEPS = 200;
/** A change seen this soon after a key typed in a field comes from that key. */
const TYPED_WITHIN_MS = 300;

/** What the history needs from the editor. */
export interface EditHistoryOptions<T> {
  /** Puts a state back: every field of the editor shows it. */
  write: (state: T) => void;
  /** The editor's element: the field whose text changed gets the focus back after a step. */
  host: () => HTMLElement | undefined;
  injector: Injector;
}

interface Typing {
  target: EventTarget | null;
  kind: 'insert' | 'delete';
  startedAt: number;
  lastAt: number;
}

/**
 * Ctrl+Z and Ctrl+Y (⌘Z and ⌘⇧Z on a Mac) in an editor of the back-office, and its "Annuler" and
 * "Rétablir" buttons: whatever changed goes back, a word typed as a block moved, a formatting button
 * as a photo removed, whichever field it was in. The editor gives its whole state after each change
 * ({@link record}); a step is a state before a change. Words typed one after the other in a field are
 * one step, as in a word processor. Undone, the field changed gets the focus, its change selected.
 * The fields of a window (a dialog) and those marked {@code data-own-undo} keep the browser's own.
 */
export class EditHistory<T> {
  readonly canUndo = signal(false);
  readonly canRedo = signal(false);

  /** JSON of the states, the latest last. */
  private past: string[] = [];
  private future: string[] = [];
  private present: string | null = null;
  /** What it is a history of (a recipe's id): another one starts a new history. */
  private subject: unknown = undefined;
  private lastInput: { target: EventTarget | null; inputType: string; at: number } | null = null;
  private typing: Typing | null = null;

  constructor(private readonly options: EditHistoryOptions<T>) {}

  /** The editor as it is now, after a change; {@code subject} changed, a new history starts. */
  record(state: T, subject: unknown = null): void {
    const json = JSON.stringify(state);
    if (this.present === null || subject !== this.subject) {
      this.reset(state, subject);
      return;
    }
    if (json === this.present) {
      return;
    }
    const now = Date.now();
    const input = this.lastInput && now - this.lastInput.at < TYPED_WITHIN_MS ? this.lastInput : null;
    this.lastInput = null;
    const kind = input?.inputType.startsWith('insertText') || input?.inputType === 'insertCompositionText'
      ? 'insert'
      : input?.inputType.startsWith('delete')
        ? 'delete'
        : null;
    const typing = this.typing;
    if (
      kind &&
      typing &&
      typing.target === input!.target &&
      typing.kind === kind &&
      now - typing.lastAt < PAUSE_MS &&
      now - typing.startedAt < LONGEST_STEP_MS
    ) {
      typing.lastAt = now;
    } else {
      this.past.push(this.present);
      if (this.past.length > MAX_STEPS) {
        this.past.shift();
      }
      this.typing = kind ? { target: input!.target, kind, startedAt: now, lastAt: now } : null;
    }
    this.present = json;
    this.future = [];
    this.changed();
  }

  /** Nothing to undo: an editor just opened, another recipe. */
  reset(state: T, subject: unknown = null): void {
    this.present = JSON.stringify(state);
    this.subject = subject;
    this.past = [];
    this.future = [];
    this.typing = null;
    this.changed();
  }

  /** The same state written otherwise (as the API saved it): no step of its own. */
  replace(state: T): void {
    if (this.present !== null) {
      this.present = JSON.stringify(state);
    }
  }

  undo(): void {
    const previous = this.past.pop();
    if (previous === undefined || this.present === null) {
      return;
    }
    this.future.push(this.present);
    this.go(previous);
  }

  redo(): void {
    const next = this.future.pop();
    if (next === undefined || this.present === null) {
      return;
    }
    this.past.push(this.present);
    this.go(next);
  }

  /** Every key pressed in the page while the editor is open. */
  onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) {
      return;
    }
    // The letter, not the key's place: "z" is where "w" is on a French keyboard
    const key = event.key.toLowerCase();
    const redo = (key === 'y' && !event.shiftKey) || (key === 'z' && event.shiftKey);
    if (key !== 'z' && !redo) {
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    const host = this.options.host();
    if (target?.closest('dialog, [data-own-undo]') || (target && isField(target) && host && !host.contains(target))) {
      return;
    }
    event.preventDefault();
    if (redo) {
      this.redo();
    } else {
      this.undo();
    }
  }

  /** Every input event in the editor: typing is told from the other changes by it. */
  onInput(event: Event): void {
    this.lastInput = { target: event.target, inputType: event instanceof InputEvent ? event.inputType : '', at: Date.now() };
  }

  private go(state: string): void {
    const fields = this.fieldValues();
    this.present = state;
    this.typing = null;
    this.lastInput = null;
    this.options.write(JSON.parse(state) as T);
    this.changed();
    afterNextRender(() => this.showChange(fields), { injector: this.options.injector });
  }

  private changed(): void {
    this.canUndo.set(this.past.length > 0);
    this.canRedo.set(this.future.length > 0);
  }

  private fieldValues(): Map<Element, string> {
    const fields = new Map<Element, string>();
    this.options
      .host()
      ?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
      .forEach((field) => fields.set(field, field.value));
    return fields;
  }

  /** The one field whose text the step changed: focused, what changed selected (or the cursor where it was removed). */
  private showChange(before: Map<Element, string>): void {
    const changed = [...(this.options.host()?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea') ?? [])].filter(
      (field) => before.has(field) && before.get(field) !== field.value,
    );
    if (changed.length !== 1) {
      return;
    }
    const field = changed[0]!;
    const { from, to } = changedRange(before.get(field)!, field.value);
    field.focus();
    try {
      field.setSelectionRange(from, to);
    } catch {
      // A number or a date: no selection to set
    }
  }
}

/** Where {@code after} differs from {@code before}: the text put back, or the place of the text taken out. */
export function changedRange(before: string, after: string): { from: number; to: number } {
  let from = 0;
  while (from < before.length && from < after.length && before[from] === after[from]) {
    from++;
  }
  let end = 0;
  while (end < before.length - from && end < after.length - from && before[before.length - 1 - end] === after[after.length - 1 - end]) {
    end++;
  }
  const to = after.length - end;
  // Text only added: the cursor after it, as after typing it; text replaced: the new one selected
  return before.length - end > from ? { from, to } : { from: to, to };
}

function isField(element: Element): boolean {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || (element as HTMLElement).isContentEditable;
}
