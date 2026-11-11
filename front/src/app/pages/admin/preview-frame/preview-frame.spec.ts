import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { PreviewFrame } from './preview-frame';

@Component({
  imports: [PreviewFrame],
  template: `<yona-preview-frame><p class="page">La recette</p></yona-preview-frame>`,
})
class Preview {}

function draw() {
  const fixture = TestBed.createComponent(Preview);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const option = (name: string) => [...host.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((button) => button.textContent!.includes(name))!;
  return { fixture, host, option };
}

describe('PreviewFrame', () => {
  afterEach(() => localStorage.clear());

  it('shows the page as on a computer first', () => {
    const { host, option } = draw();

    expect(host.querySelector('.screen .page')).not.toBeNull();
    expect(host.querySelector('.screen')!.classList).not.toContain('is-phone');
    expect(option('Ordinateur').getAttribute('aria-checked')).toBe('true');
  });

  it('puts it in a phone, and opens the next preview so', () => {
    const { fixture, host, option } = draw();

    option('Téléphone').click();
    fixture.detectChanges();
    expect(host.querySelector('.screen')!.classList).toContain('is-phone');

    const next = draw();
    expect(next.option('Téléphone').getAttribute('aria-checked')).toBe('true');
  });
});
