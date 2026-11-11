import { CapBlock } from '../../../core/api/generated/models/cap-block';
import { CapTemplate } from './cap-templates';

/** The shape asked to the AI, as the models of "Nouvel article"; AUTO: the one that fits the notes. */
export type CapAiForm = 'AUTO' | 'STORY' | 'STEPS' | 'NOTEBOOK';

export const CAP_AI_FORMS: readonly { form: CapAiForm; label: string }[] = [
  { form: 'AUTO', label: 'L’IA choisit' },
  { form: 'STORY', label: 'Récit' },
  { form: 'STEPS', label: 'Pas à pas' },
  { form: 'NOTEBOOK', label: 'Carnet' },
];

/** The model chosen in "Nouvel article" asks for its own shape; "Vide" lets the AI choose. */
export function formOfTemplate(id: CapTemplate['id'] | string | null | undefined): CapAiForm {
  switch (id) {
    case 'recit':
      return 'STORY';
    case 'pas-a-pas':
      return 'STEPS';
    case 'carnet':
      return 'NOTEBOOK';
    default:
      return 'AUTO';
  }
}

/** Notes as Yona could type them, one per shape: a button puts them in the field, to see what the AI writes. */
export const CAP_AI_EXAMPLES: readonly { label: string; form: CapAiForm; notes: string }[] = [
  {
    label: 'Examen blanc',
    form: 'STORY',
    notes: `Examen blanc ce matin, 5 h d'épreuve. Sujet : tarte aux pommes à l'ancienne, 12 choux craquelin et une crème pâtissière.
Stressée au début, j'ai mal pesé le beurre de la pâte brisée : recommencée, 20 min de perdues.
Les choux ont bien gonflé, mais le craquelin était trop épais sur certains.
Crème pâtissière bonne mais un peu trop cuite : la formatrice dit de la retirer du feu dès les premiers bouillons.
14/20. Contente quand même. La prochaine fois : faire un planning minute par minute.`,
  },
  {
    label: 'Technique pas à pas',
    form: 'STEPS',
    notes: `Pâte feuilletée en cours aujourd'hui, 6 tours simples.
Détrempe : farine, sel, eau et un peu de beurre fondu, sans trop la travailler. 1 h au frais.
Beurre de tourage aplati en carré entre deux feuilles, de la même consistance que la détrempe.
On enferme le beurre, on abaisse en rectangle, on plie en trois : c'est un tour. 2 tours, puis 20 min au frais, 3 fois.
Le piège : un beurre trop froid casse et perce la pâte.
Cuisson à 200 °C : les feuilletés ont monté de 5 cm !`,
  },
  {
    label: 'Remarques de la semaine',
    form: 'NOTEBOOK',
    notes: `Mes remarques de la semaine en atelier :
- meringue italienne : sucre cuit à 118 °C, le verser en filet sur les blancs, pas trop vite
- ganache montée : 12 h au frigo avant de la monter, sinon elle ne tient pas
- éclairs : poche inclinée à 45°, pression régulière, 14 cm de long
- glaçage miroir : à 35 °C, pas plus chaud sinon il coule`,
  },
  {
    label: 'Journée de stage',
    form: 'STORY',
    notes: `Premier jour de stage en boulangerie-pâtisserie, arrivée à 5 h.
Le chef m'a montré le façonnage des croissants : j'en ai fait une cinquantaine, les premiers pas très droits.
Ensuite les tartes aux fraises de la vitrine : 30 fonds à foncer.
Fatiguée mais j'ai appris plein de gestes, surtout travailler vite et propre.`,
  },
];

/**
 * The article written by the AI, with the photos already placed kept: each takes the next place for
 * a photo, in order; those left over follow at the end as big photos.
 */
export function withPhotosKept(written: readonly CapBlock[], previous: readonly CapBlock[]): CapBlock[] {
  const photos: string[] = [];
  for (const block of previous) {
    if (block.imageId && (block.type === 'IMAGE' || block.type === 'IMAGE_TEXT')) {
      photos.push(block.imageId);
    }
    for (const photo of block.type === 'STEPS' ? (block.photos ?? []) : []) {
      if (photo.imageId) {
        photos.push(photo.imageId);
      }
    }
  }
  const blocks = written.map((block): CapBlock => {
    if (block.type === 'IMAGE' || block.type === 'IMAGE_TEXT') {
      const imageId = photos.shift();
      return imageId ? { ...block, imageId } : block;
    }
    if (block.type === 'STEPS') {
      return { ...block, photos: (block.photos ?? []).map((photo) => ({ ...photo, imageId: photos.shift() ?? photo.imageId })) };
    }
    return block;
  });
  return [...blocks, ...photos.map((imageId): CapBlock => ({ type: 'IMAGE', imageId }))];
}

/** Something typed or placed that the article written by the AI would replace. */
export function hasContent(title: string, subtitle: string, blocks: readonly CapBlock[]): boolean {
  return (
    !!title.trim() ||
    !!subtitle.trim() ||
    blocks.some((block) => block.text?.trim() || block.caption?.trim() || block.photos?.some((photo) => photo.caption?.trim()))
  );
}
