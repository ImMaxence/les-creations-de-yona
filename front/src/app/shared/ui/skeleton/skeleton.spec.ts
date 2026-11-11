import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SKELETON_DELAY, Skeleton } from './skeleton';

describe('Skeleton', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function draw(delay?: number): ComponentFixture<Skeleton> {
    if (delay !== undefined) {
      TestBed.configureTestingModule({ providers: [{ provide: SKELETON_DELAY, useValue: delay }] });
    }
    const fixture = TestBed.createComponent(Skeleton);
    fixture.detectChanges();
    return fixture;
  }

  it('shows at once without a delay (the site)', () => {
    const host: HTMLElement = draw().nativeElement;

    expect(host.querySelectorAll('.row')).toHaveLength(6);
    expect(host.style.display).toBe('');
  });

  it('draws nothing and takes no room until its delay has passed (the back-office)', () => {
    const fixture = draw(500);
    const host: HTMLElement = fixture.nativeElement;
    vi.advanceTimersByTime(499);
    fixture.detectChanges();

    expect(host.querySelector('.bone')).toBeNull();
    expect(host.textContent).not.toContain('Chargement');
    expect(host.style.display).toBe('none');

    vi.advanceTimersByTime(1);
    fixture.detectChanges();

    expect(host.querySelectorAll('.row')).toHaveLength(6);
    expect(host.style.display).toBe('');
  });
});
