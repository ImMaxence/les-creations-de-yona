import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Button } from '../button/button';
import { Dialog } from '../dialog/dialog';
import { Icon } from '../icon/icon';
import { sendableAsIs } from '../image-upload/photo-file';
import {
  Adjustments,
  Corner,
  Crop,
  MAX_OUTPUT_SIDE,
  NO_ADJUSTMENT,
  PRESETS,
  Ratio,
  WHOLE,
  applyAdjustments,
  cropInside,
  cropProblem,
  isRightAngle,
  largestCrop,
  movedCrop,
  normalizedAngle,
  outputSize,
  resizedCrop,
  sameAdjustments,
  snappedAngle,
  turnedSize,
} from './photo-edits';

const LANDSCAPE_RATIOS: readonly { label: string; ratio: Ratio }[] = [
  { label: 'Libre', ratio: null },
  { label: '4:3', ratio: 4 / 3 },
  { label: '3:2', ratio: 3 / 2 },
  { label: '16:9', ratio: 16 / 9 },
];

const PORTRAIT_RATIOS: readonly { label: string; ratio: Ratio }[] = [
  { label: 'Libre', ratio: null },
  { label: '2:3', ratio: 2 / 3 },
  { label: '3:4', ratio: 3 / 4 },
];

const SLIDERS: readonly { key: keyof Adjustments; label: string }[] = [
  { key: 'brightness', label: 'Luminosité' },
  { key: 'contrast', label: 'Contraste' },
  { key: 'saturation', label: 'Couleurs' },
  { key: 'warmth', label: 'Chaleur' },
];

const CORNERS: readonly Corner[] = [
  { right: false, bottom: false },
  { right: true, bottom: false },
  { right: false, bottom: true },
  { right: true, bottom: true },
];

/** Share of the photo an arrow key moves the frame by. */
const KEY_STEP = 0.02;

const JPEG_QUALITY = 0.92;

/** A drag of the frame, or of one of its corners, from where it started. */
interface Drag {
  pointerId: number;
  corner: Corner | null;
  startX: number;
  startY: number;
  startCrop: Crop;
}

/** The dial being turned: its centre on screen, and the angle of the finger last seen. */
interface Turn {
  pointerId: number;
  centerX: number;
  centerY: number;
  lastPointer: number;
  /** Angle the finger has turned to, before the stop on right angles. */
  free: number;
}

/**
 * Photo editor of the back-office, before an upload or on a photo of the site ("Retoucher"):
 * cropping (free, or at a ratio the site uses), rotation (quarter turns, or any angle with the
 * dial, stopping on right angles), mirror, ready-made filters and light settings. Tilted, the frame
 * stays on the photo: no empty corner. Done in the browser: the API receives a plain JPEG, 2400 px
 * at most, and a frame the API would refuse (too small, wrong shape) is said before sending. Left
 * untouched, a JPEG or PNG the API takes as it is (10 MB, 2400 px at most) is sent without change.
 */
@Component({
  selector: 'yona-photo-editor',
  imports: [Button, Dialog, Icon],
  templateUrl: './photo-editor.html',
  styleUrl: './photo-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoEditor {
  /** A file chosen on the device, or the URL of a photo of the site. */
  readonly source = input<File | string | null>(null);
  /** The vertical photo offered to Pinterest. */
  readonly portrait = input(false, { transform: booleanAttribute });
  /** A photo of the site retouched: nothing to send when untouched. */
  readonly retouch = input(false, { transform: booleanAttribute });
  readonly open = model(false);
  /** The photo to send: the chosen file itself when untouched. */
  readonly edited = output<File>();

  protected readonly ratios = computed(() => (this.portrait() ? PORTRAIT_RATIOS : LANDSCAPE_RATIOS));
  protected readonly presets = PRESETS;
  protected readonly sliders = SLIDERS;
  protected readonly corners = CORNERS;

  protected readonly image = signal<HTMLImageElement | null>(null);
  protected readonly loadFailed = signal(false);
  /** Rotation shown, in degrees clockwise, from 0 to 359.x. */
  protected readonly angle = signal(0);
  /** Mirrored before the rotation (see flip). */
  protected readonly flipped = signal(false);
  protected readonly ratio = signal<Ratio>(null);
  protected readonly crop = signal<Crop>(WHOLE);
  protected readonly adjustments = signal<Adjustments>(NO_ADJUSTMENT);
  protected readonly busy = signal(false);
  /** "12°", in the middle of the dial. */
  protected readonly angleLabel = computed(() => `${Math.round(this.angle())}°`);

  /** Size of the box holding the turned photo, in pixels. */
  private readonly boxSize = computed(() => {
    const image = this.image();
    return image ? turnedSize(image.naturalWidth, image.naturalHeight, this.angle()) : { width: 0, height: 0 };
  });
  private readonly cropPixels = computed(() => ({
    width: Math.round(this.crop().width * this.boxSize().width),
    height: Math.round(this.crop().height * this.boxSize().height),
  }));
  protected readonly problem = computed(() =>
    this.image() ? cropProblem(this.cropPixels().width, this.cropPixels().height, this.portrait()) : null,
  );
  protected readonly sizeLabel = computed(() => {
    const size = outputSize(this.cropPixels().width, this.cropPixels().height);
    return `Photo envoyée : ${size.width} × ${size.height} pixels`;
  });
  protected readonly untouched = computed(
    () =>
      this.angle() === 0 &&
      !this.flipped() &&
      sameCrop(this.crop(), WHOLE) &&
      sameAdjustments(this.adjustments(), NO_ADJUSTMENT),
  );
  protected readonly activePreset = computed(() => PRESETS.find((preset) => sameAdjustments(preset.adjustments, this.adjustments())));

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly frame = viewChild<ElementRef<HTMLElement>>('frame');
  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
  /** The turned photo at preview size, before the settings: they are applied to a copy of it. */
  private basePixels: ImageData | null = null;
  private drag: Drag | null = null;
  private turning: Turn | null = null;
  private objectUrl: string | null = null;
  private loadCount = 0;
  /** Width of the stage, followed so that the preview fits it (phone turned, window resized). */
  private readonly stageWidth = signal(0);

  constructor() {
    // A new photo each time the editor opens
    effect(() => {
      const source = this.source();
      if (this.open() && source) {
        untracked(() => void this.load(source));
      }
    });
    afterRenderEffect(() => {
      const stage = this.stage()?.nativeElement;
      if (!stage) {
        return;
      }
      const observer = new ResizeObserver(([entry]) => this.stageWidth.set(Math.floor(entry.contentRect.width)));
      observer.observe(stage);
      return () => observer.disconnect();
    });
    // The turned photo, drawn again when it turns or the stage changes size
    afterRenderEffect(() => {
      const image = this.image();
      const canvas = this.canvas()?.nativeElement;
      const frame = this.frame()?.nativeElement;
      const width = this.stageWidth();
      if (image && canvas && frame && width) {
        this.drawBase(image, canvas, frame, width, this.angle(), this.flipped());
        this.drawAdjusted(canvas, untracked(this.adjustments));
      }
    });
    afterRenderEffect(() => {
      const adjustments = this.adjustments();
      const canvas = untracked(this.canvas)?.nativeElement;
      if (canvas) {
        this.drawAdjusted(canvas, adjustments);
      }
    });
    inject(DestroyRef).onDestroy(() => this.releaseUrl());
  }

  protected chooseRatio(ratio: Ratio): void {
    this.ratio.set(ratio);
    this.fitFrame();
  }

  /** A quarter turn, left (-1) or right (1), from the right angle closest: the frame starts again. */
  protected turn(direction: 1 | -1): void {
    this.angle.set(normalizedAngle(Math.round(this.angle() / 90) * 90 + direction * 90));
    this.fitFrame();
  }

  /**
   * Mirror of what is shown, left to right. The photo is mirrored before being turned: the angle
   * changes side for the view to be the mirror of the previous one.
   */
  protected flip(): void {
    this.flipped.update((flipped) => !flipped);
    this.angle.update((angle) => normalizedAngle(-angle));
    this.crop.update((crop) => ({ ...crop, x: 1 - crop.x - crop.width }));
  }

  /** The dial pressed: it turns with the finger (or the mouse) around its centre. */
  protected startTurn(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    const dial = event.currentTarget as HTMLElement;
    dial.setPointerCapture(event.pointerId);
    dial.focus();
    const box = dial.getBoundingClientRect();
    const centerX = box.left + box.width / 2;
    const centerY = box.top + box.height / 2;
    this.turning = {
      pointerId: event.pointerId,
      centerX,
      centerY,
      lastPointer: pointerAngle(event, centerX, centerY),
      free: this.angle(),
    };
  }

  protected onTurn(event: PointerEvent): void {
    const turning = this.turning;
    if (!turning || turning.pointerId !== event.pointerId) {
      return;
    }
    const pointer = pointerAngle(event, turning.centerX, turning.centerY);
    // The shortest way from the last position: the finger may go round several times
    turning.free += ((pointer - turning.lastPointer + 540) % 360) - 180;
    turning.lastPointer = pointer;
    // By whole degrees: finer than a finger can aim anyway
    this.setAngle(snappedAngle(Math.round(turning.free)));
  }

  protected endTurn(event: PointerEvent): void {
    if (this.turning?.pointerId === event.pointerId) {
      this.turning = null;
    }
  }

  /** Arrows turn by one degree, Page up and down by a quarter turn. */
  protected onDialKey(event: KeyboardEvent): void {
    const steps: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
    if (event.key in steps) {
      event.preventDefault();
      this.setAngle(normalizedAngle(Math.round(this.angle()) + steps[event.key]));
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      this.turn(event.key === 'PageUp' ? 1 : -1);
    }
  }

  protected choosePreset(adjustments: Adjustments): void {
    this.adjustments.set(adjustments);
  }

  protected adjust(key: keyof Adjustments, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.adjustments.update((adjustments) => ({ ...adjustments, [key]: value }));
  }

  /** Back to the photo as it came, with the frame the site needs. */
  protected reset(): void {
    this.angle.set(0);
    this.flipped.set(false);
    this.adjustments.set(NO_ADJUSTMENT);
    this.startFrame();
  }

  protected startDrag(event: PointerEvent, corner: Corner | null): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.drag = { pointerId: event.pointerId, corner, startX: event.clientX, startY: event.clientY, startCrop: this.crop() };
  }

  protected onDrag(event: PointerEvent): void {
    const drag = this.drag;
    const canvas = this.canvas()?.nativeElement;
    const image = this.image();
    if (!drag || drag.pointerId !== event.pointerId || !canvas || !image) {
      return;
    }
    const box = canvas.getBoundingClientRect();
    const next = drag.corner
      ? resizedCrop(
          drag.startCrop,
          drag.corner,
          (event.clientX - box.left) / box.width,
          (event.clientY - box.top) / box.height,
          this.ratio(),
          this.boxSize().width,
          this.boxSize().height,
        )
      : movedCrop(drag.startCrop, (event.clientX - drag.startX) / box.width, (event.clientY - drag.startY) / box.height);
    // Tilted, the frame stops where it would leave the photo
    if (cropInside(next, image.naturalWidth, image.naturalHeight, this.angle())) {
      this.crop.set(next);
    }
  }

  protected endDrag(event: PointerEvent): void {
    if (this.drag?.pointerId === event.pointerId) {
      this.drag = null;
    }
  }

  /** Arrows move the frame, for the keyboard. */
  protected onFrameKey(event: KeyboardEvent): void {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
    };
    const move = moves[event.key];
    const image = this.image();
    if (move && image) {
      event.preventDefault();
      const next = movedCrop(this.crop(), move[0], move[1]);
      if (cropInside(next, image.naturalWidth, image.naturalHeight, this.angle())) {
        this.crop.set(next);
      }
    }
  }

  protected async confirm(): Promise<void> {
    const image = this.image();
    const source = this.source();
    if (!image || this.problem()) {
      return;
    }
    // A large photo is still made smaller: quicker to send from a phone, as sharp on the site (1600 px)
    if (
      this.untouched() &&
      source instanceof File &&
      sendableAsIs(source) &&
      Math.max(image.naturalWidth, image.naturalHeight) <= MAX_OUTPUT_SIDE
    ) {
      this.finish(source);
      return;
    }
    this.busy.set(true);
    try {
      this.finish(await this.render(image, source instanceof File ? source.name : 'photo'));
    } finally {
      this.busy.set(false);
    }
  }

  protected onClosed(): void {
    this.image.set(null);
    this.basePixels = null;
    this.releaseUrl();
  }

  /** A new angle, the frame fitted again: tilted, it shrinks to stay on the photo. */
  private setAngle(angle: number): void {
    if (angle === this.angle()) {
      return;
    }
    if (isRightAngle(angle) && !isRightAngle(this.angle())) {
      // A small tap felt on the right angle, where the phone can
      navigator.vibrate?.(10);
    }
    this.angle.set(angle);
    this.fitFrame();
  }

  /** The largest frame of the ratio chosen, centred, on the photo as it is turned. */
  private fitFrame(): void {
    const image = this.image();
    if (image) {
      this.crop.set(largestCrop(this.ratio(), image.naturalWidth, image.naturalHeight, this.angle()));
    }
  }

  private finish(file: File): void {
    this.edited.emit(file);
    this.open.set(false);
  }

  private async load(source: File | string): Promise<void> {
    const count = ++this.loadCount;
    this.image.set(null);
    this.loadFailed.set(false);
    this.releaseUrl();
    const image = new Image();
    if (source instanceof File) {
      this.objectUrl = URL.createObjectURL(source);
      image.src = this.objectUrl;
    } else {
      image.src = source;
    }
    try {
      await image.decode();
    } catch {
      if (count === this.loadCount) {
        this.loadFailed.set(true);
      }
      return;
    }
    if (count !== this.loadCount) {
      return;
    }
    this.angle.set(0);
    this.flipped.set(false);
    this.adjustments.set(NO_ADJUSTMENT);
    this.image.set(image);
    this.startFrame();
  }

  /** The whole photo when the site takes it as it is, otherwise the largest frame of the usual ratio. */
  private startFrame(): void {
    const { width, height } = this.boxSize();
    if (!cropProblem(width, height, this.portrait())) {
      this.ratio.set(null);
      this.crop.set(WHOLE);
    } else {
      this.chooseRatio(this.portrait() ? 2 / 3 : 4 / 3);
    }
  }

  /**
   * The preview keeps the size of the photo turned by the closest right angle: while it turns,
   * the corners of the box around it go past the stage instead of shrinking everything.
   */
  private drawBase(
    image: HTMLImageElement,
    canvas: HTMLCanvasElement,
    frame: HTMLElement,
    stageWidth: number,
    angle: number,
    flipped: boolean,
  ): void {
    const box = turnedSize(image.naturalWidth, image.naturalHeight, angle);
    const upright = turnedSize(image.naturalWidth, image.naturalHeight, Math.round(angle / 90) * 90);
    // Fits the stage, and leaves the tools in sight under it
    const maxHeight = Math.max(200, window.innerHeight * 0.5);
    const scale = Math.min(stageWidth / upright.width, maxHeight / upright.height, 1);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${Math.round(box.width * scale)}px`;
    canvas.style.height = `${Math.round(box.height * scale)}px`;
    frame.style.margin = `${Math.round(((upright.height - box.height) * scale) / 2)}px ${Math.round(((upright.width - box.width) * scale) / 2)}px`;
    canvas.width = Math.max(1, Math.round(box.width * scale * pixelRatio));
    canvas.height = Math.max(1, Math.round(box.height * scale * pixelRatio));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return;
    }
    context.imageSmoothingQuality = 'high';
    context.scale(canvas.width / box.width, canvas.height / box.height);
    drawTurned(context, image, box.width, box.height, angle, flipped);
    this.basePixels = context.getImageData(0, 0, canvas.width, canvas.height);
  }

  private drawAdjusted(canvas: HTMLCanvasElement, adjustments: Adjustments): void {
    const base = this.basePixels;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!base || !context) {
      return;
    }
    const pixels = new ImageData(new Uint8ClampedArray(base.data), base.width, base.height);
    applyAdjustments(pixels.data, adjustments);
    context.putImageData(pixels, 0, 0);
  }

  /** The frame at full size (2400 px at most), turned, mirrored and adjusted, as a JPEG. */
  private async render(image: HTMLImageElement, name: string): Promise<File> {
    const box = this.boxSize();
    const crop = this.crop();
    const pixels = this.cropPixels();
    const size = outputSize(pixels.width, pixels.height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d')!;
    // A transparent PNG on white, as a JPEG has no transparency
    context.fillStyle = '#fff';
    context.fillRect(0, 0, size.width, size.height);
    context.imageSmoothingQuality = 'high';
    context.scale(size.width / pixels.width, size.height / pixels.height);
    context.translate(-crop.x * box.width, -crop.y * box.height);
    drawTurned(context, image, box.width, box.height, this.angle(), this.flipped());
    context.setTransform(1, 0, 0, 1, 0, 0);
    const data = context.getImageData(0, 0, size.width, size.height);
    applyAdjustments(data.data, this.adjustments());
    context.putImageData(data, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    // Frees the memory of the canvas at once (Safari keeps it otherwise)
    canvas.width = canvas.height = 0;
    if (!blob) {
      throw new Error('The photo could not be encoded');
    }
    return new File([blob], `${name.replace(/\.[^.]+$/, '')}-retouchee.jpg`, { type: 'image/jpeg' });
  }

  private releaseUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}

/**
 * Draws the photo, mirrored then turned by that angle around its centre, in the middle of a box of
 * the turned size: what is shown is the mirrored photo turned clockwise.
 */
function drawTurned(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  boxWidth: number,
  boxHeight: number,
  angle: number,
  flipped: boolean,
): void {
  context.translate(boxWidth / 2, boxHeight / 2);
  context.rotate((angle * Math.PI) / 180);
  if (flipped) {
    context.scale(-1, 1);
  }
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2, image.naturalWidth, image.naturalHeight);
}

/** Angle of the pointer seen from (centerX, centerY), in degrees, clockwise from the right. */
function pointerAngle(event: PointerEvent, centerX: number, centerY: number): number {
  return (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) / Math.PI;
}

function sameCrop(a: Crop, b: Crop): boolean {
  const close = (x: number, y: number) => Math.abs(x - y) < 0.001;
  return close(a.x, b.x) && close(a.y, b.y) && close(a.width, b.width) && close(a.height, b.height);
}
