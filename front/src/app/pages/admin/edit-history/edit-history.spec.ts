import { ApplicationRef, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditHistory, changedRange } from './edit-history';

interface Form {
  title: string;
  steps: string[];
}

/** A history over a form, its fields in an element of the page. */
function setUp(start: Form = { title: '', steps: [] }) {
  const host = document.createElement('div');
  host.innerHTML = '<input id="title" /><textarea id="step"></textarea>';
  document.body.append(host);
  let form = start;
  const history = new EditHistory<Form>({
    write: (state) => {
      form = state;
      host.querySelector<HTMLInputElement>('#title')!.value = state.title;
      host.querySelector<HTMLTextAreaElement>('#step')!.value = state.steps[0] ?? '';
    },
    host: () => host,
    injector: TestBed.inject(Injector),
  });
  history.record(form, 1);
  host.addEventListener('input', (event) => history.onInput(event));
  const field = (id: string) => host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)!;
  /** A key typed in a field: its input event, then the editor's new state. */
  const type = (id: string, change: Partial<Form>, inputType = 'insertText') => {
    field(id).dispatchEvent(new InputEvent('input', { inputType, bubbles: true }));
    form = { ...form, ...change };
    history.record(form, 1);
  };
  /** A button of the editor: no typing. */
  const click = (change: Partial<Form>) => {
    form = { ...form, ...change };
    history.record(form, 1);
  };
  return { history, host, field, type, click, form: () => form };
}

describe('EditHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-12T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('undoes the words typed in a field in one step', () => {
    const { history, type, form } = setUp();

    type('title', { title: 'T' });
    vi.advanceTimersByTime(200);
    type('title', { title: 'Ta' });
    vi.advanceTimersByTime(200);
    type('title', { title: 'Tar' });
    history.undo();

    expect(form().title).toBe('');
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);
  });

  it('starts a new step after a pause, in another field, or when deleting after typing', () => {
    const { history, type, form } = setUp();

    type('title', { title: 'Tarte' });
    vi.advanceTimersByTime(1500);
    type('title', { title: 'Tarte au' });
    type('step', { steps: ['Cuire'] });
    type('step', { steps: ['Cuir'] }, 'deleteContentBackward');

    history.undo();
    expect(form()).toEqual({ title: 'Tarte au', steps: ['Cuire'] });
    history.undo();
    expect(form()).toEqual({ title: 'Tarte au', steps: [] });
    history.undo();
    expect(form().title).toBe('Tarte');
  });

  it('undoes a button as a step of its own, and does it again', () => {
    const { history, type, click, form } = setUp();

    type('step', { steps: ['Cuire'] });
    click({ steps: ['**Cuire**'] });
    history.undo();
    expect(form().steps).toEqual(['Cuire']);
    history.redo();
    expect(form().steps).toEqual(['**Cuire**']);
  });

  it('forgets what was undone once something else changes', () => {
    const { history, click } = setUp();

    click({ title: 'Un' });
    history.undo();
    click({ title: 'Deux' });

    expect(history.canRedo()).toBe(false);
  });

  it('ignores the state it puts back, and the same state again', () => {
    const { history, click, form } = setUp();

    click({ title: 'Un' });
    history.undo();
    history.record(form(), 1);
    history.record(form(), 1);

    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);
  });

  it('starts again for another recipe', () => {
    const { history, click } = setUp();

    click({ title: 'Un' });
    history.record({ title: 'Autre', steps: [] }, 2);

    expect(history.canUndo()).toBe(false);
  });

  it('keeps the steps when the state saved is only written otherwise', () => {
    const { history, click, form } = setUp();

    click({ title: 'Un ' });
    history.replace({ title: 'Un', steps: [] });
    history.record({ title: 'Un', steps: [] }, 1);
    history.undo();

    expect(form().title).toBe('');
  });

  it('gives the focus back to the field changed, its change selected', async () => {
    const { history, click, field } = setUp({ title: 'un mot', steps: [] });

    click({ title: 'un **mot**' });
    field('title').value = 'un **mot**';
    history.undo();
    TestBed.inject(ApplicationRef).tick();
    await Promise.resolve();

    expect(document.activeElement).toBe(field('title'));
    expect([field('title').selectionStart, field('title').selectionEnd]).toEqual([3, 6]);
  });
});

describe('EditHistory keys', () => {
  function press(target: Element, init: KeyboardEventInit): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  }

  function listening() {
    const { history, host, click, field, form } = setUp();
    document.addEventListener('keydown', (event) => history.onKeydown(event));
    click({ title: 'Un' });
    return { history, host, field, form };
  }

  it('undoes with Ctrl+Z and does again with Ctrl+Y or Ctrl+Maj+Z, the letter as typed', () => {
    const { field, form } = listening();

    const undo = press(field('title'), { key: 'z', ctrlKey: true });
    expect(undo.defaultPrevented).toBe(true);
    expect(form().title).toBe('');
    press(field('title'), { key: 'y', ctrlKey: true });
    expect(form().title).toBe('Un');
    press(document.body, { key: 'z', metaKey: true });
    press(document.body, { key: 'Z', metaKey: true, shiftKey: true });
    expect(form().title).toBe('Un');
  });

  it('leaves the keys to a window and to the fields marked so', () => {
    const { host, form } = listening();
    host.insertAdjacentHTML('beforeend', '<dialog><input id="in-dialog" /></dialog><input id="own" data-own-undo />');

    const inDialog = press(host.querySelector('#in-dialog')!, { key: 'z', ctrlKey: true });
    const own = press(host.querySelector('#own')!, { key: 'z', ctrlKey: true });

    expect([inDialog.defaultPrevented, own.defaultPrevented]).toEqual([false, false]);
    expect(form().title).toBe('Un');
  });

  it('leaves the keys to a field outside the editor', () => {
    const { form } = listening();
    const outside = document.createElement('input');
    document.body.append(outside);

    press(outside, { key: 'z', ctrlKey: true });

    expect(form().title).toBe('Un');
  });
});

describe('changedRange', () => {
  it('selects the text put back in place of another', () => {
    expect(changedRange('un **mot** ici', 'un mot ici')).toEqual({ from: 3, to: 6 });
  });

  it('puts the cursor after text added, or where text was taken out', () => {
    expect(changedRange('Tarte', 'Tarte au citron')).toEqual({ from: 15, to: 15 });
    expect(changedRange('Tarte au citron', 'Tarte')).toEqual({ from: 5, to: 5 });
  });
});
