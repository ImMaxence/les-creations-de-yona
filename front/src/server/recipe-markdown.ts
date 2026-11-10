import type { RecipeDetail } from '../app/core/api/generated/models/recipe-detail';
import { SITE_NAME, absoluteUrl } from '../app/core/seo/page-seo';
import { describeMold, hasParts, shownIngredients } from '../app/pages/recipe/recipe-parts';
import { firstOfMonth } from '../app/shared/format/paris-time';
import { formatMinutes, formatQuantity } from '../app/shared/format/units';
import { recipeLink } from '../app/shared/routing/links';
import { quote } from './page-markdown';

const LONG_DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' });

/**
 * The recipe as Markdown: the content of its page without the site around it, for AI assistants
 * and agents that read rather than display (llms.txt convention: the page's address + ".md").
 */
export function recipeToMarkdown(recipe: RecipeDetail): string {
  const url = absoluteUrl(recipeLink(recipe).join('/'));
  const published = recipe.publishedAt ?? recipe.createdAt;
  const lines = [`# ${recipe.title}`, ''];
  if (recipe.intro) {
    lines.push(...quote(recipe.intro), '');
  }
  lines.push(
    `Une recette de Yona, publiée le ${firstOfMonth(LONG_DATE.format(new Date(published)))} et mise à jour le ` +
      `${firstOfMonth(LONG_DATE.format(new Date(recipe.updatedAt)))} sur ${SITE_NAME} : ${url}`,
    '',
    ...facts(recipe).map((fact) => `- ${fact}`),
    '',
    '## Ingrédients',
    '',
  );
  for (const part of recipe.parts) {
    if (hasParts(recipe.parts)) {
      lines.push(`### ${part.title}`, '');
    }
    for (const line of shownIngredients(part.ingredients, 1)) {
      lines.push(`- ${[line.amount, line.name, line.note && `(${line.note})`].filter(Boolean).join(' ')}`);
    }
    lines.push('');
  }
  if (recipe.equipment.length) {
    lines.push('## Matériel', '', ...recipe.equipment.map((item) => `- ${item}`), '');
  }
  lines.push('## Préparation', '');
  for (const part of recipe.parts) {
    if (hasParts(recipe.parts)) {
      lines.push(`### ${part.title}`, '');
    }
    part.steps.forEach((step, index) => {
      const duration = step.durationMinutes ? ` (${formatMinutes(step.durationMinutes)})` : '';
      // Continuation lines indented under their number: a step may hold a list
      const [first, ...rest] = `${step.description.trim()}${duration}`.split('\n');
      lines.push(`${index + 1}. ${first}`, ...rest.map((line) => (line.trim() ? `   ${line}` : '')));
    });
    lines.push('');
  }
  if (recipe.tip) {
    lines.push('## Le conseil de Yona', '', recipe.tip.trim(), '');
  }
  if (recipe.questions.length) {
    lines.push('## Questions fréquentes', '');
    for (const item of recipe.questions) {
      lines.push(`### ${item.question}`, '', item.answer, '');
    }
  }
  if (recipe.youtubeVideoId) {
    lines.push('## La recette en vidéo', '', `https://www.youtube.com/watch?v=${recipe.youtubeVideoId}`, '');
  }
  return lines.join('\n');
}

function facts(recipe: RecipeDetail): string[] {
  const totalMinutes = (recipe.prepMinutes ?? 0) + (recipe.restMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  return [
    `Catégories : ${recipe.categories.map((category) => category.name).join(', ')}`,
    recipe.tags.length ? `Tags : ${recipe.tags.map((tag) => tag.name).join(', ')}` : null,
    recipe.servings ? `Pour ${recipe.servings} ${recipe.servings > 1 ? 'personnes' : 'personne'}` : null,
    recipe.prepMinutes ? `Préparation : ${formatMinutes(recipe.prepMinutes)}` : null,
    recipe.restMinutes ? `Repos : ${formatMinutes(recipe.restMinutes)}` : null,
    recipe.cookMinutes ? `Cuisson : ${formatMinutes(recipe.cookMinutes)}` : null,
    totalMinutes ? `Temps total : ${formatMinutes(totalMinutes)}` : null,
    recipe.difficulty ? `Difficulté : ${formatQuantity(recipe.difficulty)} / 5` : null,
    recipe.mold ? `Moule : ${describeMold(recipe.mold)}` : null,
  ].filter((fact): fact is string => fact !== null);
}
