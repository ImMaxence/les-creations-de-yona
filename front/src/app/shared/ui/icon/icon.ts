import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ICONS, IconName, IconNode } from './icons';

/**
 * An icon of the site, drawn inline: `<svg yonaIcon="heart" [size]="18"></svg>`. Lucide's
 * drawings (24 × 24, stroked with the text color), limited to the icons the site uses
 * (icons.ts). Decorative: the button or link around it carries the label.
 */
@Component({
  selector: 'svg[yonaIcon]',
  template: `
    @for (node of nodes(); track $index) {
      @let attrs = node[1];
      @switch (node[0]) {
        @case ('path') {
          <svg:path [attr.d]="attrs['d']" />
        }
        @case ('circle') {
          <svg:circle [attr.cx]="attrs['cx']" [attr.cy]="attrs['cy']" [attr.r]="attrs['r']" />
        }
        @case ('rect') {
          <svg:rect
            [attr.x]="attrs['x']"
            [attr.y]="attrs['y']"
            [attr.width]="attrs['width']"
            [attr.height]="attrs['height']"
            [attr.rx]="attrs['rx']"
            [attr.ry]="attrs['ry']"
          />
        }
        @case ('line') {
          <svg:line [attr.x1]="attrs['x1']" [attr.y1]="attrs['y1']" [attr.x2]="attrs['x2']" [attr.y2]="attrs['y2']" />
        }
        @case ('polyline') {
          <svg:polyline [attr.points]="attrs['points']" />
        }
        @case ('polygon') {
          <svg:polygon [attr.points]="attrs['points']" />
        }
        @case ('ellipse') {
          <svg:ellipse [attr.cx]="attrs['cx']" [attr.cy]="attrs['cy']" [attr.rx]="attrs['rx']" [attr.ry]="attrs['ry']" />
        }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    stroke: 'currentColor',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
    '[attr.width]': 'size()',
    '[attr.height]': 'size()',
    '[attr.stroke-width]': 'strokeWidth()',
    '[attr.fill]': 'fill()',
  },
})
export class Icon {
  readonly yonaIcon = input.required<IconName>();
  readonly size = input(24);
  readonly strokeWidth = input(2);
  /** "currentColor" for a filled drawing (full star). */
  readonly fill = input('none');

  protected readonly nodes = computed<readonly IconNode[]>(() => ICONS[this.yonaIcon()]);
}
