import { CapBlock } from '../../../core/api/generated/models/cap-block';
import { BLOCK_TYPES } from './cap-templates';

/** An article as typed in the editor, kept in this browser until saved. */
export interface ArticleDraft {
  title: string;
  subtitle: string;
  date: string;
  imageId: string | null;
  style: 'CLASSIC' | 'NOTEBOOK';
  published: boolean;
  /** A draft's time of publication, Paris time ("2026-10-31T10:00"); absent from those kept before 2.8. */
  scheduledAt?: string;
  featured: boolean;
  blocks: CapBlock[];
}

/** "yona-article-draft-12", or "…-nouveau" for an article not saved yet. */
export const KEPT_ARTICLE_PREFIX = 'yona-article-draft-';

export function keptArticleKey(id: number | null): string {
  return KEPT_ARTICLE_PREFIX + (id ?? 'nouveau');
}

const TYPES = new Set<string>(BLOCK_TYPES.map((block) => block.type));

/** What was read back is an article draft, its blocks of known types. */
export function isArticleDraft(value: unknown): value is ArticleDraft {
  const draft = value as Partial<ArticleDraft> | null;
  return (
    !!draft &&
    typeof draft === 'object' &&
    typeof draft.title === 'string' &&
    typeof draft.subtitle === 'string' &&
    typeof draft.date === 'string' &&
    (draft.imageId === null || typeof draft.imageId === 'string') &&
    (draft.style === 'CLASSIC' || draft.style === 'NOTEBOOK') &&
    typeof draft.published === 'boolean' &&
    (draft.scheduledAt === undefined || typeof draft.scheduledAt === 'string') &&
    typeof draft.featured === 'boolean' &&
    Array.isArray(draft.blocks) &&
    draft.blocks.every((block: unknown) => !!block && typeof block === 'object' && TYPES.has((block as CapBlock).type))
  );
}
