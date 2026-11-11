import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { TitleSearch, TitledItem } from './title-search';

const ITEMS: TitledItem[] = [
  { id: 1, title: 'Mon examen blanc' },
  { id: 2, title: 'Les petits fours', note: 'Non publié' },
  { id: 3, title: 'Mon examen blanc' },
];

function draw(exclude = new Set<number>()) {
  const fixture = TestBed.createComponent(TitleSearch<TitledItem>);
  fixture.componentRef.setInput('label', 'Rechercher un article');
  fixture.componentRef.setInput('items', ITEMS);
  fixture.componentRef.setInput('exclude', exclude);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const type = (text: string) => {
    const input = host.querySelector('input')!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
  };
  const options = () => [...host.querySelectorAll('[role="option"] .option__value')].map((value) => value.textContent!.trim());
  const notes = () => [...host.querySelectorAll('[role="option"] .option__hint')].map((hint) => hint.textContent!.trim());
  return { fixture, host, type, options, notes, search: fixture.componentInstance };
}

describe('TitleSearch', () => {
  it('finds an item by part of its title, accents and case ignored, two of the same title told apart', () => {
    const { type, options } = draw();

    type('EXAMEN');

    expect(options()).toEqual(['Mon examen blanc', 'Mon examen blanc (3)']);
  });

  it('shows its note beside it, and leaves out those excluded', () => {
    const { type, options, notes } = draw(new Set([1]));

    type('o');

    expect(options()).toEqual(['Les petits fours', 'Mon examen blanc']);
    expect(notes()).toEqual(['Non publié']);
  });

  it('says when nothing matches, and that a text typed is not a choice', () => {
    const { host, type, search } = draw();

    type('tarte');

    expect(host.textContent).toContain('Aucun résultat');
    expect(search.unfinished()).toBe(true);
  });

  it('shows the item picked, with a cross to take it off', () => {
    const { fixture, host, type, search } = draw();
    type('fours');

    host.querySelector('[role="option"]')!.dispatchEvent(new Event('pointerdown'));
    fixture.detectChanges();
    expect(search.chosen()?.id).toBe(2);
    expect(host.querySelector('.chosen__title')!.textContent).toBe('Les petits fours');

    host.querySelector<HTMLButtonElement>('.chosen button')!.click();
    fixture.detectChanges();
    expect(search.chosen()).toBeNull();
  });
});
