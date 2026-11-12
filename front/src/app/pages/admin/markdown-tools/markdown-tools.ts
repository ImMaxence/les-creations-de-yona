import { ChangeDetectionStrategy, Component, booleanAttribute, effect, input } from '@angular/core';
import { Icon } from '../../../shared/ui/icon/icon';
import { IconName } from '../../../shared/ui/icon/icons';
import { TextEdit, continueList, toggleInline, toggleLines } from './markdown-edit';

export type MarkdownTool = 'title' | 'bold' | 'italic' | 'list';

const TOOLS: Record<MarkdownTool, { label: string; icon: IconName; key?: string; placeholder?: string }> = {
  title: { label: 'Intertitre', icon: 'heading-2' },
  bold: { label: 'Gras', icon: 'bold', key: 'B', placeholder: 'texte en gras' },
  italic: { label: 'Italique', icon: 'italic', key: 'I', placeholder: 'texte en italique' },
  list: { label: 'Liste', icon: 'list' },
};

/** "⌘" on a Mac, "Ctrl+" elsewhere. */
const MODIFIER = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl+';

/**
 * The formatting buttons over a text field written in Markdown (a step, the tip, a text of an
 * article), and their keys in the field: Ctrl+B, Ctrl+I, and Entrée in a list starting the next
 * item. A button reads what is there before writing (markdown-edit.ts): bold words lose their bold.
 * The field keeps the focus and its selection; it is told of the change by an input event, as if typed,
 * and Ctrl+Z (EditHistory) takes it back. Other buttons (a link to a recipe) can go inside.
 */
@Component({
  selector: 'yona-markdown-tools',
  imports: [Icon],
  host: { role: 'toolbar', 'aria-label': 'Mise en forme' },
  template: `
    @for (tool of tools(); track tool) {
      <!-- mousedown kept from the field: its words stay selected -->
      <button
        type="button"
        class="tool"
        [class.tool--labelled]="labelled()"
        [attr.aria-label]="labelled() ? null : label(tool)"
        [attr.data-tooltip]="labelled() && tool !== 'title' ? label(tool) : null"
        (mousedown)="$event.preventDefault()"
        (click)="apply(tool)"
      >
        <svg [yonaIcon]="toolOf(tool).icon" [size]="16"></svg>
        @if (labelled()) {
          <span>{{ toolOf(tool).label }}</span>
        }
      </button>
    }
    <ng-content />
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-1);
    }

    .tool {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-1);
      min-width: 2rem;
      min-height: 2rem;
      padding: 0 var(--space-2);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-sm);
      background-color: var(--color-bg);
      color: var(--color-text);
      font-size: var(--text-xs);
      font-weight: 600;

      @include m.hover {
        border-color: var(--color-accent);
      }
    }

    .tool--labelled {
      padding-inline: var(--space-3);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarkdownTools {
  readonly field = input.required<HTMLTextAreaElement>();
  readonly tools = input<readonly MarkdownTool[]>(['bold', 'italic', 'list']);
  /** Names written next to the icons, where there is room. */
  readonly labelled = input(false, { transform: booleanAttribute });

  constructor() {
    effect((onCleanup) => {
      const field = this.field();
      const keydown = (event: KeyboardEvent) => this.onKeydown(event);
      field.addEventListener('keydown', keydown);
      onCleanup(() => field.removeEventListener('keydown', keydown));
    });
  }

  protected toolOf(tool: MarkdownTool) {
    return TOOLS[tool];
  }

  /** "Gras (Ctrl+B)". */
  protected label(tool: MarkdownTool): string {
    const { label, key } = TOOLS[tool];
    return key ? `${label} (${MODIFIER}${key})` : label;
  }

  apply(tool: MarkdownTool): void {
    const field = this.field();
    const { value, selectionStart: start, selectionEnd: end } = field;
    const placeholder = TOOLS[tool].placeholder ?? '';
    this.write(
      tool === 'bold' || tool === 'italic' ? toggleInline(value, start, end, tool, placeholder) : toggleLines(value, start, end, tool),
    );
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.isComposing || event.altKey) {
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey) {
      const key = event.key.toLowerCase();
      const tool: MarkdownTool | null = key === 'b' ? 'bold' : key === 'i' ? 'italic' : null;
      if (tool && this.tools().includes(tool)) {
        event.preventDefault();
        this.apply(tool);
      }
      return;
    }
    if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.shiftKey && this.tools().includes('list')) {
      const field = this.field();
      const edit = continueList(field.value, field.selectionStart, field.selectionEnd);
      if (edit) {
        event.preventDefault();
        this.write(edit);
      }
    }
  }

  /** The field told as if typed: its form, or the (input) of the editor, follows. */
  private write(edit: TextEdit): void {
    const field = this.field();
    if (edit.text !== field.value) {
      field.value = edit.text;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
    field.focus();
    field.setSelectionRange(edit.start, edit.end);
  }
}
