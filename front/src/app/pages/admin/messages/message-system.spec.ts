import { describe, expect, it } from 'vitest';
import { systemLine } from './message-system';

const lea = { name: 'Léa', me: false };
const sam = { name: 'Sam', me: false };
const me = { name: 'Yona', me: true };

describe('systemLine', () => {
  it('says what another member changed', () => {
    expect(systemLine('CREATED', lea, 'Boutique')).toBe('Léa a créé le groupe « Boutique »');
    expect(systemLine('RENAMED', lea, 'Atelier')).toBe('Léa a renommé le groupe « Atelier »');
    expect(systemLine('PHOTO_CHANGED', lea)).toBe('Léa a changé la photo du groupe');
    expect(systemLine('PHOTO_REMOVED', lea)).toBe('Léa a retiré la photo du groupe');
    expect(systemLine('ADDED', lea, 'sam@site.fr', sam)).toBe('Léa a ajouté Sam');
    expect(systemLine('REMOVED', lea, 'sam@site.fr', sam)).toBe('Léa a retiré Sam');
    expect(systemLine('LEFT', sam)).toBe('Sam a quitté le groupe');
  });

  it('speaks to the one reading', () => {
    expect(systemLine('RENAMED', me, 'Atelier')).toBe('Vous avez renommé le groupe « Atelier »');
    expect(systemLine('ADDED', me, 'sam@site.fr', sam)).toBe('Vous avez ajouté Sam');
    expect(systemLine('ADDED', lea, 'yona@site.fr', me)).toBe('Léa vous a ajouté');
    expect(systemLine('REMOVED', lea, 'yona@site.fr', me)).toBe('Léa vous a retiré');
    expect(systemLine('LEFT', me)).toBe('Vous avez quitté le groupe');
  });

  it('tells a new version of the application, written by the site itself', () => {
    const site = { name: 'site', me: false };
    expect(systemLine('VERSION', site, '2.14.0')).toBe("Nouvelle version de l'application disponible : version 2.14.0");
  });

  it('names a member by their email when nothing better is known', () => {
    expect(systemLine('ADDED', lea, 'sam@site.fr')).toBe('Léa a ajouté sam@site.fr');
  });
});
