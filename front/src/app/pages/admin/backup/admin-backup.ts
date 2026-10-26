import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import {
  LucideCircleCheck,
  LucideDatabaseZap,
  LucideDownload,
  LucideLoaderCircle,
  LucideTriangleAlert,
  LucideUpload,
} from '@lucide/angular';
import { Api } from '../../../core/api/generated/api';
import { attempt } from '../../../core/api/attempt';
import { ImageUploads } from '../../../core/api/image-uploads';
import { applyRestore } from '../../../core/api/generated/fn/admin-restore/apply-restore';
import { cancelRestore } from '../../../core/api/generated/fn/admin-restore/cancel-restore';
import { getRestore } from '../../../core/api/generated/fn/admin-restore/get-restore';
import { startRestore } from '../../../core/api/generated/fn/admin-restore/start-restore';
import { uploadRestoreChunk } from '../../../core/api/generated/fn/admin-restore/upload-restore-chunk';
import { Counts } from '../../../core/api/generated/models/counts';
import { Report } from '../../../core/api/generated/models/report';
import { RestoreStatus } from '../../../core/api/generated/models/restore-status';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { SiteData } from '../../../core/site/site-data';
import { SiteTheme } from '../../../core/theme/site-theme';
import { ParisDatePipe } from '../../../shared/format/paris-date.pipe';
import { formatBytes } from '../../../shared/format/units';
import { Button } from '../../../shared/ui/button/button';

/** Same size as the server expects (RestoreService.CHUNK_BYTES): under Cloudflare's 100 MB per request. */
const CHUNK_BYTES = 32 * 1024 * 1024;
const POLL_MS = 1500;
/** The restore in progress survives a reload of the page. */
const STORAGE_KEY = 'yona-restore-id';
const REPLACE_WORD = 'REMPLACER';

/** Rows of the comparison table, in the order shown. */
const COUNT_ROWS: { key: keyof Counts; label: string }[] = [
  { key: 'recipes', label: 'Recettes' },
  { key: 'categories', label: 'Catégories' },
  { key: 'tags', label: 'Tags' },
  { key: 'ingredients', label: 'Ingrédients' },
  { key: 'images', label: 'Photos' },
  { key: 'socialLinks', label: 'Réseaux sociaux' },
  { key: 'appearancePresets', label: "Préréglages d'apparence" },
];

/**
 * "Sauvegarder mes données" downloads the archive (a plain link: HttpClient would hold it all in
 * memory). "Restaurer une sauvegarde" sends an archive back: in chunks, then the server analyses
 * it and shows what it holds compared with the site. "Ajouter ce qui manque" adds only what the
 * site lacks; "Tout remplacer", tucked away behind warnings and the word REMPLACER, puts the
 * archive in place of everything.
 */
@Component({
  selector: 'yona-admin-backup',
  imports: [
    Button,
    ParisDatePipe,
    LucideCircleCheck,
    LucideDatabaseZap,
    LucideDownload,
    LucideLoaderCircle,
    LucideTriangleAlert,
    LucideUpload,
  ],
  templateUrl: './admin-backup.html',
  styleUrl: './admin-backup.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminBackup {
  private readonly api = inject(Api);
  private readonly uploads = inject(ImageUploads);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);
  private readonly siteData = inject(SiteData);
  private readonly siteTheme = inject(SiteTheme);

  protected readonly status = signal<RestoreStatus | null>(null);
  protected readonly fileName = signal<string | null>(null);
  /** Share of the archive sent, from 0 to 1, while uploading from this page. */
  protected readonly sent = signal<number | null>(null);
  protected readonly dragging = signal(false);
  protected readonly replaceWord = signal('');
  protected readonly understood = signal(false);
  protected readonly busy = signal(false);

  protected readonly countRows = COUNT_ROWS;
  protected readonly formatBytes = formatBytes;
  protected readonly replaceWordExpected = REPLACE_WORD;
  protected readonly analysis = computed(() => this.status()?.analysis ?? null);
  protected readonly nothingToMerge = computed(() => {
    const missing = this.analysis()?.missing;
    return (
      !!missing &&
      missing.recipes + missing.categories + missing.tags + missing.ingredients + missing.images + missing.socialLinks +
        missing.appearancePresets ===
        0 &&
      this.analysis()!.imageFilesMissing === 0
    );
  });
  protected readonly canReplace = computed(
    () => this.understood() && this.replaceWord().trim() === REPLACE_WORD && !this.busy(),
  );

  private timer: ReturnType<typeof setTimeout> | undefined;
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      clearTimeout(this.timer);
    });
    const id = readStoredId();
    if (id) {
      void this.refresh(id);
    }
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) {
      void this.upload(file);
    }
  }

  protected onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      void this.upload(file);
    }
  }

  protected async merge(): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Ajouter ce qui manque ?',
      message:
        "Les recettes, catégories, photos… de la sauvegarde absentes du site y seront ajoutées. Rien de ce qui est en ligne ne sera modifié ni supprimé.",
      confirmLabel: 'Ajouter',
    });
    if (confirmed) {
      await this.apply('MERGE');
    }
  }

  protected async replace(): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Remplacer toutes les données ?',
      message:
        "Dernière vérification : toutes les recettes, catégories, photos et réglages actuels du site seront supprimés et remplacés par ceux de la sauvegarde. C'est définitif.",
      confirmLabel: 'Tout remplacer',
    });
    if (confirmed) {
      await this.apply('REPLACE');
    }
  }

  /** Deletes the archive from the server and starts over. */
  protected async reset(): Promise<void> {
    const status = this.status();
    if (status) {
      await attempt(this.api.invoke(cancelRestore, { id: status.id }));
    }
    this.clear();
  }

  protected label(state: RestoreStatus['state']): string {
    return {
      UPLOADING: 'Envoi de la sauvegarde…',
      ANALYZING: 'Analyse de la sauvegarde…',
      READY: 'Sauvegarde analysée',
      APPLYING: 'Restauration en cours…',
      DONE: 'Restauration terminée',
      FAILED: 'Restauration impossible',
    }[state];
  }

  protected filesLine(report: Report): string {
    const sent = this.plural(report.filesUploaded, 'fichier photo envoyé', 'fichiers photo envoyés') + ' au stockage';
    return report.mode === 'REPLACE'
      ? `${sent}, ${this.plural(report.filesDeleted, 'supprimé', 'supprimés')}.`
      : `${sent}.`;
  }

  protected plural(count: number, one: string, many: string): string {
    return `${count} ${count > 1 ? many : one}`;
  }

  private async upload(file: File): Promise<void> {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      this.toaster.error('Choisissez le fichier .zip téléchargé avec « Sauvegarder mes données ».');
      return;
    }
    const previous = this.status();
    if (previous && previous.state !== 'DONE' && previous.state !== 'FAILED') {
      await attempt(this.api.invoke(cancelRestore, { id: previous.id }));
    }
    this.clear();
    this.fileName.set(file.name);
    const started = await attempt(this.api.invoke(startRestore, { body: { size: file.size } }));
    if (!started.ok) {
      this.fileName.set(null);
      return;
    }
    this.show(started.value);
    this.sent.set(0);
    let status = started.value;
    try {
      for (let index = 0; index * CHUNK_BYTES < file.size; index++) {
        const start = index * CHUNK_BYTES;
        const chunk = file.slice(start, Math.min(file.size, start + CHUNK_BYTES));
        status = await this.uploads.sendBytes<RestoreStatus>(
          uploadRestoreChunk.PATH.replace('{id}', status.id).replace('{index}', String(index)),
          chunk,
          (share) => this.sent.set((start + share * chunk.size) / file.size),
        );
        this.show(status);
      }
    } catch {
      // Already shown as a toast; the server marks the restore as failed
      await this.refresh(status.id);
      return;
    } finally {
      this.sent.set(null);
    }
    this.poll(status.id);
  }

  private async apply(mode: 'MERGE' | 'REPLACE'): Promise<void> {
    const status = this.status();
    if (!status) {
      return;
    }
    this.busy.set(true);
    const applied = await attempt(
      this.api.invoke(applyRestore, {
        id: status.id,
        body: { mode, confirmation: mode === 'REPLACE' ? this.replaceWord().trim() : undefined },
      }),
    );
    this.busy.set(false);
    if (applied.ok) {
      this.show(applied.value);
      this.poll(status.id);
    }
  }

  private async refresh(id: string): Promise<void> {
    try {
      const status = await this.api.invoke(getRestore, { id });
      this.show(status);
      if (status.state === 'ANALYZING' || status.state === 'APPLYING') {
        this.poll(id);
      }
    } catch {
      // Expired or unknown: nothing to resume
      this.clear();
    }
  }

  /** While the server works; the restored data is then reloaded for the whole site. */
  private poll(id: string): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(async () => {
      if (this.destroyed) {
        return;
      }
      const before = this.status()?.state;
      await this.refresh(id);
      const after = this.status()?.state;
      if (before === 'APPLYING' && after === 'DONE') {
        await Promise.all([this.siteData.load(), this.siteTheme.load()]);
        this.toaster.success('Restauration terminée.');
      } else if (after === 'FAILED' && before !== 'FAILED') {
        this.toaster.error(this.status()?.error ?? 'La restauration a échoué.');
      }
    }, POLL_MS);
  }

  private show(status: RestoreStatus): void {
    this.status.set(status);
    writeStoredId(status.state === 'DONE' || status.state === 'FAILED' ? null : status.id);
  }

  private clear(): void {
    clearTimeout(this.timer);
    this.status.set(null);
    this.fileName.set(null);
    this.replaceWord.set('');
    this.understood.set(false);
    writeStoredId(null);
  }
}

function readStoredId(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredId(id: string | null): void {
  try {
    if (id) {
      sessionStorage.setItem(STORAGE_KEY, id);
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage blocked: the restore still works, it just won't survive a reload
  }
}
