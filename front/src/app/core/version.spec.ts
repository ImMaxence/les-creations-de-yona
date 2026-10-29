import { isNewerThanFront } from './version';

describe('isNewerThanFront', () => {
  it('says when the backend runs a newer version than the page', () => {
    expect(isNewerThanFront('1.14.0', '1.13.2')).toBe(true);
    expect(isNewerThanFront('2.0.0', '1.99.9')).toBe(true);
    expect(isNewerThanFront('1.13.10', '1.13.9')).toBe(true);
  });

  it('stays quiet for the same version, an older backend (deployment in progress) or no version', () => {
    expect(isNewerThanFront('1.14.0', '1.14.0')).toBe(false);
    expect(isNewerThanFront('1.13.0', '1.14.0')).toBe(false);
    expect(isNewerThanFront('dev', '1.14.0')).toBe(false);
    expect(isNewerThanFront(null, '1.14.0')).toBe(false);
  });
});
