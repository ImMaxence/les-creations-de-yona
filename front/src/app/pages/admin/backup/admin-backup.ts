import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LucideDownload } from '@lucide/angular';
import { Button } from '../../../shared/ui/button/button';

/** The download is a plain link: HttpClient would hold the whole archive in memory. */
@Component({
  selector: 'yona-admin-backup',
  imports: [Button, LucideDownload],
  template: `
    <section class="admin-section" aria-labelledby="backup-title">
      <div class="admin-section__head">
        <h2 id="backup-title">Sauvegarde</h2>
      </div>
      <div class="admin-panel">
        <p>
          Télécharge une archive ZIP avec toute la base de données (recettes, catégories,
          ingrédients, réseaux sociaux) et toutes les photos. Gardez-la en lieu sûr, hors du serveur :
          sur votre ordinateur, un disque externe ou un stockage en ligne.
        </p>
        <p class="field__hint">
          La préparation commence aussitôt : le téléchargement peut durer quelques minutes selon le
          nombre de photos. Pensez à en faire une régulièrement, par exemple une fois par mois.
        </p>
        <div>
          <a yonaButton href="/api/admin/backup" download>
            <svg lucideDownload></svg>
            Sauvegarder mes données
          </a>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminBackup {}
