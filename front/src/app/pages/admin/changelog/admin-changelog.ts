import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
// The CHANGELOG of the repository, bundled as text at build time (only in this lazy page)
import changelog from '../../../../../../CHANGELOG.md';
import { MarkdownPipe } from '../../../shared/format/markdown.pipe';
import { FRONT_VERSION } from '../../../core/version';

/**
 * "Nouveautés": the CHANGELOG, read only, so that the admins see what each version changed. Its
 * introduction (for developers, with links to the repository) is left out: from the first version on.
 */
@Component({
  selector: 'yona-admin-changelog',
  imports: [MarkdownPipe],
  template: `
    <section class="admin-section" aria-labelledby="changelog-title">
      <div class="admin-section__head">
        <h2 id="changelog-title">Nouveautés</h2>
      </div>
      <p class="field__hint">
        Ce qui a changé sur le site à chaque version, la plus récente en premier. Version en ligne : {{ version }}.
      </p>
      <div class="prose changelog" [innerHTML]="versions | markdown"></div>
    </section>
  `,
  styleUrl: './admin-changelog.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminChangelog {
  protected readonly version = FRONT_VERSION;
  protected readonly versions = versionsOf(changelog);
}

/** From the first "## 3.2.0 - …" heading on. */
export function versionsOf(markdown: string): string {
  const text = markdown.replace(/\r\n/g, '\n');
  const first = text.search(/^## /m);
  return first < 0 ? text : text.slice(first);
}
