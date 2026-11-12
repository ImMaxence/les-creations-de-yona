import { describe, expect, it, vi } from 'vitest';
import { fitToViewport } from './message-viewport';

/** A phone: its visible part (visualViewport), changed as the keyboard comes and goes. */
function phone(height = 800, width = 390) {
  const viewport = Object.assign(new EventTarget(), { height, width, scale: 1 });
  const view = { visualViewport: viewport, scrollTo: vi.fn() } as unknown as Window & { scrollTo: ReturnType<typeof vi.fn> };
  const resize = (to: Partial<{ height: number; width: number; scale: number }>) => {
    Object.assign(viewport, to);
    viewport.dispatchEvent(new Event('resize'));
  };
  return { view, resize };
}

describe('fitToViewport', () => {
  it('fits the page to what the screen shows', () => {
    const host = document.createElement('div');
    const { view } = phone(800);

    fitToViewport(host, view);

    expect(host.style.getPropertyValue('--messages-viewport')).toBe('800px');
    expect(host.classList.contains('is-keyboard')).toBe(false);
  });

  it('takes the height above the keyboard, then the whole height again, back at the top each time', () => {
    const host = document.createElement('div');
    const { view, resize } = phone(800);
    fitToViewport(host, view);

    resize({ height: 450 });
    expect(host.style.getPropertyValue('--messages-viewport')).toBe('450px');
    expect(host.classList.contains('is-keyboard')).toBe(true);
    expect(view.scrollTo).toHaveBeenCalledTimes(1);

    resize({ height: 800 });
    expect(host.style.getPropertyValue('--messages-viewport')).toBe('800px');
    expect(host.classList.contains('is-keyboard')).toBe(false);
    expect(view.scrollTo).toHaveBeenCalledTimes(2);
    expect(view.scrollTo).toHaveBeenLastCalledWith(0, 0);
  });

  it('leaves the page where it is when only the toolbar of the browser moves', () => {
    const host = document.createElement('div');
    const { view, resize } = phone(800);
    fitToViewport(host, view);

    resize({ height: 740 });

    expect(host.style.getPropertyValue('--messages-viewport')).toBe('740px');
    expect(host.classList.contains('is-keyboard')).toBe(false);
    expect(view.scrollTo).not.toHaveBeenCalled();
  });

  it('keeps the height while zoomed in with two fingers', () => {
    const host = document.createElement('div');
    const { view, resize } = phone(800);
    fitToViewport(host, view);

    resize({ height: 400, scale: 2 });

    expect(host.style.getPropertyValue('--messages-viewport')).toBe('800px');
    expect(host.classList.contains('is-keyboard')).toBe(false);
  });

  it('measures again once the phone is turned', () => {
    const host = document.createElement('div');
    const { view, resize } = phone(800, 390);
    fitToViewport(host, view);

    resize({ height: 360, width: 844 });

    expect(host.classList.contains('is-keyboard')).toBe(false);
  });

  it('stops following the screen, its height given back to the style sheet', () => {
    const host = document.createElement('div');
    const { view, resize } = phone(800);
    const stop = fitToViewport(host, view);
    resize({ height: 450 });

    stop();
    resize({ height: 300 });

    expect(host.style.getPropertyValue('--messages-viewport')).toBe('');
    expect(host.classList.contains('is-keyboard')).toBe(false);
  });

  it('does nothing without a visual viewport', () => {
    const host = document.createElement('div');

    fitToViewport(host, {} as Window)();

    expect(host.style.getPropertyValue('--messages-viewport')).toBe('');
  });
});
