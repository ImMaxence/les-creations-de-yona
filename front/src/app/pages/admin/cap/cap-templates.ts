import { CapBlock } from '../../../core/api/generated/models/cap-block';
import { IconName } from '../../../shared/ui/icon/icons';

export type BlockType = CapBlock['type'];

/** A model of article: the blocks it lays down at first. They can be added, removed or moved after. */
export interface CapTemplate {
  id: 'recit' | 'pas-a-pas' | 'carnet' | 'vide';
  name: string;
  /** What it is for. */
  purpose: string;
  blocks: () => CapBlock[];
}

/** What a block holds, by type: its name in the editor, its icon, what it says it is for. */
export const BLOCK_TYPES: readonly { type: BlockType; label: string; icon: IconName; hint: string }[] = [
  { type: 'TEXT', label: 'Texte', icon: 'type', hint: 'Paragraphes, intertitres, gras, listes, liens vers les recettes' },
  { type: 'IMAGE', label: 'Grande photo', icon: 'image', hint: 'Une photo sur toute la largeur, et sa légende' },
  { type: 'IMAGE_TEXT', label: 'Photo + texte', icon: 'layers', hint: 'Une photo d’un côté, du texte de l’autre' },
  { type: 'STEPS', label: 'Étapes en photos', icon: 'layout-grid', hint: 'De 2 à 8 photos numérotées, chacune sa légende' },
  { type: 'TIP', label: 'Astuce à retenir', icon: 'lightbulb', hint: 'Un court texte dans un encadré coloré' },
];

export const MAX_BLOCKS = 60;
export const MAX_STEP_PHOTOS = 8;
export const MIN_STEP_PHOTOS = 2;
export const MAX_TIP_LENGTH = 1000;

export function blockLabel(type: BlockType): string {
  return BLOCK_TYPES.find((known) => known.type === type)?.label ?? type;
}

/** An empty block of a type, as a model or the "+" lays it down. */
export function emptyBlock(type: BlockType, side: 'LEFT' | 'RIGHT' = 'LEFT'): CapBlock {
  switch (type) {
    case 'IMAGE_TEXT':
      return { type, side };
    case 'STEPS':
      return { type, photos: [{}, {}, {}] };
    default:
      return { type };
  }
}

export const CAP_TEMPLATES: readonly CapTemplate[] = [
  {
    id: 'recit',
    name: 'Récit',
    purpose: 'Raconter une journée, un examen',
    blocks: () => [emptyBlock('TEXT'), emptyBlock('IMAGE'), emptyBlock('TEXT')],
  },
  {
    id: 'pas-a-pas',
    name: 'Pas à pas',
    purpose: 'Montrer une réalisation',
    blocks: () => [emptyBlock('TEXT'), emptyBlock('STEPS'), emptyBlock('TIP')],
  },
  {
    id: 'carnet',
    name: 'Carnet',
    purpose: 'Plusieurs remarques illustrées',
    blocks: () => [emptyBlock('TEXT'), emptyBlock('IMAGE_TEXT', 'LEFT'), emptyBlock('IMAGE_TEXT', 'RIGHT'), emptyBlock('IMAGE_TEXT', 'LEFT')],
  },
  { id: 'vide', name: 'Vide', purpose: 'Tout construire soi-même', blocks: () => [] },
];

export function templateOf(id: string | null | undefined): CapTemplate {
  return CAP_TEMPLATES.find((template) => template.id === id) ?? CAP_TEMPLATES[0]!;
}

/** "Mon premier examen blanc" → "mon-premier-examen-blanc", as the server makes the address. */
export function slugOf(title: string): string {
  return (
    title
      .toLocaleLowerCase('fr')
      .replace(/œ/g, 'oe')
      .replace(/æ/g, 'ae')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'article'
  );
}
