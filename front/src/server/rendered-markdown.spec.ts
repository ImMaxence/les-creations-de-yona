import { renderedToMarkdown } from './rendered-markdown';

const PAGE = `<!doctype html><html><head><title>Installer</title></head><body>
<header><a href="/">Les créations de Yona</a></header>
<main id="contenu" class="main"><yona-install><section class="container install">
  <img src="icons/icon.png" alt="">
  <p class="eyebrow enter">Application</p>
  <h1>Installer l'application</h1>
  <p class="install__lead">Ajoutez le site à votre <strong>écran d'accueil</strong>, lisez les
    <a href="/conditions-d-utilisation">conditions</a></p>
  <button type="button"><svg viewBox="0 0 24 24"><path d="M0 0"></path></svg>Télécharger l'application</button>
  <p hidden>Déjà installée</p>
  <div role="tablist">
    <button id="tab-ios" role="tab">iPhone et iPad</button>
    <button id="tab-android" role="tab">Android</button>
  </div>
  <div class="panel is-active" role="tabpanel" id="panel-ios" aria-labelledby="tab-ios">
    <ol><li>Ouvrez <strong>Safari</strong></li><li>Touchez <span class="key"><svg></svg></span> Partager</li></ol>
  </div>
  <div class="panel" role="tabpanel" id="panel-android" aria-labelledby="tab-android">
    <ol><li>Ouvrez <strong>Chrome</strong></li></ol>
    <p>Voir aussi <a href="#guide">plus haut</a></p>
  </div>
</section></yona-install></main>
<footer>© 2026</footer></body></html>`;

describe('renderedToMarkdown', () => {
  it('keeps the text of <main>, every tab panel under its name, and absolute links', () => {
    expect(renderedToMarkdown(PAGE, '/installer')).toBe(
      [
        "# Installer l'application",
        '',
        "Ajoutez le site à votre **écran d'accueil**, lisez les [conditions](https://les-creations-de-yona.fr/conditions-d-utilisation)",
        '',
        '### iPhone et iPad',
        '',
        '1.  Ouvrez **Safari**',
        '2.  Touchez Partager',
        '',
        '### Android',
        '',
        '1.  Ouvrez **Chrome**',
        '',
        'Voir aussi [plus haut](https://les-creations-de-yona.fr/installer#guide)',
        '',
      ].join('\n'),
    );
  });

  it('gives nothing for a page without main content', () => {
    expect(renderedToMarkdown('<html><body><p>Erreur</p></body></html>', '/installer')).toBeNull();
    expect(renderedToMarkdown('<main> <button>Ok</button> </main>', '/installer')).toBeNull();
  });
});
