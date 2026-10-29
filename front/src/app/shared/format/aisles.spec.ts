import { Aisle, aisleLabel, groupByAisle } from './aisles';

describe('groupByAisle', () => {
  const aisles = new Map<string, Aisle>([
    ['Beurre', 'DAIRY_EGGS'],
    ['Pommes', 'FRUITS_VEGETABLES'],
    ['Crème', 'DAIRY_EGGS'],
  ]);

  it('follows the walk through the shop, "Autres" last, the order of each aisle kept', () => {
    const groups = groupByAisle(['Beurre', 'Sel', 'Pommes', 'Crème'], (name) => aisles.get(name));
    expect(groups.map((group) => [group.label, group.items])).toEqual([
      ['Fruits et légumes', ['Pommes']],
      ['Crèmerie et œufs', ['Beurre', 'Crème']],
      ['Autres', ['Sel']],
    ]);
  });

  it('leaves the empty aisles out', () => {
    expect(groupByAisle(['Sel'], () => undefined).map((group) => group.aisle)).toEqual([null]);
    expect(groupByAisle([], () => undefined)).toEqual([]);
  });
});

describe('aisleLabel', () => {
  it('names an aisle, or "Autres" for none', () => {
    expect(aisleLabel('SWEET_GROCERY')).toBe('Épicerie sucrée et pâtisserie');
    expect(aisleLabel('FRESH')).toBe('Rayon frais');
    expect(aisleLabel(null)).toBe('Autres');
  });
});
