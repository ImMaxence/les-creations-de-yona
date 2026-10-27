import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../../core/api/generated/api';
import { attempt } from '../../../core/api/attempt';
import { emptyTrash } from '../../../core/api/generated/fn/admin-trash/empty-trash';
import { eraseFromTrash } from '../../../core/api/generated/fn/admin-trash/erase-from-trash';
import { listTrash } from '../../../core/api/generated/fn/admin-trash/list-trash';
import { restoreFromTrash } from '../../../core/api/generated/fn/admin-trash/restore-from-trash';
import { TrashRestored } from '../../../core/api/generated/models/trash-restored';
import { TrashedItem } from '../../../core/api/generated/models/trashed-item';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { SiteData } from '../../../core/site/site-data';
import { ParisDatePipe } from '../../../shared/format/paris-date.pipe';
import { Button } from '../../../shared/ui/button/button';
import { CoverImage } from '../../../shared/ui/cover-image/cover-image';
import { Icon } from '../../../shared/ui/icon/icon';
import { Select, SelectOption } from '../../../shared/ui/select/select';

type Kind = TrashedItem['kind'];
type KindFilter = Kind | 'ALL';

const DAY_MS = 24 * 60 * 60 * 1000;

/** How each kind is named, and agreed with ("restaurée", "restauré"). */
const KINDS: Record<Kind, { label: string; feminine: boolean; editLink?: string }> = {
  RECIPE: { label: 'Recette', feminine: true, editLink: '/admin/recettes' },
  CATEGORY: { label: 'Catégorie', feminine: true },
  MENU: { label: 'Menu', feminine: false },
  IMAGE: { label: 'Photo', feminine: true },
};

/**
 * Deleted recipes, categories, menus and photos, kept 30 days before being erased: restored in one
 * click, as they were (URL, dates, photos, views, menus), or erased at once.
 */
@Component({
  selector: 'yona-admin-trash',
  imports: [Icon, RouterLink, Button, CoverImage, ParisDatePipe, Select],
  templateUrl: './admin-trash.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminTrash {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);
  private readonly siteData = inject(SiteData);

  protected readonly kinds = KINDS;
  protected readonly items = resource({ loader: () => this.api.invoke(listTrash) });
  protected readonly busyId = signal<number | null>(null);
  protected readonly kind = signal<KindFilter>('ALL');

  /** Only the kinds the trash holds, with their number. */
  protected readonly kindOptions = computed<SelectOption<KindFilter>[]>(() => {
    const items = this.items.value() ?? [];
    return [
      { value: 'ALL', label: `Tout (${items.length})` },
      ...(Object.keys(KINDS) as Kind[])
        .map((kind) => ({ kind, count: items.filter((item) => item.kind === kind).length }))
        .filter(({ count }) => count > 0)
        .map(({ kind, count }) => ({ value: kind, label: `${KINDS[kind].label}s (${count})` })),
    ];
  });
  protected readonly shown = computed(() =>
    (this.items.value() ?? []).filter((item) => this.kind() === 'ALL' || item.kind === this.kind()),
  );

  /** A deleted photo is no longer in the gallery: the trash serves it. */
  protected trashedImageUrl(item: TrashedItem): string {
    return `/api/admin/trash/${item.id}/image`;
  }

  /** "Effacée dans 12 jours", "effacé la nuit prochaine". */
  protected daysLeft(item: TrashedItem): string {
    const days = Math.ceil((new Date(item.erasedAt).getTime() - Date.now()) / DAY_MS);
    const erased = KINDS[item.kind].feminine ? 'effacée' : 'effacé';
    return days <= 1 ? `${erased} la nuit prochaine` : `${erased} dans ${days} jours`;
  }

  protected async restore(item: TrashedItem): Promise<void> {
    const restored = await this.restoreItem(item);
    if (restored) {
      this.toaster.success(restoredMessage(restored));
      this.items.reload();
    }
  }

  /** The restored recipe, to check it at once. */
  protected async restoreAndOpen(item: TrashedItem): Promise<void> {
    const restored = await this.restoreItem(item);
    const link = KINDS[item.kind].editLink;
    if (restored) {
      this.toaster.success(restoredMessage(restored));
      await this.router.navigate(link && restored.id !== undefined ? [link, restored.id] : ['/admin/corbeille']);
    }
  }

  protected async erase(item: TrashedItem): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Effacer définitivement ?',
      message: `« ${item.title} » ne pourra plus être ${KINDS[item.kind].feminine ? 'restaurée' : 'restauré'}. ${
        item.kind === 'IMAGE' ? 'Ses fichiers sont supprimés du stockage.' : 'Sa photo reste dans la galerie.'
      }`,
      confirmLabel: 'Effacer',
    });
    if (confirmed && (await attempt(this.api.invoke(eraseFromTrash, { id: item.id }))).ok) {
      this.toaster.success('Effacé définitivement.');
      this.items.reload();
    }
  }

  protected async emptyTrash(): Promise<void> {
    const count = this.items.value()?.length ?? 0;
    const confirmed = await this.confirm.ask({
      title: 'Vider la corbeille ?',
      message:
        count > 1
          ? `Les ${count} éléments de la corbeille seront effacés et ne pourront plus être restaurés.`
          : "L'élément de la corbeille sera effacé et ne pourra plus être restauré.",
      confirmLabel: 'Vider la corbeille',
    });
    if (confirmed && (await attempt(this.api.invoke(emptyTrash))).ok) {
      this.toaster.success('Corbeille vidée.');
      this.kind.set('ALL');
      this.items.reload();
    }
  }

  private async restoreItem(item: TrashedItem): Promise<TrashRestored | null> {
    this.busyId.set(item.id);
    const restored = await attempt(this.api.invoke(restoreFromTrash, { id: item.id }));
    this.busyId.set(null);
    if (!restored.ok) {
      return null;
    }
    // A category or a photo shows in the navbar and on the home page
    if (item.kind === 'CATEGORY' || item.kind === 'IMAGE') {
      await this.siteData.load();
    }
    return restored.value;
  }
}

function restoredMessage(restored: TrashRestored): string {
  const back = restored.placesBack;
  switch (restored.kind) {
    case 'RECIPE': {
      const where = restored.status === 'PUBLISHED' ? 'est de nouveau en ligne' : 'est restaurée en brouillon';
      const menus = back ? `, et dans ${back > 1 ? `ses ${back} menus` : 'son menu'}` : '';
      return `« ${restored.title} » ${where}${menus}.`;
    }
    case 'CATEGORY':
      return `Catégorie « ${restored.title} » restaurée.`;
    case 'MENU':
      return `Menu « ${restored.title} » restauré, avec ${back > 1 ? `${back} recettes` : back ? '1 recette' : 'aucune recette'}.`;
    case 'IMAGE':
      return back
        ? `Photo remise dans la galerie, et à ${back > 1 ? `ses ${back} emplacements` : 'sa place'}.`
        : 'Photo remise dans la galerie.';
  }
}
