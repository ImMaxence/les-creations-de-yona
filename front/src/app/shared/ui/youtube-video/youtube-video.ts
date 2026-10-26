import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CoverImage } from '../cover-image/cover-image';
import { Icon } from '../icon/icon';

/** YouTube ids are 11 characters; anything else is refused rather than put in an iframe URL. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * YouTube video of a recipe. Nothing is loaded from YouTube until the visitor clicks: the recipe
 * photo stands in for the player (no request, no cookie from Google before that click). The player
 * then comes from youtube-nocookie.com, the privacy-enhanced mode, and starts right away.
 */
@Component({
  selector: 'yona-youtube-video',
  imports: [Icon, CoverImage],
  template: `
    @if (playerUrl(); as url) {
      <iframe
        class="frame"
        [src]="url"
        [title]="'Vidéo : ' + title()"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowfullscreen
        referrerpolicy="strict-origin-when-cross-origin"
      ></iframe>
    } @else {
      <button type="button" class="facade" (click)="playing.set(true)">
        <yona-cover-image class="facade__image" [imageId]="imageId()" sizes="(width >= 48rem) 48rem, 100vw" />
        <span class="facade__play" aria-hidden="true">
          <svg yonaIcon="play" [size]="30" fill="currentColor"></svg>
        </span>
        <span class="facade__label">Lire la vidéo</span>
      </button>
      <p class="note">La vidéo est hébergée par YouTube (Google) : elle ne se charge qu'après votre clic.</p>
    }
  `,
  styleUrl: './youtube-video.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class YoutubeVideo {
  readonly videoId = input.required<string>();
  /** Recipe title, for the player's accessible name. */
  readonly title = input.required<string>();
  /** Recipe photo, shown until the visitor starts the video. */
  readonly imageId = input<string | null | undefined>();

  private readonly sanitizer = inject(DomSanitizer);
  protected readonly playing = signal(false);
  protected readonly playerUrl = computed<SafeResourceUrl | null>(() => {
    const id = this.videoId();
    if (!this.playing() || !VIDEO_ID.test(id)) {
      return null;
    }
    // Trusted: the id is checked above, the rest of the URL is constant
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`,
    );
  });
}
