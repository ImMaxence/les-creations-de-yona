import { TestBed } from '@angular/core/testing';
import AdminChangelog, { versionsOf } from './admin-changelog';

describe('versionsOf', () => {
  it('leaves out the introduction, from the first version on', () => {
    expect(versionsOf('# Changelog\r\n\r\nIntro [ReadMe](ReadMe.md).\r\n\r\n## 3.2.0 - 2026-10-27\r\n\r\n- Ajouté')).toBe(
      '## 3.2.0 - 2026-10-27\n\n- Ajouté',
    );
  });
});

describe('AdminChangelog', () => {
  it('shows every version of the CHANGELOG, the latest first', async () => {
    const fixture = TestBed.createComponent(AdminChangelog);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const versions = [...element.querySelectorAll('.changelog h2')].map((heading) => heading.textContent);
    expect(versions[0]).toMatch(/^3\.2\.0 - /);
    expect(versions).toContain('3.1.0 - 2026-10-26');
    expect(element.querySelector('.changelog')?.textContent).not.toContain('# Changelog');
    expect(element.querySelectorAll('.changelog h3').length).toBeGreaterThan(0);
  });
});
