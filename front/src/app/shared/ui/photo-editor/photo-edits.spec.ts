import {
  NO_ADJUSTMENT,
  WHOLE,
  applyAdjustments,
  cropInside,
  cropProblem,
  largestCrop,
  movedCrop,
  outputSize,
  resizedCrop,
  snappedAngle,
  turnedSize,
} from './photo-edits';

describe('photo edits', () => {
  it('leaves the pixels alone without settings, and lightens them with brightness', () => {
    const pixels = new Uint8ClampedArray([100, 150, 200, 255]);
    applyAdjustments(pixels, NO_ADJUSTMENT);
    expect([...pixels]).toEqual([100, 150, 200, 255]);

    applyAdjustments(pixels, { ...NO_ADJUSTMENT, brightness: 50 });
    expect(pixels[0]).toBe(125);
    expect(pixels[3]).toBe(255);
  });

  it('turns the photo grey without colours, and warmer with warmth', () => {
    const grey = new Uint8ClampedArray([200, 100, 50, 255]);
    applyAdjustments(grey, { ...NO_ADJUSTMENT, saturation: -100 });
    expect(grey[0]).toBe(grey[1]);
    expect(grey[1]).toBe(grey[2]);

    const warm = new Uint8ClampedArray([100, 100, 100, 255]);
    applyAdjustments(warm, { ...NO_ADJUSTMENT, warmth: 100 });
    expect(warm[0]).toBeGreaterThan(warm[2]);
  });

  it('frames the largest centred part at a ratio', () => {
    // A square photo framed at 4:3: the whole width, three quarters of the height
    const crop = largestCrop(4 / 3, 1000, 1000);
    expect(crop.width).toBe(1);
    expect(crop.height).toBeCloseTo(0.75);
    expect(crop.y).toBeCloseTo(0.125);
    expect(largestCrop(null, 1000, 1000)).toEqual(WHOLE);
  });

  it('keeps the frame inside the photo when moved', () => {
    const crop = { x: 0.5, y: 0.5, width: 0.4, height: 0.4 };
    expect(movedCrop(crop, 0.5, -1)).toEqual({ x: 0.6, y: 0, width: 0.4, height: 0.4 });
  });

  it('keeps the ratio when a corner is dragged, the opposite corner staying', () => {
    const crop = resizedCrop(WHOLE, { right: true, bottom: true }, 0.5, 0.9, 4 / 3, 2000, 1500);
    expect(crop.x).toBe(0);
    expect(crop.y).toBe(0);
    expect((crop.width * 2000) / (crop.height * 1500)).toBeCloseTo(4 / 3);
  });

  it('says what the API would refuse', () => {
    expect(cropProblem(1600, 1200, false)).toBeNull();
    expect(cropProblem(1000, 1000, false)).toBeNull();
    expect(cropProblem(1000, 1200, false)).toContain('paysage');
    expect(cropProblem(700, 450, false)).toContain('800 × 450');
    expect(cropProblem(1000, 1500, true)).toBeNull();
    expect(cropProblem(500, 900, true)).toContain('600 × 800');
  });

  it('stops the rotation on right angles', () => {
    expect(snappedAngle(87)).toBe(90);
    expect(snappedAngle(-3)).toBe(0);
    expect(snappedAngle(184)).toBe(180);
    expect(snappedAngle(30)).toBe(30);
    expect(snappedAngle(400)).toBe(40);
  });

  it('keeps a tilted frame on the photo: no empty corner', () => {
    expect(turnedSize(1600, 1200, 90)).toEqual({ width: 1200, height: 1600 });
    const crop = largestCrop(4 / 3, 1600, 1200, 10);
    expect(cropInside(crop, 1600, 1200, 10)).toBe(true);
    expect(cropInside(WHOLE, 1600, 1200, 10)).toBe(false);
    // Turned by a right angle, the whole photo again
    expect(largestCrop(null, 1600, 1200, 90)).toEqual(WHOLE);
  });

  it('makes the file sent 2400 px at most', () => {
    expect(outputSize(4000, 3000)).toEqual({ width: 2400, height: 1800 });
    expect(outputSize(1600, 1200)).toEqual({ width: 1600, height: 1200 });
  });
});
