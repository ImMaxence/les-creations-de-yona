import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SuggestInput } from './suggest-input';

@Component({
  imports: [SuggestInput],
  template: `<yona-suggest-input label="Recette" [suggestions]="suggestions" [(value)]="text" (picked)="picked.set($event)" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly suggestions = [{ value: 'Tarte au citron' }, { value: 'Crème brûlée' }];
  readonly text = signal('');
  readonly picked = signal<string | null>(null);
}

describe('SuggestInput', () => {
  async function typed(text: string) {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    return fixture;
  }

  function options(fixture: { nativeElement: unknown }): HTMLElement[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role=option]')];
  }

  it('suggests whatever the accents', async () => {
    const fixture = await typed('creme');

    expect(options(fixture).map((option) => option.textContent?.trim())).toEqual(['Crème brûlée']);
  });

  it('tells a suggestion picked from a text typed', async () => {
    const fixture = await typed('tarte');
    expect(fixture.componentInstance.picked()).toBeNull();

    options(fixture)[0]!.dispatchEvent(new Event('pointerdown'));

    expect(fixture.componentInstance.picked()).toBe('Tarte au citron');
    expect(fixture.componentInstance.text()).toBe('Tarte au citron');
  });
});
