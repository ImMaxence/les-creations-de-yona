import { TestBed } from '@angular/core/testing';
import { FRONT_VERSION } from '../../../core/version';
import { AdminWatch } from '../layout/admin-watch';
import AdminChangelog, { REPOSITORY_URL, changesOf, groupsOf, onGitHub, versionsOf } from './admin-changelog';

const CHANGELOG = [
  '# Changelog',
  '',
  'Intro.',
  '',
  '## 2.1.0 - 2026-11-03',
  '',
  'Front and backend 2.1.0. No database migration.',
  '',
  '### Added',
  '',
  '- **Shop**: products with a `format`.',
  '- A plain line, [see ia.md](docs/ia.md).',
  '',
  '### Removed',
  '',
  '- **Mes observations**: gone.',
  '',
  '## 2.0.0 - 2026-11-01',
  '',
  '### Fixed',
  '',
  '- Something',
  '',
  '## 1.22.0 - 2026-10-30',
  '',
  '### Technical',
  '',
  '- A migration',
  '  that goes on the next line',
  '',
  '## 1.1.0',
  '',
  '- Before the kinds',
].join('\r\n');

describe('versionsOf', () => {
  const versions = versionsOf(CHANGELOG);

  it('cuts the CHANGELOG into versions, without its introduction', () => {
    expect(versions.map((version) => [version.version, version.major, version.date])).toEqual([
      ['2.1.0', 2, '3 novembre 2026'],
      ['2.0.0', 2, '1er novembre 2026'],
      ['1.22.0', 1, '30 octobre 2026'],
      ['1.1.0', 1, null],
    ]);
  });

  it('keeps the sentence under the heading apart', () => {
    expect(versions[0]!.summary).toBe('Front and backend 2.1.0. No database migration.');
    expect(versions[1]!.summary).toBe('');
  });

  it('gives each change its kind, and its title apart from the rest', () => {
    expect(versions[0]!.changes).toEqual([
      { kind: 'added', title: 'Shop', text: 'products with a <code>format</code>.' },
      { kind: 'added', title: null, text: `A plain line, <a href="${REPOSITORY_URL}/blob/main/docs/ia.md">see ia.md</a>.` },
      { kind: 'removed', title: 'Mes observations', text: 'gone.' },
    ]);
  });

  it('joins a line that goes on, and files a line before any kind as other', () => {
    expect(versions[2]!.changes).toEqual([{ kind: 'technical', title: null, text: 'A migration that goes on the next line' }]);
    expect(versions[3]!.changes).toEqual([{ kind: 'other', title: null, text: 'Before the kinds' }]);
  });
});

describe('changesOf', () => {
  it('knows the kinds of the CHANGELOG, whatever their case, and files the others as other', () => {
    const kinds = changesOf('### added\n- a\n### CHANGED\n- b\n### Fixed\n- c\n### Technical\n- d\n### Security\n- e').changes.map(
      (change) => change.kind,
    );
    expect(kinds).toEqual(['added', 'changed', 'fixed', 'technical', 'other']);
  });

  it('reads the French headings of the CHANGELOG, and a title followed by « : »', () => {
    const { changes } = changesOf(
      ['### Ajouté', '- **Boutique** : ouverte', '### Modifié', '- b', '### Corrigé', '- c', '### Retiré', '- d', '### Technique', '- e'].join('\n'),
    );

    expect(changes.map((change) => change.kind)).toEqual(['added', 'changed', 'fixed', 'removed', 'technical']);
    expect(changes[0]).toEqual({ kind: 'added', title: 'Boutique', text: 'ouverte' });
  });

  it('reads a title written with its colon inside the bold', () => {
    expect(changesOf('### Added\n- **Shop:** open').changes[0]).toEqual({ kind: 'added', title: 'Shop', text: 'open' });
  });
});

describe('groupsOf', () => {
  it('puts the versions under their major one, the latest first, with their dates', () => {
    const groups = groupsOf(versionsOf(CHANGELOG));

    expect(groups.map((group) => [group.major, group.versions.map((version) => version.version), group.from, group.to])).toEqual([
      [2, ['2.1.0', '2.0.0'], '1er novembre 2026', '3 novembre 2026'],
      [1, ['1.22.0', '1.1.0'], '30 octobre 2026', '30 octobre 2026'],
    ]);
  });
});

describe('onGitHub', () => {
  it('leads the links to files of the repository to GitHub', () => {
    expect(onGitHub('See [ia.md](docs/ia.md) and [the site](https://les-creations-de-yona.fr).')).toBe(
      `See [ia.md](${REPOSITORY_URL}/blob/main/docs/ia.md) and [the site](https://les-creations-de-yona.fr).`,
    );
    expect(onGitHub('[top](#versions), [readme](./ReadMe.md)')).toBe(`[top](#versions), [readme](${REPOSITORY_URL}/blob/main/ReadMe.md)`);
  });
});

describe('AdminChangelog', () => {
  beforeEach(() => {
    // Opening the page marks it read: nothing to ask the backend here
    TestBed.configureTestingModule({ providers: [{ provide: AdminWatch, useValue: { changelogRead: () => Promise.resolve() } }] });
  });

  it('shows Version 2 then Version 1, opens the latest version, and builds another one only once opened', async () => {
    const fixture = TestBed.createComponent(AdminChangelog);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;

    expect([...element.querySelectorAll('.changelog__major')].map((heading) => heading.textContent)).toEqual(['Version 2', 'Version 1']);
    const folds = [...element.querySelectorAll<HTMLDetailsElement>('.changelog__version')];
    expect(folds.length).toBeGreaterThan(1);
    // The CHANGELOG begins with the version of package.json: written at each release
    expect(folds[0]!.querySelector('.changelog__title')?.textContent).toBe(`Version ${FRONT_VERSION}`);
    expect(folds[0]!.open).toBe(true);
    expect(folds[0]!.querySelectorAll('.changes tbody tr').length).toBeGreaterThan(0);
    expect(folds[0]!.querySelector('.changes .pill')?.textContent).toMatch(/Ajouté|Modifié|Corrigé|Retiré|Technique/);
    expect(folds[1]!.open).toBe(false);
    expect(folds[1]!.querySelector('.changes')).toBeNull();

    folds[1]!.open = true;
    folds[1]!.dispatchEvent(new Event('toggle'));
    await fixture.whenStable();
    expect(folds[1]!.querySelector('.changes')).not.toBeNull();
  });
});
