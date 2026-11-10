import { ChangeDetectionStrategy, Component, ViewEncapsulation, signal } from '@angular/core';
import { marked } from 'marked';
// The CHANGELOG of the repository, bundled as text at build time (only in this lazy page)
import changelog from '../../../../../../CHANGELOG.md';
import { FRONT_VERSION } from '../../../core/version';
import { firstOfMonth } from '../../../shared/format/paris-time';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';

/** "### Ajouté", "### Modifié"… of the CHANGELOG (in English until 2.5.0); "other" for a heading it does not know. */
export type ChangeKind = 'added' | 'changed' | 'fixed' | 'removed' | 'technical' | 'other';

/** A line of a version: its kind, its bold title when it has one, the rest; both as inline HTML. */
export interface ChangelogChange {
  kind: ChangeKind;
  title: string | null;
  text: string;
}

/** A version of the CHANGELOG: "## 1.2.0 - 2026-10-27" and what follows, up to the next one. */
export interface ChangelogVersion {
  version: string;
  /** 2 for "2.4.0". */
  major: number;
  /** "27 octobre 2026", or null when the heading gives no date. */
  date: string | null;
  /** The sentence under the heading: "Front and backend 2.4.0. Database migration: V21". */
  summary: string;
  changes: ChangelogChange[];
}

/** The versions of a major one: "Version 2", the latest first. */
export interface ChangelogGroup {
  major: number;
  versions: ChangelogVersion[];
  /** Dates of its first and latest versions. */
  from: string | null;
  to: string | null;
}

/** The pill of each kind: its name in the back-office, its colours in admin-changelog.scss. */
export const CHANGE_KINDS: Record<ChangeKind, string> = {
  added: 'Ajouté',
  changed: 'Modifié',
  fixed: 'Corrigé',
  removed: 'Retiré',
  technical: 'Technique',
  other: 'Autre',
};

const HEADINGS: Record<string, ChangeKind> = {
  ajouté: 'added',
  modifié: 'changed',
  corrigé: 'fixed',
  retiré: 'removed',
  technique: 'technical',
  added: 'added',
  changed: 'changed',
  fixed: 'fixed',
  removed: 'removed',
  technical: 'technical',
};

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** The code of the site, where the CHANGELOG's links to files of the repository lead. */
export const REPOSITORY_URL = 'https://github.com/ImMaxence/les-creations-de-yona';

/** Coolify, which builds and runs the site on the server: deployments, logs, settings. */
export const COOLIFY_URL = 'https://coolify.nailsbyanastasie.fr/';

/**
 * "Nouveautés": the CHANGELOG, read only, so that the admins see what each version changed. The
 * versions under their major one (Version 2, then Version 1), one fold per version, the latest
 * open; in each, a table of its changes, a coloured pill for their kind (Ajouté, Modifié, Corrigé,
 * Retiré, Technique). A version's table is only built once opened. Links to the code (GitHub) and
 * to the server (Coolify) at the top; a link of the CHANGELOG to a file of the repository leads to
 * it on GitHub, not to a page of the site.
 */
@Component({
  selector: 'yona-admin-changelog',
  imports: [Button, Icon],
  template: `
    <section class="admin-section" aria-labelledby="changelog-title">
      <div class="admin-section__head">
        <h2 id="changelog-title">Nouveautés</h2>
        <div class="admin-section__actions">
          <a yonaButton variant="secondary" [href]="repositoryUrl" target="_blank" rel="noopener noreferrer">
            <svg yonaIcon="github"></svg>GitHub
          </a>
          <a yonaButton variant="secondary" [href]="coolifyUrl" target="_blank" rel="noopener noreferrer">
            <svg yonaIcon="server"></svg>Coolify
          </a>
        </div>
      </div>
      <p class="field__hint">
        Ce qui a changé sur le site à chaque version, la plus récente en premier. Version en ligne : {{ version }}
      </p>
      <ul role="list" class="changelog__legend" aria-label="Types de changement">
        @for (kind of legend; track kind) {
          <li><span class="pill pill--{{ kind }}">{{ kinds[kind] }}</span></li>
        }
      </ul>

      @for (group of groups; track group.major) {
        <section class="changelog__group" [attr.aria-labelledby]="'major-' + group.major">
          <header class="changelog__group-head">
            <h3 class="changelog__major" [id]="'major-' + group.major">Version {{ group.major }}</h3>
            <p class="changelog__span">
              {{ group.versions.length }} version{{ group.versions.length > 1 ? 's' : '' }}
              @if (group.from && group.to) {
                · {{ group.from === group.to ? group.to : group.from + ' – ' + group.to }}
              }
            </p>
          </header>

          <div class="changelog">
            @for (entry of group.versions; track entry.version) {
              <details class="changelog__version" [open]="opened().has(entry.version)" (toggle)="onToggle(entry.version, $event)">
                <summary class="changelog__summary">
                  <span class="changelog__title">Version {{ entry.version }}</span>
                  @if (entry.version === latest) {
                    <span class="chip changelog__latest">En ligne</span>
                  }
                  @if (entry.date) {
                    <span class="changelog__date">{{ entry.date }}</span>
                  }
                  <span class="changelog__count">{{ entry.changes.length }} changement{{ entry.changes.length > 1 ? 's' : '' }}</span>
                  <svg yonaIcon="chevron-down" class="changelog__chevron" [size]="18"></svg>
                </summary>
                @if (opened().has(entry.version)) {
                  <div class="changelog__body">
                    @if (entry.summary) {
                      <p class="changelog__intro" [innerHTML]="entry.summary"></p>
                    }
                    <table class="changes">
                      <caption class="visually-hidden">Changements de la version {{ entry.version }}</caption>
                      <thead>
                        <tr>
                          <th scope="col" class="changes__kind">Type</th>
                          <th scope="col">Changement</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (change of entry.changes; track $index) {
                          <tr>
                            <td class="changes__kind"><span class="pill pill--{{ change.kind }}">{{ kinds[change.kind] }}</span></td>
                            <td class="changes__text">
                              @if (change.title) {
                                <strong class="changes__title" [innerHTML]="change.title"></strong>
                              }
                              <span [innerHTML]="change.text"></span>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              </details>
            }
          </div>
        </section>
      }
    </section>
  `,
  styleUrl: './admin-changelog.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminChangelog {
  protected readonly version = FRONT_VERSION;
  protected readonly repositoryUrl = REPOSITORY_URL;
  protected readonly coolifyUrl = COOLIFY_URL;
  protected readonly kinds = CHANGE_KINDS;
  protected readonly legend: ChangeKind[] = ['added', 'changed', 'fixed', 'removed', 'technical'];
  private readonly versions = versionsOf(changelog);
  protected readonly groups = groupsOf(this.versions);
  protected readonly latest = this.versions[0]?.version;
  /** The latest version open on arrival. */
  protected readonly opened = signal<ReadonlySet<string>>(new Set(this.latest ? [this.latest] : []));

  protected onToggle(version: string, event: Event): void {
    const open = (event.target as HTMLDetailsElement).open;
    this.opened.update((opened) => {
      const next = new Set(opened);
      if (open) {
        next.add(version);
      } else {
        next.delete(version);
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
      const name = version ?? heading;
      return {
        version: name,
        major: Number.parseInt(name, 10) || 0,
        date: isoDate ? firstOfMonth(DATE.format(new Date(`${isoDate}T00:00:00Z`))) : null,
        ...changesOf(newline < 0 ? '' : section.slice(newline + 1)),
      };
    });
}

/**
 * The text of a version: the sentence before its first "###", then each "- " line under the kind
 * of the "###" above it. A line "**Title**: text" gives its title apart. Inline Markdown (code,
 * links, bold) turned into HTML, shown through [innerHTML] and Angular's sanitizer.
 */
export function changesOf(body: string): Pick<ChangelogVersion, 'summary' | 'changes'> {
  const summary: string[] = [];
  const changes: { kind: ChangeKind; markdown: string }[] = [];
  let kind: ChangeKind | null = null;
  for (const line of body.split('\n')) {
    const heading = /^###\s+(.+)$/.exec(line);
    if (heading) {
      kind = HEADINGS[heading[1]!.trim().toLowerCase()] ?? 'other';
    } else if (/^[-*]\s+/.test(line)) {
      changes.push({ kind: kind ?? 'other', markdown: line.replace(/^[-*]\s+/, '') });
    } else if (line.trim() && /^\s/.test(line) && changes.length) {
      // A line that goes on the line above
      changes.at(-1)!.markdown += ` ${line.trim()}`;
    } else if (line.trim() && kind === null) {
      summary.push(line.trim());
    } else if (line.trim()) {
      changes.push({ kind: kind ?? 'other', markdown: line.trim() });
    }
  }
  return {
    summary: summary.length ? inline(summary.join(' ')) : '',
    changes: changes.map(({ kind: changeKind, markdown }) => {
      // "**Title**: text" (English, until 2.5.0), "**Titre** : texte" (French)
      const titled = /^\*\*(.+?):?\*\*\s*:?\s*(.*)$/.exec(markdown);
      return titled
        ? { kind: changeKind, title: inline(titled[1]!), text: inline(titled[2]!) }
        : { kind: changeKind, title: null, text: inline(markdown) };
    }),
  };
}

/** The versions under their major one, the latest major first. */
export function groupsOf(versions: readonly ChangelogVersion[]): ChangelogGroup[] {
  const groups = new Map<number, ChangelogVersion[]>();
  for (const version of versions) {
    groups.set(version.major, [...(groups.get(version.major) ?? []), version]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b - a)
    .map(([major, list]) => ({
      major,
      versions: list,
      from: [...list].reverse().find((version) => version.date)?.date ?? null,
      to: list.find((version) => version.date)?.date ?? null,
    }));
}

function inline(markdown: string): string {
  return marked.parseInline(onGitHub(markdown), { async: false, gfm: true });
}

/**
 * "[ia.md](docs/ia.md)" leads to the file on GitHub: written for the repository, a relative link
 * would open a page of the site that does not exist. Full addresses and anchors stay as they are.
 */
export function onGitHub(markdown: string): string {
  return markdown.replace(/\]\((?!https?:|mailto:|#)\.?\/?([^)\s]+)\)/g, (_link, path: string) => `](${REPOSITORY_URL}/blob/main/${path})`);
}
