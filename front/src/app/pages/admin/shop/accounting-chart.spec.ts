import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MonthTotals } from '../../../core/api/generated/models/month-totals';
import { AccountingChart } from './accounting-chart';

const YEAR: MonthTotals[] = Array.from({ length: 12 }, (_, index) => ({
  month: index + 1,
  totals: { income: 0, expense: 0, balance: 0 },
}));

/** The chart measured at this width on screen. */
function measuredAt(width: number): void {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(): void {
        this.callback([{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      disconnect(): void {}
    },
  );
}

async function draw(months = YEAR): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(AccountingChart);
  fixture.componentRef.setInput('months', months);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement;
}

const labels = (host: HTMLElement): string[] => [...host.querySelectorAll('text.axis')].map((text) => text.textContent!.trim());

describe('AccountingChart', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is drawn at its width on screen, one unit a pixel, so that its text keeps its size', async () => {
    measuredAt(1500);
    const host = await draw();

    expect(host.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 1500 220');
    expect(labels(host)).toContain('Janv.');
  });

  it('names each month by its initial when they are close (phones)', async () => {
    measuredAt(320);
    const host = await draw();

    expect(labels(host)).toEqual(expect.arrayContaining(['J', 'F', 'M', 'A', 'S', 'O', 'N', 'D']));
    expect(labels(host)).not.toContain('Janv.');
  });

  it('keeps the two bars of a month within it, however narrow', async () => {
    measuredAt(320);
    const host = await draw(YEAR.map((month) => ({ ...month, totals: { income: 100, expense: 80, balance: 20 } })));
    const firstBar = host.querySelector('path.bar--in')!.getAttribute('d')!;
    // M{x},… : the bar of January starts after the axis (56 px) and inside its month of (320 - 56) / 12 = 22 px
    const x = Number(/^M([\d.]+),/.exec(firstBar)![1]);

    expect(x).toBeGreaterThan(56);
    expect(x).toBeLessThan(56 + 11);
  });

  it('says each step of an empty scale once: 0 €, 0,5 €, 1 €', async () => {
    measuredAt(1000);
    const host = await draw();

    expect(labels(host).slice(0, 3)).toEqual(['0 €', '0,5 €', '1 €']);
  });
});
