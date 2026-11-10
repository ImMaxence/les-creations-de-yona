import { AccountEntryResponse } from '../../../core/api/generated/models/account-entry-response';
import { formatEuros } from '../../../shared/format/units';
import {
  barPath,
  change,
  filterEntries,
  groupByMonth,
  periodLabel,
  pricePerText,
  pricePerUnit,
  purchasesTotal,
  quarterLabel,
  roundScale,
  share,
  typedNumber,
} from './accounting-format';


function entry(id: number, occurredOn: string, kind: 'INCOME' | 'EXPENSE', amount: number, changes: Partial<AccountEntryResponse> = {}): AccountEntryResponse {
  return {
    id,
    occurredOn,
    kind,
    amount,
    category: kind === 'INCOME' ? 'SALE' : 'INGREDIENTS',
    label: `Ligne ${id}`,
    adminEmail: 'yona@example.fr',
    purchases: [],
    ...changes,
  } as AccountEntryResponse;
}

describe('typedNumber', () => {
  it('reads a number typed the French way or not', () => {
    expect(typedNumber('9,8')).toBe(9.8);
    expect(typedNumber(' 9.80 ')).toBe(9.8);
    expect(typedNumber('')).toBeNaN();
    expect(typedNumber('abc')).toBeNaN();
  });
});

describe('pricePerUnit', () => {
  it('gives the price of a kilo, a litre or a piece', () => {
    expect(pricePerUnit('250', 'G', '2,45')).toEqual({ value: 9.8, per: 'KG' });
    expect(pricePerUnit('2', 'KG', '19.60')).toEqual({ value: 9.8, per: 'KG' });
    expect(pricePerUnit('50', 'CL', '1')?.per).toBe('L');
    expect(pricePerUnit('50', 'CL', '1')?.value).toBeCloseTo(2);
    expect(pricePerUnit('500', 'ML', '1')?.value).toBeCloseTo(2);
    expect(pricePerUnit('1', 'L', '1.5')).toEqual({ value: 1.5, per: 'L' });
    expect(pricePerUnit('6', 'PIECE', '1,80')?.value).toBeCloseTo(0.3);
  });

  it('waits for a quantity and a price above 0', () => {
    expect(pricePerUnit('', 'G', '2')).toBeNull();
    expect(pricePerUnit('0', 'G', '2')).toBeNull();
    expect(pricePerUnit('250', 'G', '')).toBeNull();
    expect(pricePerUnit('250', 'G', '-1')).toBeNull();
    expect(pricePerUnit('beaucoup', 'G', '2')).toBeNull();
  });

  it('writes it with its unit', () => {
    expect(pricePerText({ value: 9.8, per: 'KG' })).toBe(`${formatEuros(9.8)} / kg`);
    expect(pricePerText({ value: 0.3, per: 'PIECE' })).toBe(`${formatEuros(0.3)} / pièce`);
  });
});

describe('purchasesTotal', () => {
  it('adds up the prices typed, to the cent, an empty one counting for nothing', () => {
    expect(purchasesTotal(['0,10', '0.20', '', 'abc'])).toBe(0.3);
    expect(purchasesTotal([])).toBe(0);
  });
});

describe('periodLabel', () => {
  it('names the period shown', () => {
    expect(periodLabel('YEAR', 2026, 3, 1)).toBe('2026');
    expect(periodLabel('MONTH', 2026, 3, 1)).toBe('Mars 2026');
    expect(periodLabel('QUARTER', 2026, 3, 1)).toBe('1er trimestre 2026');
    expect(periodLabel('QUARTER', 2026, 3, 4)).toBe('4e trimestre 2026');
  });

  it('writes the first quarter as French does', () => {
    expect([1, 2, 3, 4].map(quarterLabel)).toEqual(['1er trimestre', '2e trimestre', '3e trimestre', '4e trimestre']);
  });
});

describe('change and share', () => {
  it('compare with what there was', () => {
    expect(change(125, 100)).toBe(0.25);
    expect(change(50, 100)).toBe(-0.5);
    expect(change(100, 0)).toBeNull();
  });

  it('give the part of a whole', () => {
    expect(share(30, 120)).toBe(0.25);
    expect(share(30, 0)).toBeNull();
  });
});

describe('filterEntries', () => {
  const sale = entry(1, '2026-11-03', 'INCOME', 24, { orderSummary: '2 × Cookies' });
  const butter = entry(2, '2026-11-02', 'EXPENSE', 9.8, {
    label: 'Courses',
    adminEmail: 'lea@example.fr',
    purchases: [{ item: 'Beurre doux', quantity: 1, unit: 'KG', price: 9.8 }] as AccountEntryResponse['purchases'],
  });
  const boxes = entry(3, '2026-10-20', 'EXPENSE', 12, { category: 'PACKAGING', label: 'Boîtes kraft' });
  const all = [sale, butter, boxes];

  it('keeps a kind and an admin', () => {
    expect(filterEntries(all, 'INCOME', '', '')).toEqual([sale]);
    expect(filterEntries(all, 'EXPENSE', '', '')).toEqual([butter, boxes]);
    expect(filterEntries(all, 'ALL', 'lea@example.fr', '')).toEqual([butter]);
    expect(filterEntries(all, 'ALL', '', '')).toEqual(all);
  });

  it('searches the label, the order, the category and the purchases', () => {
    expect(filterEntries(all, 'ALL', '', 'cookies')).toEqual([sale]);
    expect(filterEntries(all, 'ALL', '', 'BEURRE')).toEqual([butter]);
    expect(filterEntries(all, 'ALL', '', 'emballages')).toEqual([boxes]);
    expect(filterEntries(all, 'ALL', '', 'boite kraft')).toEqual([boxes]);
    expect(filterEntries(all, 'INCOME', '', 'beurre')).toEqual([]);
  });
});

describe('groupByMonth', () => {
  it('puts the lines under their month, with what came in and went out, to the cent', () => {
    const groups = groupByMonth([
      entry(1, '2026-11-03', 'INCOME', 0.1),
      entry(2, '2026-11-02', 'INCOME', 0.2),
      entry(3, '2026-11-01', 'EXPENSE', 9.8),
      entry(4, '2026-10-20', 'EXPENSE', 12),
    ]);

    expect(groups.map((group) => group.label)).toEqual(['Novembre 2026', 'Octobre 2026']);
    expect(groups[0]).toMatchObject({ key: '2026-11', income: 0.3, expense: 9.8 });
    expect(groups[0]!.entries.map((line) => line.id)).toEqual([1, 2, 3]);
    expect(groups[1]).toMatchObject({ income: 0, expense: 12 });
  });

  it('has no group without lines', () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe('roundScale', () => {
  it('rounds the top of the chart up', () => {
    expect(roundScale(0)).toBe(1);
    expect(roundScale(1)).toBe(1);
    expect(roundScale(140)).toBe(200);
    expect(roundScale(230)).toBe(250);
    expect(roundScale(260)).toBe(500);
    expect(roundScale(720)).toBe(1000);
    expect(roundScale(1000)).toBe(1000);
    expect(roundScale(1001)).toBe(2000);
  });
});

describe('barPath', () => {
  it('stands on the baseline with rounded top corners', () => {
    expect(barPath(10, 50, 14, 176)).toBe('M10,176 V130 Q10,126 14,126 H20 Q24,126 24,130 V176 Z');
  });

  it('rounds a low bar no more than its height', () => {
    expect(barPath(0, 2, 14, 100)).toBe('M0,100 V100 Q0,98 2,98 H12 Q14,98 14,100 V100 Z');
  });
});
