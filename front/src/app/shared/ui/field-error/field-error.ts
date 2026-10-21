import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FieldTree } from '@angular/forms/signals';

/** First validation message of a field, once the field has been touched (or the form submitted). */
@Component({
  selector: 'yona-field-error',
  template: `
    @if (message(); as text) {
      <p class="field__error" role="alert">{{ text }}</p>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldError {
  readonly field = input.required<FieldTree<unknown>>();

  protected readonly message = computed(() => {
    const state = this.field()();
    return state.touched() ? (state.errors()[0]?.message ?? null) : null;
  });
}
