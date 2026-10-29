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
  cropProblem,
  largestCrop,
  movedCrop,
  outputSize,
  resizedCrop,
  sameAdjustments,
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

/**
 * Photo editor of the back-office, before an upload or on a photo of the site ("Retoucher"):
 * cropping (free, or at a ratio the site uses), quarter turns, mirror, ready-made filters and
 * light settings. Done in the browser: the API receives a plain JPEG, 2400 px at most, and a frame
 * the API would refuse (too small, wrong shape) is said before sending; a retouched photo, which
 * comes from the 1600 px file of the site, may be smaller than an upload. Left untouched, a chosen file up to 2400 px is sent as it is.
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
  /** A photo of the site retouched: smaller sizes accepted, nothing to send when untouched. */
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
  /** Quarter turns clockwise, 0 to 3. */
  protected readonly turns = signal(0);
  protected readonly flipped = signal(false);
  protected readonly ratio = signal<Ratio>(null);
  protected readonly crop = signal<Crop>(WHOLE);
  protected readonly adjustments = signal<Adjustments>(NO_ADJUSTMENT);
  protected readonly busy = signal(false);

  /** Size of the photo once turned, in pixels. */
  private readonly turnedSize = computed(() => {
    const image = this.image();
    if (!image) {
      return { width: 0, height: 0 };
    }
    return this.turns() % 2
      ? { width: image.naturalHeight, height: image.naturalWidth }
      : { width: image.naturalWidth, height: image.naturalHeight };
  });
  private readonly cropPixels = computed(() => ({
    width: Math.round(this.crop().width * this.turnedSize().width),
    height: Math.round(this.crop().height * this.turnedSize().height),
  }));
  protected readonly problem = computed(() =>
    this.image() ? cropProblem(this.cropPixels().width, this.cropPixels().height, this.portrait(), this.retouch()) : null,
  );
  protected readonly sizeLabel = computed(() => {
    const size = outputSize(this.cropPixels().width, this.cropPixels().height);
    return `Photo envoyée : ${size.width} × ${size.height} pixels`;
  });
  protected readonly untouched = computed(
    () =>
      this.turns() === 0 &&
      !this.flipped() &&
      sameCrop(this.crop(), WHOLE) &&
      sameAdjustments(this.adjustments(), NO_ADJUSTMENT),
  );
  protected readonly activePreset = computed(() => PRESETS.find((preset) => sameAdjustments(preset.adjustments, this.adjustments())));

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
  /** The turned photo at preview size, before the settings: they are applied to a copy of it. */
  private basePixels: ImageData | null = null;
  private drag: Drag | null = null;
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
      const width = this.stageWidth();
      if (image && canvas && width) {
        this.drawBase(image, canvas, width, this.turns(), this.flipped());
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
    const { width, height } = this.turnedSize();
    this.crop.set(largestCrop(ratio, width, height));
  }

  /** A quarter turn, left (-1) or right (1): the frame starts again from the whole photo. */
  protected turn(direction: 1 | -1): void {
    this.turns.update((turns) => (turns + direction + 4) % 4);
    const { width, height } = this.turnedSize();
    this.crop.set(largestCrop(this.ratio(), width, height));
  }

  protected flip(): void {
    this.flipped.update((flipped) => !flipped);
    // The frame mirrors with the photo
    this.crop.update((crop) => ({ ...crop, x: 1 - crop.x - crop.width }));
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
    this.turns.set(0);
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
    if (!drag || drag.pointerId !== event.pointerId || !canvas) {
      return;
    }
    const box = canvas.getBoundingClientRect();
    if (drag.corner) {
      const { width, height } = this.turnedSize();
      const px = (event.clientX - box.left) / box.width;
      const py = (event.clientY - box.top) / box.height;
      this.crop.set(resizedCrop(drag.startCrop, drag.corner, px, py, this.ratio(), width, height));
    } else {
      this.crop.set(
        movedCrop(drag.startCrop, (event.clientX - drag.startX) / box.width, (event.clientY - drag.startY) / box.height),
      );
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
    if (move) {
      event.preventDefault();
      this.crop.update((crop) => movedCrop(crop, move[0], move[1]));
    }
  }

  protected async confirm(): Promise<void> {
    const image = this.image();
    const source = this.source();
    if (!image || this.problem()) {
      return;
    }
    // A large photo is still made smaller: quicker to send from a phone, as sharp on the site (1600 px)
    if (this.untouched() && source instanceof File && Math.max(image.naturalWidth, image.naturalHeight) <= MAX_OUTPUT_SIDE) {
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
    this.turns.set(0);
    this.flipped.set(false);
    this.adjustments.set(NO_ADJUSTMENT);
    this.image.set(image);
    this.startFrame();
  }

  /** The whole photo when the site takes it as it is, otherwise the largest frame of the usual ratio. */
  private startFrame(): void {
    const { width, height } = this.turnedSize();
    if (!cropProblem(width, height, this.portrait(), this.retouch())) {
      this.ratio.set(null);
      this.crop.set(WHOLE);
    } else {
      this.chooseRatio(this.portrait() ? 2 / 3 : 4 / 3);
    }
  }

  private drawBase(image: HTMLImageElement, canvas: HTMLCanvasElement, stageWidth: number, turns: number, flipped: boolean): void {
    const turned = turns % 2 ? { width: image.naturalHeight, height: image.naturalWidth } : { width: image.naturalWidth, height: image.naturalHeight };
    // Fits the stage, and leaves the tools in sight under it
    const maxHeight = Math.max(200, window.innerHeight * 0.5);
    const scale = Math.min(stageWidth / turned.width, maxHeight / turned.height, 1);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${Math.round(turned.width * scale)}px`;
    canvas.style.height = `${Math.round(turned.height * scale)}px`;
    canvas.width = Math.max(1, Math.round(turned.width * scale * pixelRatio));
    canvas.height = Math.max(1, Math.round(turned.height * scale * pixelRatio));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return;
    }
    context.imageSmoothingQuality = 'high';
    context.scale(canvas.width / turned.width, canvas.height / turned.height);
    drawTurned(context, image, turned.width, turned.height, turns, flipped);
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
    const turned = this.turnedSize();
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
    context.translate(-crop.x * turned.width, -crop.y * turned.height);
    drawTurned(context, image, turned.width, turned.height, this.turns(), this.flipped());
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

/** Draws the photo turned by quarter turns, then mirrored, into a box of the turned size. */
function drawTurned(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  turnedWidth: number,
  turnedHeight: number,
  turns: number,
  flipped: boolean,
): void {
  context.translate(turnedWidth / 2, turnedHeight / 2);
  if (flipped) {
    context.scale(-1, 1);
  }
  context.rotate((turns * Math.PI) / 2);
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2, image.naturalWidth, image.naturalHeight);
}

function sameCrop(a: Crop, b: Crop): boolean {
  const close = (x: number, y: number) => Math.abs(x - y) < 0.001;
  return close(a.x, b.x) && close(a.y, b.y) && close(a.width, b.width) && close(a.height, b.height);
}
