import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CookingMode, CookingPart } from './cooking-mode';

const PARTS: CookingPart[] = [
  {
    title: '',
    ingredients: [],
    steps: [
      { description: 'Préchauffer le four.', ingredientPositions: [] },
      { description: 'Cuire.', durationMinutes: 1, ingredientPositions: [] },
    ],
  },
];

/** The component's protected members, as its template uses them. */
interface CookingModeView {
  miseEnPlace(): boolean;
  index(): number;
  ringing(): number | null;
  go(delta: number): void;
  toggleTimer(stepIndex: number): void;
  addMinute(stepIndex: number): void;
  stopRinging(): void;
  remainingMs(stepIndex: number): number;
  clock(ms: number): string;
}

describe('CookingMode', () => {
  let fixture: ComponentFixture<CookingMode>;
  let mode: CookingModeView;
  const vibrate = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    // jsdom has no modal dialogs
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.open = true;
    };
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(CookingMode);
    fixture.componentRef.setInput('title', 'Gâteau');
    fixture.componentRef.setInput('parts', PARTS);
    fixture.componentRef.setInput('ingredients', [{ name: 'Farine', amount: '200 g', note: null, parts: [] }]);
    mode = fixture.componentInstance as unknown as CookingModeView;
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
    vibrate.mockReset();
  });

  /** One second of a running timer. */
  function waitOneSecond(): void {
    vi.advanceTimersByTime(1000);
  }

  it('opens on the mise en place, then goes through the steps and back to it', () => {
    fixture.componentInstance.start();
    expect(mode.miseEnPlace()).toBe(true);
    mode.go(1);
    expect(mode.miseEnPlace()).toBe(false);
    expect(mode.index()).toBe(0);
    mode.go(1);
    expect(mode.index()).toBe(1);
    mode.go(-1);
    mode.go(-1);
    expect(mode.miseEnPlace()).toBe(true);
  });

  it('opens on the first step when the recipe gives no ingredients', () => {
    fixture.componentRef.setInput('ingredients', []);
    fixture.componentInstance.start();
    expect(mode.miseEnPlace()).toBe(false);
  });

  it('starts a 1 min timer at 1:00, not 1:01, even long after the mode opened', () => {
    fixture.componentInstance.start(1);
    // The page shown for a while before the timer is started
    vi.advanceTimersByTime(5300);
    mode.toggleTimer(1);
    expect(mode.clock(mode.remainingMs(1))).toBe('1:00');
    waitOneSecond();
    expect(mode.clock(mode.remainingMs(1))).toBe('0:59');
  });

  it('resumes after a pause from where it stopped', () => {
    fixture.componentInstance.start(1);
    mode.toggleTimer(1);
    vi.advanceTimersByTime(10_000);
    mode.toggleTimer(1);
    vi.advanceTimersByTime(30_000);
    mode.toggleTimer(1);
    expect(mode.clock(mode.remainingMs(1))).toBe('0:50');
  });

  it('rings and buzzes at the end, then "+ 1 min" starts it again', () => {
    fixture.componentInstance.start(1);
    mode.toggleTimer(1);
    vi.advanceTimersByTime(60_500);
    expect(mode.ringing()).toBe(1);
    expect(vibrate).toHaveBeenCalledWith(expect.any(Array));

    mode.addMinute(1);
    expect(mode.ringing()).toBeNull();
    // The buzzing stops
    expect(vibrate).toHaveBeenLastCalledWith(0);
    expect(mode.clock(mode.remainingMs(1))).toBe('1:00');
    vi.advanceTimersByTime(60_500);
    expect(mode.ringing()).toBe(1);
  });

  it('keeps the timers once the mode is closed, and is stopped from the page', () => {
    fixture.componentInstance.start(1);
    mode.toggleTimer(1);
    fixture.componentInstance.open.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.timers-bar')?.textContent).toContain('Étape 2 : 1:00');

    vi.advanceTimersByTime(60_500);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.timers-bar__ringing')?.textContent).toContain("c'est prêt");
    mode.stopRinging();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.timers-bar')).toBeNull();
  });
});
