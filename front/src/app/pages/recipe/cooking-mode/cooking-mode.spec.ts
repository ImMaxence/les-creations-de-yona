import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { KitchenTimers } from '../../../core/kitchen/kitchen-timers';
import { CookingMode, CookingPart } from './cooking-mode';

const PARTS: CookingPart[] = [
  {
    title: '',
    ingredients: [],
    steps: [
      { description: 'Préchauffer le four.', ingredientPositions: [] },
      { description: 'Cuire.', durationMinutes: 1, ingredientPositions: [] },
      { description: 'Laisser refroidir.', ingredientPositions: [] },
    ],
  },
];

/** The component's protected members, as its template uses them. */
interface CookingModeView {
  miseEnPlace(): boolean;
  index(): number;
  freeMinutes(): number;
  go(delta: number): void;
  toggleTimer(stepIndex: number): void;
  addMinute(stepIndex: number): void;
  changeFreeMinutes(direction: 1 | -1): void;
  remainingMs(stepIndex: number): number;
  isRinging(stepIndex: number): boolean;
  clock(ms: number): string;
}

describe('CookingMode', () => {
  let fixture: ComponentFixture<CookingMode>;
  let mode: CookingModeView;
  let timers: KitchenTimers;

  beforeEach(() => {
    vi.useFakeTimers();
    // The timers are kept in the tab: none left from another test
    sessionStorage.clear();
    Object.defineProperty(navigator, 'vibrate', { value: vi.fn(), configurable: true });
    // jsdom has no modal dialogs
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.open = true;
    };
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    timers = TestBed.inject(KitchenTimers);
    fixture = TestBed.createComponent(CookingMode);
    fixture.componentRef.setInput('title', 'Gâteau');
    fixture.componentRef.setInput('slug', 'gateau');
    fixture.componentRef.setInput('link', ['/recettes', 'desserts', 'gateau']);
    fixture.componentRef.setInput('parts', PARTS);
    fixture.componentRef.setInput('ingredients', [{ name: 'Farine', amount: '200 g', note: null, parts: [] }]);
    mode = fixture.componentInstance as unknown as CookingModeView;
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

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

  it('opens on the mise en place for the equipment alone', () => {
    fixture.componentRef.setInput('ingredients', []);
    fixture.componentRef.setInput('equipment', ['Moule à tarte']);
    fixture.componentInstance.start();
    expect(mode.miseEnPlace()).toBe(true);
  });

  it('opens on the first step with nothing to get out', () => {
    fixture.componentRef.setInput('ingredients', []);
    fixture.componentInstance.start();
    expect(mode.miseEnPlace()).toBe(false);
  });

  it('starts a 1 min timer at 1:00, not 1:01, even long after the mode opened', () => {
    fixture.componentInstance.start(1);
    vi.advanceTimersByTime(5300);
    mode.toggleTimer(1);
    expect(mode.clock(mode.remainingMs(1))).toBe('1:00');
    vi.advanceTimersByTime(1000);
    expect(mode.clock(mode.remainingMs(1))).toBe('0:59');
  });

  it('rings at the end, then "+ 1 min" starts it again', () => {
    fixture.componentInstance.start(1);
    mode.toggleTimer(1);
    vi.advanceTimersByTime(60_500);
    expect(mode.isRinging(1)).toBe(true);
    mode.addMinute(1);
    expect(mode.isRinging(1)).toBe(false);
    expect(mode.clock(mode.remainingMs(1))).toBe('1:00');
  });

  it('offers a free timer on a step without duration, of the minutes chosen', () => {
    fixture.componentInstance.start(2);
    expect(mode.freeMinutes()).toBe(5);
    for (let i = 0; i < 6; i++) {
      mode.changeFreeMinutes(1);
    }
    // 6, 7, 8, 9, 10, then 15
    expect(mode.freeMinutes()).toBe(15);
    mode.changeFreeMinutes(-1);
    expect(mode.freeMinutes()).toBe(10);
    mode.toggleTimer(2);
    expect(mode.clock(mode.remainingMs(2))).toBe('10:00');
    // Back to 5 on another step, the timer started keeps its minutes
    mode.go(-1);
    expect(mode.freeMinutes()).toBe(5);
    expect(mode.clock(mode.remainingMs(2))).toBe('10:00');
  });

  it('keeps its timers in the visit: the mode closed or the page left', () => {
    fixture.componentInstance.start(1);
    mode.toggleTimer(1);
    fixture.componentInstance.open.set(false);
    fixture.detectChanges();
    expect(timers.modeOpen()).toBe(false);
    fixture.destroy();
    expect(timers.running().map((timer) => timer.title)).toEqual(['Gâteau']);
  });

  it('opens at the step asked for by "Reprendre"', () => {
    fixture.detectChanges();
    timers.resumeRequest.set({ slug: 'gateau', stepIndex: 1 });
    fixture.detectChanges();
    expect(fixture.componentInstance.open()).toBe(true);
    expect(mode.index()).toBe(1);
    expect(timers.resumeRequest()).toBeNull();
  });
});
