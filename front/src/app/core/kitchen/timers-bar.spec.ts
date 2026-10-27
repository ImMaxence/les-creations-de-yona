import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { KitchenTimers } from './kitchen-timers';
import { TimersBar } from './timers-bar';

describe('TimersBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'vibrate', { value: vi.fn(), configurable: true });
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('shows the running timers on any page, and stands aside while a cooking mode is open', () => {
    const timers = TestBed.inject(KitchenTimers);
    const fixture = TestBed.createComponent(TimersBar);
    const element: HTMLElement = fixture.nativeElement;
    fixture.detectChanges();
    expect(element.querySelector('.timers-bar')).toBeNull();

    timers.toggle({ slug: 'tarte', title: 'Tarte fine', link: ['/recettes', 'desserts', 'tarte'], stepIndex: 1 }, 60_000);
    fixture.detectChanges();
    expect(element.querySelector('.timers-bar__timer')?.textContent).toContain('Tarte fine');
    expect(element.querySelector('.timers-bar__timer')?.textContent).toContain('Étape 2 : 1:00');

    timers.modeOpen.set(true);
    fixture.detectChanges();
    expect(element.querySelector('.timers-bar')).toBeNull();

    timers.modeOpen.set(false);
    vi.advanceTimersByTime(60_500);
    fixture.detectChanges();
    expect(element.querySelector('.timers-bar__ringing')?.textContent).toContain("Tarte fine · étape 2 : c'est prêt !");

    element.querySelector<HTMLButtonElement>('.timers-bar__stop')!.click();
    fixture.detectChanges();
    expect(element.querySelector('.timers-bar')).toBeNull();
  });
});
