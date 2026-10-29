/**
 * What the photo editor of the back-office does to a photo, apart from the screen: light and colour
 * settings applied to the pixels, crop frame geometry, the sizes the API accepts. Pure functions,
 * the same for the preview and the file sent.
 */

/** Each from -100 to 100, 0 leaving the photo as it is. */
export interface Adjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  /** Positive: warmer (orange), negative: cooler (blue). */
  warmth: number;
}

export const NO_ADJUSTMENT: Adjustments = { brightness: 0, contrast: 0, saturation: 0, warmth: 0 };

/** Ready-made settings, chosen for food photos; the sliders fine-tune them afterwards. */
export const PRESETS: readonly { label: string; adjustments: Adjustments }[] = [
  { label: 'Aucun', adjustments: NO_ADJUSTMENT },
  { label: 'Lumineux', adjustments: { brightness: 20, contrast: 5, saturation: 10, warmth: 0 } },
  { label: 'Gourmand', adjustments: { brightness: 8, contrast: 12, saturation: 25, warmth: 20 } },
  { label: 'Doux', adjustments: { brightness: 12, contrast: -15, saturation: -10, warmth: 8 } },
  { label: 'Contrasté', adjustments: { brightness: 0, contrast: 30, saturation: 15, warmth: 0 } },
  { label: 'Frais', adjustments: { brightness: 8, contrast: 5, saturation: 5, warmth: -25 } },
  { label: 'Noir et blanc', adjustments: { brightness: 5, contrast: 15, saturation: -100, warmth: 0 } },
];

export function sameAdjustments(a: Adjustments, b: Adjustments): boolean {
  return a.brightness === b.brightness && a.contrast === b.contrast && a.saturation === b.saturation && a.warmth === b.warmth;
}

/**
 * Applies the settings to RGBA pixels, in place: brightness, contrast, saturation, then warmth.
 * The array clamps each value to 0..255 by itself.
 */
export function applyAdjustments(pixels: Uint8ClampedArray, adjustments: Adjustments): void {
  if (sameAdjustments(adjustments, NO_ADJUSTMENT)) {
    return;
  }
  const brightness = 1 + adjustments.brightness / 200;
  const contrast = 1 + (adjustments.contrast / 100) * 0.6;
  const saturation = 1 + adjustments.saturation / 100;
  const warmth = (adjustments.warmth / 100) * 25;
  for (let i = 0; i < pixels.length; i += 4) {
    let r = (pixels[i] * brightness - 128) * contrast + 128;
    let g = (pixels[i + 1] * brightness - 128) * contrast + 128;
    let b = (pixels[i + 2] * brightness - 128) * contrast + 128;
    // Saturation around the luminance (Rec. 709 weights, as CSS saturate())
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = gray + (r - gray) * saturation;
    g = gray + (g - gray) * saturation;
    b = gray + (b - gray) * saturation;
    pixels[i] = r + warmth;
    pixels[i + 1] = g + warmth * 0.2;
    pixels[i + 2] = b - warmth;
  }
}

/** A part of the photo, as shares of its width and height (0 to 1), once turned. */
export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const WHOLE: Crop = { x: 0, y: 0, width: 1, height: 1 };

/** Width / height of the frame wanted, in pixels; null when free. */
export type Ratio = number | null;

/**
 * The largest frame of that ratio, centred, on a photo of width × height pixels; the whole photo
 * when free.
 */
export function largestCrop(ratio: Ratio, width: number, height: number): Crop {
  if (ratio === null) {
    return WHOLE;
  }
  // The ratio in shares of the photo: share of width / share of height
  const shares = (ratio * height) / width;
  return shares <= 1
    ? { x: (1 - shares) / 2, y: 0, width: shares, height: 1 }
    : { x: 0, y: (1 - 1 / shares) / 2, width: 1, height: 1 / shares };
}

/** The frame moved by (dx, dy) shares, kept inside the photo. */
export function movedCrop(crop: Crop, dx: number, dy: number): Crop {
  return {
    ...crop,
    x: clamp(crop.x + dx, 0, 1 - crop.width),
    y: clamp(crop.y + dy, 0, 1 - crop.height),
  };
}

/** A corner of the frame: its side across (left or right), and up or down. */
export interface Corner {
  right: boolean;
  bottom: boolean;
}

/** Smallest frame side, in shares: a handle never crosses the other. */
const MIN_SHARE = 0.05;

/**
 * The frame once a corner is dragged to (px, py), the opposite corner staying; with a ratio, the
 * frame keeps it, within the photo.
 */
export function resizedCrop(crop: Crop, corner: Corner, px: number, py: number, ratio: Ratio, width: number, height: number): Crop {
  const anchorX = corner.right ? crop.x : crop.x + crop.width;
  const anchorY = corner.bottom ? crop.y : crop.y + crop.height;
  // As far as the photo allows, on the side of the dragged corner
  const maxWidth = corner.right ? 1 - anchorX : anchorX;
  const maxHeight = corner.bottom ? 1 - anchorY : anchorY;
  let newWidth = clamp(corner.right ? px - anchorX : anchorX - px, MIN_SHARE, maxWidth);
  let newHeight = clamp(corner.bottom ? py - anchorY : anchorY - py, MIN_SHARE, maxHeight);
  if (ratio !== null) {
    const shares = (ratio * height) / width;
    if (newWidth / newHeight > shares) {
      newWidth = newHeight * shares;
    } else {
      newHeight = newWidth / shares;
    }
  }
  return {
    x: corner.right ? anchorX : anchorX - newWidth,
    y: corner.bottom ? anchorY : anchorY - newHeight,
    width: newWidth,
    height: newHeight,
  };
}

/** Smallest photo the API takes: an upload, or a retouched photo of the site (from its 1600 px file). */
export function minimumSize(portrait: boolean, retouch: boolean): { width: number; height: number } {
  if (retouch) {
    return portrait ? { width: 600, height: 800 } : { width: 800, height: 450 };
  }
  return portrait ? { width: 1000, height: 1333 } : { width: 1200, height: 800 };
}

/** Largest side of the file sent: enough for the 1600 px version, light to send from a phone. */
export const MAX_OUTPUT_SIDE = 2400;

/** Size of the file made from a frame of width × height pixels. */
export function outputSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, MAX_OUTPUT_SIDE / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Why the API would refuse a frame of width × height pixels; null when it is fine. */
export function cropProblem(width: number, height: number, portrait: boolean, retouch: boolean): string | null {
  // Same rules as the API: landscape 4:3 or wider, portrait 3:4 or taller
  if (portrait ? 3 * height < 4 * width : 3 * width < 4 * height) {
    return portrait ? 'Cadre trop large : la photo Pinterest doit être verticale (3:4 ou plus haute)' : 'Cadre trop haut : la photo doit être en paysage (4:3 ou plus large)';
  }
  const minimum = minimumSize(portrait, retouch);
  const output = outputSize(width, height);
  if (output.width < minimum.width || output.height < minimum.height) {
    return `Cadre trop petit : ${minimum.width} × ${minimum.height} pixels au moins`;
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
