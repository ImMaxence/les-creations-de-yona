import { isBackOfficeUrl } from './links';

describe('isBackOfficeUrl', () => {
  it('knows the pages of the back-office, sign-in included', () => {
    expect(isBackOfficeUrl('/admin')).toBe(true);
    expect(isBackOfficeUrl('/admin/recettes?statut=DRAFT')).toBe(true);
    expect(isBackOfficeUrl('/admin/connexion')).toBe(true);
    expect(isBackOfficeUrl('/admin?retour=1')).toBe(true);
  });

  it('leaves a preview within the frame of the site', () => {
    expect(isBackOfficeUrl('/admin/apercu/12')).toBe(false);
  });

  it('leaves the pages of the site alone', () => {
    expect(isBackOfficeUrl('/')).toBe(false);
    expect(isBackOfficeUrl('/administration-de-la-tarte')).toBe(false);
    expect(isBackOfficeUrl('/recettes')).toBe(false);
  });
});
