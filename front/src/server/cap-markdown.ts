import type { CapArticle } from '../app/core/api/generated/models/cap-article';
import { SITE_NAME, absoluteUrl } from '../app/core/seo/page-seo';
import { CAP_PATH, capArticleLink } from '../app/shared/routing/links';
import { link, quote } from './page-markdown';

const DAY = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });

function photo(imageId: string | undefined, caption: string | undefined): string[] {
  return imageId ? [`![${(caption ?? '').replace(/[[\]]/g, '')}](${absoluteUrl(`/api/images/${imageId}/1600.webp`)})`, ''] : [];
}

/**
 * An article of "Mon CAP" in Markdown, from its blocks: its texts as written (they are Markdown
 * already, links to recipes made absolute), its tips as quotes, its photos with their captions,
 * its steps numbered. For llms-full.txt, where an assistant reads the whole site at once.
 */
export function capArticleToMarkdown(article: CapArticle): string {
  const lines = [`# ${article.title}`, ''];
  if (article.subtitle) {
    lines.push(`*${article.subtitle}*`, '');
  }
  lines.push(
    `Mon CAP, le ${DAY.format(new Date(article.happenedOn))}, par Yona sur ${SITE_NAME} : ${absoluteUrl(capArticleLink(article).join('/'))}`,
    '',
    ...photo(article.imageId, article.title),
  );
  for (const block of article.blocks) {
    switch (block.type) {
      case 'TEXT':
        lines.push(absoluteLinks(block.text ?? ''), '');
        break;
      case 'TIP':
        lines.push(...quote(`**Astuce** : ${block.text ?? ''}`), '');
        break;
      case 'IMAGE':
        lines.push(...photo(block.imageId, block.caption));
        break;
      case 'IMAGE_TEXT':
        lines.push(...photo(block.imageId, block.caption), absoluteLinks(block.text ?? ''), '');
        break;
      case 'STEPS':
        (block.photos ?? []).forEach((step, index) => {
          lines.push(`${index + 1}. ${step.caption ?? `Étape ${index + 1}`}`);
          if (step.imageId) {
            lines.push(`   ![](${absoluteUrl(`/api/images/${step.imageId}/1600.webp`)})`);
          }
        });
        lines.push('');
        break;
    }
  }
  lines.push(link('Tous les articles de Mon CAP', CAP_PATH), '');
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

/** "[Tarte](/recettes/…)" → "[Tarte](https://…/recettes/…)": readable out of the site. */
function absoluteLinks(markdown: string): string {
  return markdown.trim().replace(/\]\((\/[^)\s]*)\)/g, (_, path: string) => `](${absoluteUrl(path)})`);
}
