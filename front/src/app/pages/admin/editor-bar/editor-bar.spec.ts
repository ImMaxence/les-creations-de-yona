import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { EditorBar } from './editor-bar';

@Component({
  imports: [EditorBar],
  template: `
    <yona-editor-bar back="/admin/mon-cap" [draft]="draft()" [submits]="submits()" saveLabel="Créer l’article" (save)="saved = saved + 1" (publish)="published = published + 1" (preview)="previewed = previewed + 1" />
  `,
})
class Editor {
  readonly draft = signal(true);
  readonly submits = signal(false);
  saved = 0;
  published = 0;
  previewed = 0;
}

function draw() {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(Editor);
  fixture.detectChanges();
  const buttons = (): HTMLButtonElement[] => [...fixture.nativeElement.querySelectorAll('button')];
  const named = (text: string) => buttons().find((button) => button.textContent!.includes(text))!;
  return { fixture, buttons, named, editor: fixture.componentInstance };
}

describe('EditorBar', () => {
  it('offers a draft to be saved as it is, or published', () => {
    const { named, editor } = draw();

    named('Enregistrer le brouillon').click();
    named('Publier').click();
    named('Aperçu').click();

    expect([editor.saved, editor.published, editor.previewed]).toEqual([1, 1, 1]);
  });

  it('only saves what is published', () => {
    const { fixture, buttons, named, editor } = draw();
    editor.draft.set(false);
    fixture.detectChanges();

    expect(buttons().some((button) => button.textContent!.includes('Publier'))).toBe(false);
    named('Créer l’article').click();
    expect(editor.saved).toBe(1);
  });

  it('leaves saving to the form around it when it submits', () => {
    const { fixture, named, editor } = draw();
    editor.submits.set(true);
    fixture.detectChanges();

    const save = named('Enregistrer le brouillon');
    expect(save.type).toBe('submit');
    save.click();
    expect(editor.saved).toBe(0);
  });

  it('leads back to the list', () => {
    const { fixture } = draw();

    expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('/admin/mon-cap');
  });
});
