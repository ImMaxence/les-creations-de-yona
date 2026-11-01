import type { RequestHandler } from 'express';
import type { RecipeDetail } from '../app/core/api/generated/models/recipe-detail';
import { SITE_NAME, absoluteUrl } from '../app/core/seo/page-seo';
import { describeMold, hasParts, shownIngredients } from '../app/pages/recipe/recipe-parts';
import { formatMinutes, formatQuantity } from '../app/shared/format/units';
import { mainCategory, recipeLink } from '../app/shared/routing/links';
import { ApiError, apiOrigin, fetchRecipe } from './api';

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
    `Une recette de Yona, publiée le ${LONG_DATE.format(new Date(published))} et mise à jour le ` +
      `${LONG_DATE.format(new Date(recipe.updatedAt))} sur ${SITE_NAME} : ${url}`,
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

function quote(text: string): string[] {
  return text
    .trim()
    .split('\n')
    .map((line) => (line.trim() ? `> ${line}` : '>'));
}

/**
 * /recettes/{category}/{recipe}.md. The page stays the canonical address (Link header), so search
 * engines do not index both. A draft or an unknown recipe goes on to the site's 404 page.
 */
export const recipeMarkdown: RequestHandler = async (req, res, next) => {
  const categorySlug = req.params['categorySlug'] as string;
  const recipeSlug = req.params['recipeSlug'] as string;
  let recipe: RecipeDetail;
  try {
    recipe = await fetchRecipe(apiOrigin(req), recipeSlug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      next();
      return;
    }
    console.error('Recipe in Markdown unavailable', error);
    res.status(503).set('Cache-Control', 'no-store').set('Retry-After', '300').type('text/plain').send('Recette temporairement indisponible');
    return;
  }
  const path = recipeLink(recipe).join('/');
  if (mainCategory(recipe).slug !== categorySlug) {
    res.redirect(301, `${path}.md`);
    return;
  }
  res
    .type('text/markdown; charset=utf-8')
    .set('Cache-Control', 'public, max-age=3600')
    .set('Link', `<${absoluteUrl(path)}>; rel="canonical"`)
    .send(recipeToMarkdown(recipe));
};
