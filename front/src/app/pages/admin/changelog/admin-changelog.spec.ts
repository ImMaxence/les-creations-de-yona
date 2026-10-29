import { TestBed } from '@angular/core/testing';
import { FRONT_VERSION } from '../../../core/version';
import AdminChangelog, { REPOSITORY_URL, onGitHub, versionsOf } from './admin-changelog';

describe('versionsOf', () => {
  it('cuts the CHANGELOG into versions, without its introduction', () => {
    const markdown = '# Changelog\r\n\r\nIntro.\r\n\r\n## 1.2.0 - 2026-10-27\r\n\r\n- Ajouté\r\n\r\n## 1.1.0\r\n\r\n- Avant';
    expect(versionsOf(markdown)).toEqual([
      { version: '1.2.0', date: '27 octobre 2026', markdown: '- Ajouté' },
      { version: '1.1.0', date: null, markdown: '- Avant' },
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
  it('opens the latest version, and renders another one only once opened', async () => {
    const fixture = TestBed.createComponent(AdminChangelog);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const folds = [...element.querySelectorAll<HTMLDetailsElement>('.changelog__version')];

    expect(folds.length).toBeGreaterThan(1);
    // The CHANGELOG begins with the version of package.json: written at each release
    expect(folds[0].querySelector('.changelog__title')?.textContent).toBe(`Version ${FRONT_VERSION}`);
    expect(folds[0].open).toBe(true);
    expect(folds[0].querySelector('.changelog__body h3')).not.toBeNull();
    expect(folds[1].open).toBe(false);
    expect(folds[1].querySelector('.changelog__body')).toBeNull();

    folds[1].open = true;
    folds[1].dispatchEvent(new Event('toggle'));
    await fixture.whenStable();
    expect(folds[1].querySelector('.changelog__body')).not.toBeNull();
  });
});
