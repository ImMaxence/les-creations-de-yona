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

/**
 * A part of the turned photo, as shares (0 to 1) of the box holding it: the photo itself when turned
 * by a right angle, the box around the tilted photo otherwise.
 */
export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const WHOLE: Crop = { x: 0, y: 0, width: 1, height: 1 };

/** Width / height of the frame wanted, in pixels; null when free. */
export type Ratio = number | null;

/** Within this many degrees of a right angle, the rotation stops on it. */
export const SNAP_DEGREES = 5;

/** From 0 to 359.x, clockwise. */
export function normalizedAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/** The angle stopped on 0, 90, 180 or 270 when close to it. */
export function snappedAngle(angle: number): number {
  const right = Math.round(angle / 90) * 90;
  return normalizedAngle(Math.abs(angle - right) <= SNAP_DEGREES ? right : angle);
}

export function isRightAngle(angle: number): boolean {
  return normalizedAngle(angle) % 90 === 0;
}

/** Size of the box around a photo of width × height pixels turned by that angle. */
export function turnedSize(width: number, height: number, angle: number): { width: number; height: number } {
  const { cos, sin } = absoluteTrig(angle);
  return { width: Math.round(width * cos + height * sin), height: Math.round(width * sin + height * cos) };
}

/**
 * The largest frame of that ratio, centred, inside a photo of width × height pixels turned by that
 * angle: no empty corner when it is tilted. Free, the ratio of the photo as it stands.
 */
export function largestCrop(ratio: Ratio, width: number, height: number, angle = 0): Crop {
  const { cos, sin } = absoluteTrig(angle);
  const box = turnedSize(width, height, angle);
  const wanted = ratio ?? (cos >= sin ? width / height : height / width);
  // Half sides a × b of a centred frame: its corners within the photo, a = ratio × b
  const halfHeight = Math.min(width / 2 / (wanted * cos + sin), height / 2 / (wanted * sin + cos));
  const shareWidth = Math.min(1, (2 * wanted * halfHeight) / box.width);
  const shareHeight = Math.min(1, (2 * halfHeight) / box.height);
  return { x: (1 - shareWidth) / 2, y: (1 - shareHeight) / 2, width: shareWidth, height: shareHeight };
}

/** Whether every corner of the frame lies on the photo turned by that angle (a pixel of tolerance). */
export function cropInside(crop: Crop, width: number, height: number, angle: number): boolean {
  if (isRightAngle(angle)) {
    return true;
  }
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const box = turnedSize(width, height, angle);
  const corners = [
    [crop.x, crop.y],
    [crop.x + crop.width, crop.y],
    [crop.x, crop.y + crop.height],
    [crop.x + crop.width, crop.y + crop.height],
  ];
  return corners.every(([shareX, shareY]) => {
    // From the centre of the box, turned back onto the photo
    const x = (shareX - 0.5) * box.width;
    const y = (shareY - 0.5) * box.height;
    return Math.abs(x * cos + y * sin) <= width / 2 + 1 && Math.abs(-x * sin + y * cos) <= height / 2 + 1;
  });
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

/** Smallest photo the API takes, upload or retouch alike. */
export function minimumSize(portrait: boolean): { width: number; height: number } {
  return portrait ? { width: 600, height: 800 } : { width: 800, height: 450 };
}

/** Largest side of the file sent: enough for the 1600 px version, light to send from a phone. */
export const MAX_OUTPUT_SIDE = 2400;

/** Size of the file made from a frame of width × height pixels. */
export function outputSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, MAX_OUTPUT_SIDE / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Why the API would refuse a frame of width × height pixels; null when it is fine. */
export function cropProblem(width: number, height: number, portrait: boolean): string | null {
  // Same rules as the API: landscape or square, portrait 3:4 or taller
  if (portrait ? 3 * height < 4 * width : width < height) {
    return portrait
      ? 'Cadre trop large : la photo Pinterest doit être verticale (3:4 ou plus haute)'
      : 'Cadre trop haut : la photo doit être en paysage ou carrée';
  }
  const minimum = minimumSize(portrait);
  const output = outputSize(width, height);
  if (output.width < minimum.width || output.height < minimum.height) {
    return `Cadre trop petit : ${minimum.width} × ${minimum.height} pixels au moins`;
  }
  return null;
}

/** |cos| and |sin| of an angle in degrees, rounded: cos(90°) is not exactly 0 in floating point. */
function absoluteTrig(angle: number): { cos: number; sin: number } {
  const radians = (angle * Math.PI) / 180;
  return {
    cos: Math.abs(Math.round(Math.cos(radians) * 1e9) / 1e9),
    sin: Math.abs(Math.round(Math.sin(radians) * 1e9) / 1e9),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
