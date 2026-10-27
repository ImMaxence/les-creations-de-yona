import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { KitchenTimers, TimerTarget, formatClock } from './kitchen-timers';

const TART: TimerTarget = { slug: 'tarte', title: 'Tarte fine', link: ['/recettes', 'desserts', 'tarte'], stepIndex: 1 };
const SOUP: TimerTarget = { slug: 'veloute', title: 'Velouté', link: ['/recettes', 'soupes', 'veloute'], stepIndex: 0 };

describe('formatClock', () => {
  it('rounds the seconds up, with hours past 60 minutes', () => {
    expect(formatClock(60_000)).toBe('1:00');
    expect(formatClock(59_001)).toBe('1:00');
    expect(formatClock(59_000)).toBe('0:59');
    expect(formatClock(3_900_000)).toBe('1:05:00');
  });
});

describe('KitchenTimers', () => {
  let timers: KitchenTimers;
  const vibrate = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    timers = TestBed.inject(KitchenTimers);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vibrate.mockReset();
  });

  function remaining(target: TimerTarget): string {
    return formatClock(timers.remainingMs(timers.get(target.slug, target.stepIndex)!));
  }

  it('keeps the timers of several recipes apart', () => {
    timers.toggle(TART, 15 * 60_000);
    vi.advanceTimersByTime(60_000);
    timers.toggle(SOUP, 10 * 60_000);
    vi.advanceTimersByTime(1000);

    expect(remaining(TART)).toBe('13:59');
    expect(remaining(SOUP)).toBe('9:59');
    expect(timers.running().map((timer) => timer.title)).toEqual(['Tarte fine', 'Velouté']);
  });

  it('rings the one that ends, and stops it alone', () => {
    timers.toggle(TART, 60_000);
    timers.toggle(SOUP, 10 * 60_000);
    vi.advanceTimersByTime(60_500);

    expect(timers.ringing()?.title).toBe('Tarte fine');
    expect(vibrate).toHaveBeenCalledWith(expect.any(Array));
    timers.stopRinging();
    expect(timers.ringing()).toBeNull();
    expect(vibrate).toHaveBeenLastCalledWith(0);
    expect(timers.running().map((timer) => timer.title)).toEqual(['Velouté']);
  });

  it('gives a minute more to the one ringing', () => {
    timers.toggle(TART, 60_000);
    vi.advanceTimersByTime(60_500);
    timers.addMinute(timers.ringing()!.key);

    expect(timers.ringing()).toBeNull();
    expect(remaining(TART)).toBe('1:00');
  });

  it('pauses, and starts again from where it stopped', () => {
    timers.toggle(TART, 60_000);
    vi.advanceTimersByTime(10_000);
    timers.toggle(TART, 60_000);
    vi.advanceTimersByTime(30_000);
    expect(remaining(TART)).toBe('0:50');
    timers.toggle(TART, 60_000);
    vi.advanceTimersByTime(1000);
    expect(remaining(TART)).toBe('0:49');
  });

  it('forgets a timer put back to zero', () => {
    timers.toggle(TART, 60_000);
    timers.reset('tarte#1');
    expect(timers.get('tarte', 1)).toBeUndefined();
    expect(timers.running()).toEqual([]);
  });

  it('"Reprendre" goes back to the recipe and asks its cooking mode for the step', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    timers.toggle(TART, 60_000);
    timers.resume(timers.get('tarte', 1)!);

    expect(navigate).toHaveBeenCalledWith(['/recettes', 'desserts', 'tarte']);
    expect(timers.resumeRequest()).toEqual({ slug: 'tarte', stepIndex: 1 });
  });
});
