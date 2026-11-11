import { contrast, customPalette, mix, readabilityProblems } from './custom-palette';

describe('custom palette', () => {
  it('mixes and measures colors as CSS and WCAG do', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#ff0000', '#0000ff', 1)).toBe('#ff0000');
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrast('#777777', '#777777')).toBe(1);
  });

  it('derives every shade from the four colors chosen', () => {
    const palette = customPalette({ bg: '#fcf9f5', surface: '#f4e7e6', text: '#36221c', accent: '#8c533e' }, 'light');

    expect(palette.bg).toBe('#fcf9f5');
    expect(palette.accent).toBe('#8c533e');
    // Readable on the accent: the light background, not the dark text
    expect(palette.onAccent).toBe('#fcf9f5');
    expect(contrast(palette.textMuted, palette.bg)).toBeGreaterThan(4.5);
    expect(palette.danger).toBe('#a3341c');
  });

  it('says what would be hard to read', () => {
    expect(readabilityProblems({ bg: '#ffffff', surface: '#f5f5f5', text: '#222222', accent: '#8c533e' })).toEqual([]);
    expect(readabilityProblems({ bg: '#ffffff', surface: '#f5f5f5', text: '#cccccc', accent: '#fafafa' })).toHaveLength(2);
  });
});
