import { ChangeDetectionStrategy, Component, ViewEncapsulation, signal } from '@angular/core';
// The CHANGELOG of the repository, bundled as text at build time (only in this lazy page)
import changelog from '../../../../../../CHANGELOG.md';
import { FRONT_VERSION } from '../../../core/version';
import { MarkdownPipe } from '../../../shared/format/markdown.pipe';
import { Icon } from '../../../shared/ui/icon/icon';

/** A version of the CHANGELOG: "## 3.2.0 - 2026-10-27" and what follows, up to the next one. */
export interface ChangelogVersion {
  version: string;
  /** "27 octobre 2026", or null when the heading gives no date. */
  date: string | null;
  markdown: string;
}

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * "Nouveautés": the CHANGELOG, read only, so that the admins see what each version changed. One
 * fold per version, the latest open; a version's text is only rendered once opened, however long
 * the CHANGELOG grows. Its introduction (for developers) is left out.
 */
@Component({
  selector: 'yona-admin-changelog',
  imports: [Icon, MarkdownPipe],
  template: `
    <section class="admin-section" aria-labelledby="changelog-title">
      <div class="admin-section__head">
        <h2 id="changelog-title">Nouveautés</h2>
      </div>
      <p class="field__hint">
        Ce qui a changé sur le site à chaque version, la plus récente en premier. Version en ligne : {{ version }}
      </p>
      <div class="changelog">
        @for (entry of versions; track entry.version; let i = $index) {
          <details class="changelog__version" [open]="opened().has(i)" (toggle)="onToggle(i, $event)">
            <summary class="changelog__summary">
              <span class="changelog__title">Version {{ entry.version }}</span>
              @if (i === 0) {
                <span class="chip changelog__latest">En ligne</span>
              }
              @if (entry.date) {
                <span class="changelog__date">{{ entry.date }}</span>
              }
              <svg yonaIcon="chevron-down" class="changelog__chevron" [size]="18"></svg>
            </summary>
            @if (opened().has(i)) {
              <div class="prose changelog__body" [innerHTML]="entry.markdown | markdown"></div>
            }
          </details>
        }
      </div>
    </section>
  `,
  styleUrl: './admin-changelog.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminChangelog {
  protected readonly version = FRONT_VERSION;
  protected readonly versions = versionsOf(changelog);
  /** The latest version open on arrival. */
  protected readonly opened = signal<ReadonlySet<number>>(new Set([0]));

  protected onToggle(index: number, event: Event): void {
    const open = (event.target as HTMLDetailsElement).open;
    this.opened.update((opened) => {
      const next = new Set(opened);
      if (open) {
        next.add(index);
      } else {
        next.delete(index);
      }
      return next;
    });
  }
}

/** The versions, the latest first as written; the introduction before the first one left out. */
export function versionsOf(markdown: string): ChangelogVersion[] {
  return markdown
    .replace(/\r\n/g, '\n')
    .split(/^## /m)
    .slice(1)
    .map((section) => {
      const newline = section.indexOf('\n');
      const heading = (newline < 0 ? section : section.slice(0, newline)).trim();
      const [, version, isoDate] = /^(\S+)(?:\s+-\s+(\d{4}-\d{2}-\d{2}))?/.exec(heading) ?? [, heading];
      return {
        version: version ?? heading,
        date: isoDate ? DATE.format(new Date(`${isoDate}T00:00:00Z`)) : null,
        markdown: newline < 0 ? '' : section.slice(newline + 1).trim(),
      };
    });
}
