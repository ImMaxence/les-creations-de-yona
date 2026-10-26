import { IMAGE_LOADER, ImageLoaderConfig, NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { Icon } from '../icon/icon';

/** The API serves every image in two WebP widths: /api/images/{id}/800.webp and /1600.webp. */
function apiImageLoader({ src, width }: ImageLoaderConfig): string {
  return `/api/images/${src}/${width !== undefined && width > 800 ? 1600 : 800}.webp`;
}

/**
 * Image of a recipe or a category, filling its parent (which sets the size and aspect ratio).
 * Without image, shows the default visual. Parents can zoom the picture with --cover-scale.
 */
@Component({
  selector: 'yona-cover-image',
  imports: [Icon, NgOptimizedImage],
  templateUrl: './cover-image.html',
  styleUrl: './cover-image.scss',
  providers: [{ provide: IMAGE_LOADER, useValue: apiImageLoader }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoverImage {
  readonly imageId = input<string | null | undefined>();
  /** Empty when the image is decorative (the name is written next to it). */
  readonly alt = input('');
  /** Rendered width of the image, for the browser to pick 800 or 1600 px. */
  readonly sizes = input('100vw');
  /** Above the fold (largest image of the page): loaded first, never lazily. */
  readonly priority = input(false, { transform: booleanAttribute });
}
