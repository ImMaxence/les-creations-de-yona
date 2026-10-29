import { shownStatus, statusQuery } from './admin-recipes';

describe('shownStatus', () => {
  it('shows a draft with a publication time as scheduled', () => {
    expect(shownStatus({ status: 'DRAFT', scheduledAt: '2026-11-07T09:00:00Z' })).toBe('SCHEDULED');
    expect(shownStatus({ status: 'DRAFT' })).toBe('DRAFT');
    // A failed one keeps its planned time: it stays "Échec"
    expect(shownStatus({ status: 'FAILED', scheduledAt: '2026-10-28T08:00:00Z' })).toBe('FAILED');
    expect(shownStatus({ status: 'PUBLISHED' })).toBe('PUBLISHED');
  });
});

describe('statusQuery', () => {
  it('tells the scheduled drafts from the others', () => {
    expect(statusQuery('SCHEDULED')).toEqual({ status: 'DRAFT', scheduled: true });
    expect(statusQuery('DRAFT')).toEqual({ status: 'DRAFT', scheduled: false });
    expect(statusQuery('FAILED')).toEqual({ status: 'FAILED' });
    expect(statusQuery('ALL')).toEqual({});
  });
});
