import { placeBelow } from './tooltip-layer';

function anchor(left: number, top: number, width = 40, height = 40): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) };
}

describe('placeBelow', () => {
  const bubble = { width: 100, height: 24 };

  it('puts the bubble under the icon, centered on it', () => {
    expect(placeBelow(anchor(200, 20), bubble)).toEqual({ top: 68, left: 170 });
  });

  it('keeps it within the screen near an edge', () => {
    expect(placeBelow(anchor(window.innerWidth - 30, 20), bubble).left).toBe(window.innerWidth - 100 - 8);
    expect(placeBelow(anchor(0, 20), bubble).left).toBe(8);
  });

  it('puts it above an icon at the bottom of the screen', () => {
    expect(placeBelow(anchor(200, window.innerHeight - 50), bubble).top).toBe(window.innerHeight - 50 - 24 - 8);
  });
});
