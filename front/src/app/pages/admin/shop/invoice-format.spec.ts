import { adjustment, formatSiret, invoiceTitle } from './invoice-format';

describe('formatSiret', () => {
  it('spaces the 14 digits as written on paper', () => {
    expect(formatSiret('12345678900012')).toBe('123 456 789 00012');
    expect(formatSiret('123 456 789 00012')).toBe('123 456 789 00012');
  });

  it('leaves anything else as given', () => {
    expect(formatSiret('123')).toBe('123');
    expect(formatSiret('ABCDEFGHIJKLMN')).toBe('ABCDEFGHIJKLMN');
  });
});

describe('adjustment', () => {
  it('shows nothing when the amount is the total of the lines', () => {
    expect(adjustment(24, 24)).toBeNull();
    // 0,1 + 0,2 is 0,3: no "Supplément" of a billionth of a cent
    expect(adjustment(0.3, 0.1 + 0.2)).toBeNull();
  });

  it('tells a discount from an extra', () => {
    expect(adjustment(20, 24)).toEqual({ label: 'Remise', value: -4 });
    expect(adjustment(26.5, 24)).toEqual({ label: 'Supplément', value: 2.5 });
  });
});

describe('invoiceTitle', () => {
  it('names the page, and so the PDF, after the number', () => {
    expect(invoiceTitle('2026-0001')).toBe('Facture 2026-0001');
  });
});
