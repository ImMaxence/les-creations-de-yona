import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { Floating } from './floating';

@Component({
  imports: [Floating],
  template: `
    <input #field />
    @if (open()) {
      <ul class="list" [yonaFloating]="field"><li>Financiers</li></ul>
    }
  `,
})
class Field {
  readonly open = signal(true);
}

/** jsdom lays nothing out: the field at this place, the list this tall. */
function laidOut(field: Partial<DOMRect>, listHeight: number): void {
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 1024 });
  const rect = (box: Partial<DOMRect>) => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}), ...box }) as DOMRect;
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    return this.tagName === 'INPUT' ? rect(field) : rect({ width: 200, height: listHeight });
  };
}

const original = HTMLElement.prototype.getBoundingClientRect;

async function draw() {
  const fixture = TestBed.createComponent(Field);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture.nativeElement.querySelector('.list') as HTMLElement;
}

describe('Floating', () => {
  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = original;
  });

  it('is a popover of the top layer, under its field, at least as wide', async () => {
    laidOut({ left: 40, top: 100, bottom: 140, right: 340, width: 300 }, 120);
    const list = await draw();

    expect(list.getAttribute('popover')).toBe('manual');
    expect(list.classList).toContain('floating');
    expect(list.style.left).toBe('40px');
    expect(list.style.top).toBe('146px');
    expect(list.style.minWidth).toBe('300px');
  });

  it('opens above its field when the room is there rather than below', async () => {
    const bottom = window.innerHeight - 20;
    laidOut({ left: 40, top: bottom - 40, bottom, right: 340, width: 300 }, 300);
    const list = await draw();

    expect(list.style.top).toBe('auto');
    expect(list.style.bottom).toBe(`${window.innerHeight - (bottom - 40) + 6}px`);
  });
});
