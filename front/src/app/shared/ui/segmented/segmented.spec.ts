import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Segmented } from './segmented';

@Component({
  imports: [Segmented],
  template: `
    <div yonaSegmented>
      @for (option of options; track option) {
        <button type="button" [attr.aria-pressed]="chosen() === option">{{ option }}</button>
      }
    </div>
  `,
})
class Row {
  readonly options = ['Tout', 'Sucré', 'Salé'];
  readonly chosen = signal<string | null>('Tout');
}

// jsdom lays nothing out: each button 60 px wide, one after the other
const layout = {
  offsetWidth: { get: (element: HTMLElement) => (element.tagName === 'BUTTON' ? 60 : 0) },
  offsetHeight: { get: (element: HTMLElement) => (element.tagName === 'BUTTON' ? 40 : 0) },
  offsetLeft: { get: (element: HTMLElement) => [...element.parentElement!.querySelectorAll('button')].indexOf(element as HTMLButtonElement) * 64 },
  offsetTop: { get: () => 4 },
};
const originals = new Map<string, PropertyDescriptor>();

describe('Segmented', () => {
  beforeEach(() => {
    for (const [name, { get }] of Object.entries(layout)) {
      originals.set(name, Object.getOwnPropertyDescriptor(HTMLElement.prototype, name)!);
      Object.defineProperty(HTMLElement.prototype, name, { configurable: true, get(this: HTMLElement) { return get(this); } });
    }
  });

  afterEach(() => {
    for (const [name, descriptor] of originals) {
      Object.defineProperty(HTMLElement.prototype, name, descriptor);
    }
  });

  async function draw() {
    const fixture = TestBed.createComponent(Row);
    fixture.detectChanges();
    await fixture.whenStable();
    const row: HTMLElement = fixture.nativeElement.querySelector('[yonaSegmented]');
    return { fixture, row, thumb: () => row.querySelector<HTMLElement>('.segmented-thumb')! };
  }

  it('puts a thumb behind the chosen option, in the browser', async () => {
    const { row, thumb } = await draw();

    expect(row.classList).toContain('segmented-slide');
    expect(row.classList).toContain('is-sliding');
    expect(row.firstElementChild).toBe(thumb());
    expect(thumb().getAttribute('aria-hidden')).toBe('true');
    expect(thumb().style.width).toBe('60px');
    expect(thumb().style.height).toBe('40px');
    expect(thumb().style.transform).toBe('translate(0px, 4px)');
  });

  it('moves the thumb to the next choice', async () => {
    const { fixture, thumb } = await draw();

    fixture.componentInstance.chosen.set('Salé');
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();

    expect(thumb().style.transform).toBe('translate(128px, 4px)');
    expect(thumb().style.opacity).toBe('');
  });

  it('hides the thumb when nothing is chosen', async () => {
    const { fixture, thumb } = await draw();

    fixture.componentInstance.chosen.set(null);
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();

    expect(thumb().style.opacity).toBe('0');
  });
});
