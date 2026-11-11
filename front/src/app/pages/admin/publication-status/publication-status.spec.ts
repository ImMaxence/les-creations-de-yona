import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PublicationStatusBadge, shownStatus, statusLabel } from './publication-status';

function draw(inputs: Record<string, unknown>): HTMLElement {
  const fixture = TestBed.createComponent(PublicationStatusBadge);
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  fixture.detectChanges();
  return fixture.nativeElement;
}

describe('PublicationStatusBadge', () => {
  it('calls a draft with a time of publication "Programmé"', () => {
    expect(shownStatus({ status: 'DRAFT', scheduledAt: '2026-11-14T09:00:00Z' })).toBe('SCHEDULED');
    expect(shownStatus({ status: 'DRAFT', scheduledAt: null })).toBe('DRAFT');
    expect(shownStatus({ status: 'FAILED', scheduledAt: '2026-11-14T09:00:00Z' })).toBe('FAILED');
  });

  it('agrees with a recipe or an article', () => {
    expect(statusLabel('PUBLISHED')).toBe('Publié');
    expect(statusLabel('PUBLISHED', true)).toBe('Publiée');
    expect(statusLabel('SCHEDULED', true)).toBe('Programmée');
  });

  it('shows a scheduled article in blue, with its time in Paris', () => {
    const host = draw({ status: 'DRAFT', scheduledAt: '2026-11-14T09:00:00Z' });
    const badge = host.querySelector('.badge')!;

    expect(badge.classList).toContain('badge--scheduled');
    expect(badge.textContent!.replace(/\s+/g, ' ').trim()).toBe('Programmé · samedi 14 novembre à 10:00');
  });

  it('shows a failure in red, with when it was planned and why', () => {
    const host = draw({ status: 'FAILED', scheduledAt: '2026-11-14T09:00:00Z', failure: 'Le site était arrêté', feminine: true });
    const [status, planned] = [...host.querySelectorAll('.badge')];

    expect(status!.classList).toContain('badge--failed');
    expect(planned!.textContent).toContain('Prévue samedi 14 novembre à 10:00');
    expect(planned!.getAttribute('title')).toBe('Le site était arrêté');
  });
});
