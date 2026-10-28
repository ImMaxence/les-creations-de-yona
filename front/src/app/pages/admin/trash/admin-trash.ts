import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../../core/api/generated/api';
import { attempt } from '../../../core/api/attempt';
import { emptyTrash } from '../../../core/api/generated/fn/admin-trash/empty-trash';
import { eraseFromTrash } from '../../../core/api/generated/fn/admin-trash/erase-from-trash';
import { eraseSeveralFromTrash } from '../../../core/api/generated/fn/admin-trash/erase-several-from-trash';
import { listTrash } from '../../../core/api/generated/fn/admin-trash/list-trash';
import { restoreFromTrash } from '../../../core/api/generated/fn/admin-trash/restore-from-trash';
import { restoreSeveralFromTrash } from '../../../core/api/generated/fn/admin-trash/restore-several-from-trash';
import { Failure } from '../../../core/api/generated/models/failure';
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
import { BulkBar } from '../bulk-bar/bulk-bar';
import { Selection } from '../selection';

type Kind = TrashedItem['kind'];
type KindFilter = Kind | 'ALL';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Failures named in the toast after a restore of several things; the others are counted. */
const NAMED_FAILURES = 3;

/** How each kind is named, in the plural too, and agreed with ("restaurée", "restauré"). */
const KINDS: Record<Kind, { label: string; plural: string; feminine: boolean; editLink?: string }> = {
  RECIPE: { label: 'Recette', plural: 'Recettes', feminine: true, editLink: '/admin/recettes' },
  CATEGORY: { label: 'Catégorie', plural: 'Catégories', feminine: true },
  MENU: { label: 'Menu', plural: 'Menus', feminine: false },
  IMAGE: { label: 'Photo', plural: 'Photos', feminine: true },
  TAG: { label: 'Tag', plural: 'Tags', feminine: false },
  INGREDIENT: { label: 'Ingrédient', plural: 'Ingrédients', feminine: false },
  GLOSSARY_TERM: { label: 'Mot du glossaire', plural: 'Mots du glossaire', feminine: false },
};

/**
 * Deleted recipes, categories, menus, photos, tags, ingredients and words of the glossary, kept 30 days before being erased: restored in one
 * click, as they were (URL, dates, photos, views, menus), or erased at once; one by one or ticked
 * together.
 */
@Component({
  selector: 'yona-admin-trash',
  imports: [Icon, RouterLink, Button, CoverImage, ParisDatePipe, Select, BulkBar],
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
  /** Kept when the type shown changes: "Tout sélectionner" adds those shown. */
  protected readonly selection = new Selection<number>();
  protected readonly bulkBusy = signal(false);

  /** Only the kinds the trash holds, with their number. */
  protected readonly kindOptions = computed<SelectOption<KindFilter>[]>(() => {
    const items = this.items.value() ?? [];
    return [
      { value: 'ALL', label: `Tout (${items.length})` },
      ...(Object.keys(KINDS) as Kind[])
        .map((kind) => ({ kind, count: items.filter((item) => item.kind === kind).length }))
        .filter(({ count }) => count > 0)
        .map(({ kind, count }) => ({ value: kind, label: `${KINDS[kind].plural} (${count})` })),
    ];
  });
  protected readonly shown = computed(() =>
    (this.items.value() ?? []).filter((item) => this.kind() === 'ALL' || item.kind === this.kind()),
  );
  protected readonly shownIds = computed(() => this.shown().map((item) => item.id));
  /** What "Tout sélectionner" covers once a type is chosen: "(recettes)". */
  protected readonly shownLabel = computed(() => {
    const kind = this.kind();
    return kind === 'ALL' ? '' : KINDS[kind].plural.toLowerCase();
  });

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
      message: `« ${item.title} » ne pourra plus être ${KINDS[item.kind].feminine ? 'restaurée' : 'restauré'}${erasedNote(item.kind)}`,
      confirmLabel: 'Effacer',
    });
    if (confirmed && (await attempt(this.api.invoke(eraseFromTrash, { id: item.id }))).ok) {
      this.toaster.success('Effacé définitivement');
      this.forget(item.id);
      this.items.reload();
    }
  }

  /**
   * Each one restored on its own, what others need first (a photo, a category before its recipes):
   * one that cannot come back stays in the trash, named in a message, the others are restored.
   */
  protected async restoreSelected(): Promise<void> {
    const ids = this.selection.ids();
    this.bulkBusy.set(true);
    const result = await attempt(this.api.invoke(restoreSeveralFromTrash, { ids }));
    this.bulkBusy.set(false);
    if (!result.ok) {
      return;
    }
    const { restored, failed } = result.value;
    if (restored.length) {
      this.toaster.success(
        restored.length > 1 ? `${restored.length} éléments restaurés` : restoredMessage(restored[0]),
      );
    }
    if (failed.length) {
      this.toaster.error(failedMessage(failed));
    }
    // What could not come back stays ticked, to try again once its reason is fixed
    this.selection.clear();
    failed.forEach((failure) => this.selection.toggle(failure.id));
    if (restored.some((item) => item.kind === 'CATEGORY' || item.kind === 'IMAGE')) {
      await this.siteData.load();
    }
    this.items.reload();
  }

  protected async eraseSelected(): Promise<void> {
    const count = this.selection.size();
    const confirmed = await this.confirm.ask({
      title: count > 1 ? `Effacer définitivement ${count} éléments ?` : 'Effacer définitivement ?',
      message:
        (count > 1
          ? 'Ils ne pourront plus être restaurés. '
          : "L'élément sélectionné ne pourra plus être restauré. ") +
        "Les photos des recettes et des catégories restent dans la galerie ; celles mises à la corbeille sont supprimées du stockage",
      confirmLabel: 'Effacer',
    });
    if (!confirmed) {
      return;
    }
    this.bulkBusy.set(true);
    const erased = await attempt(this.api.invoke(eraseSeveralFromTrash, { ids: this.selection.ids() }));
    this.bulkBusy.set(false);
    if (erased.ok) {
      this.toaster.success(count > 1 ? `${count} éléments effacés définitivement` : 'Effacé définitivement');
      this.selection.clear();
      this.items.reload();
    }
  }

  protected async emptyTrash(): Promise<void> {
    const count = this.items.value()?.length ?? 0;
    const confirmed = await this.confirm.ask({
      title: 'Vider la corbeille ?',
      message:
        count > 1
          ? `Les ${count} éléments de la corbeille seront effacés et ne pourront plus être restaurés`
          : "L'élément de la corbeille sera effacé et ne pourra plus être restauré",
      confirmLabel: 'Vider la corbeille',
    });
    if (confirmed && (await attempt(this.api.invoke(emptyTrash))).ok) {
      this.toaster.success('Corbeille vidée');
      this.kind.set('ALL');
      this.selection.clear();
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
    this.forget(item.id);
    // A category or a photo shows in the navbar and on the home page
    if (item.kind === 'CATEGORY' || item.kind === 'IMAGE') {
      await this.siteData.load();
    }
    return restored.value;
  }

  /** Out of the trash: no longer ticked. */
  private forget(id: number): void {
    if (this.selection.has(id)) {
      this.selection.toggle(id);
    }
  }
}

/** What else erasing it does: a photo's files go, a recipe's, category's or menu's photo stays. */
function erasedNote(kind: Kind): string {
  switch (kind) {
    case 'IMAGE':
      return '. Ses fichiers sont supprimés du stockage';
    case 'RECIPE':
    case 'CATEGORY':
    case 'MENU':
      return '. Sa photo reste dans la galerie';
    default:
      return '';
  }
}

/** "« Goûter » : Un menu porte déjà ce titre", the first ones named, the others counted. */
function failedMessage(failed: Failure[]): string {
  const named = failed.slice(0, NAMED_FAILURES).map((failure) => `« ${failure.title} » : ${failure.message}`);
  const others = failed.length - named.length;
  const head = failed.length > 1 ? `${failed.length} éléments n'ont pas pu être restaurés` : "Un élément n'a pas pu être restauré";
  return `${head}. ${named.join(' ; ')}${others ? ` ; et ${others} autre${others > 1 ? 's' : ''}` : ''}`;
}

function restoredMessage(restored: TrashRestored): string {
  const back = restored.placesBack;
  switch (restored.kind) {
    case 'RECIPE': {
      const where = restored.status === 'PUBLISHED' ? 'est de nouveau en ligne' : 'est restaurée en brouillon';
      const menus = back ? `, et dans ${back > 1 ? `ses ${back} menus` : 'son menu'}` : '';
      return `« ${restored.title} » ${where}${menus}`;
    }
    case 'CATEGORY':
      return `Catégorie « ${restored.title} » restaurée`;
    case 'MENU':
      return `Menu « ${restored.title} » restauré, avec ${back > 1 ? `${back} recettes` : back ? '1 recette' : 'aucune recette'}`;
    case 'IMAGE':
      return back
        ? `Photo remise dans la galerie, et à ${back > 1 ? `ses ${back} emplacements` : 'sa place'}`
        : 'Photo remise dans la galerie';
    case 'TAG':
      return `Tag « ${restored.title} » restauré${back ? `, de nouveau sur ${back > 1 ? `${back} recettes` : '1 recette'}` : ''}`;
    case 'INGREDIENT':
      return `Ingrédient « ${restored.title} » restauré`;
    case 'GLOSSARY_TERM':
      return `« ${restored.title} » est de nouveau dans le glossaire`;
  }
}
