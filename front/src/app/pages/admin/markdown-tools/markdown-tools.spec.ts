import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { MarkdownTools } from './markdown-tools';

@Component({
  imports: [MarkdownTools],
  template: `
    <yona-markdown-tools [field]="area" />
    <textarea #area (input)="typed = area.value"></textarea>
  `,
})
class Field {
  typed = '';
}

function draw(value: string, start: number, end = start) {
  const fixture = TestBed.createComponent(Field);
  fixture.detectChanges();
  const area: HTMLTextAreaElement = fixture.nativeElement.querySelector('textarea');
  area.value = value;
  area.setSelectionRange(start, end);
  const button = (name: string) =>
    [...fixture.nativeElement.querySelectorAll('button')].find((candidate: HTMLButtonElement) =>
      candidate.getAttribute('aria-label')?.startsWith(name),
    ) as HTMLButtonElement;
  const key = (init: KeyboardEventInit) => {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    area.dispatchEvent(event);
    return event;
  };
  return { fixture, area, button, key, field: fixture.componentInstance };
}

describe('MarkdownTools', () => {
  it('puts the words selected in bold, the field told as if typed', () => {
    const { area, button, field } = draw('un mot ici', 3, 6);

    button('Gras').click();

    expect(area.value).toBe('un **mot** ici');
    expect(field.typed).toBe('un **mot** ici');
    expect(area.value.slice(area.selectionStart, area.selectionEnd)).toBe('mot');
  });

  it('takes the bold off with a second press', () => {
    const { area, button } = draw('un mot ici', 3, 6);

    button('Gras').click();
    button('Gras').click();

    expect(area.value).toBe('un mot ici');
  });

  it('answers Ctrl+B and Ctrl+I in the field', () => {
    const { area, key } = draw('un mot ici', 3, 6);

    expect(key({ key: 'b', ctrlKey: true }).defaultPrevented).toBe(true);
    key({ key: 'i', ctrlKey: true });

    expect(area.value).toBe('un ***mot*** ici');
  });

  it('makes a list, and Entrée starts the next item', () => {
    const { area, button, key } = draw('Beurre', 0);

    button('Liste').click();
    area.setSelectionRange(area.value.length, area.value.length);
    const enter = key({ key: 'Enter' });

    expect(enter.defaultPrevented).toBe(true);
    expect(area.value).toBe('- Beurre\n- ');
  });

  it('leaves Entrée alone outside a list', () => {
    const { key } = draw('Beurre', 6);

    expect(key({ key: 'Enter' }).defaultPrevented).toBe(false);
  });
});
