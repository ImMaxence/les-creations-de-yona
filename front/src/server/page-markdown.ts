import type { CategoryResponse } from '../app/core/api/generated/models/category-response';
import type { GlossaryTermResponse } from '../app/core/api/generated/models/glossary-term-response';
import type { MenuDetail } from '../app/core/api/generated/models/menu-detail';
import type { MenuSummary } from '../app/core/api/generated/models/menu-summary';
import type { RecipeCard } from '../app/core/api/generated/models/recipe-card';
import type { SiteContentResponse } from '../app/core/api/generated/models/site-content-response';
import type { SocialLinkResponse } from '../app/core/api/generated/models/social-link-response';
import { DEFAULT_DESCRIPTION, SITE_NAME, absoluteUrl, excerpt } from '../app/core/seo/page-seo';
import { GLOSSARY_DESCRIPTION } from '../app/pages/glossary/glossary.seo';
import type { LatestOfTheme } from '../app/pages/home/home.resolver';
import { MENUS_DESCRIPTION } from '../app/pages/menus/menus.resolver';
import { recipesDescription } from '../app/pages/recipes/recipes.resolver';
import { paragraphs } from '../app/shared/format/paragraphs';
import { THEMES, Theme } from '../app/shared/format/themes';
import {
  ABOUT_PATH,
  MENUS_PATH,
  RECIPES_PATH,
  categoryQueryParams,
  menuLink,
  recipeLink,
} from '../app/shared/routing/links';
import { socialPlatformLabel } from '../app/shared/ui/brand-icon/brand-icon';

/**
 * The pages of the site in Markdown, written from the API like llms.txt: their content without the
 * site around it (navigation, filters, buttons), for AI assistants and agents that read rather
 * than display. Recipes: recipe-markdown.ts; pages written in their template: rendered-markdown.ts.
 */

export const THEME_HEADINGS: Record<Theme, string> = { SAVORY: 'Recettes salées', SWEET: 'Recettes sucrées' };

export interface HomeContent {
  content: SiteContentResponse;
  featured: RecipeCard | null;
  /** The latest recipes of each theme, the featured one left out, as the home page shows them. */
  latest: LatestOfTheme[];
  menus: MenuSummary[];
}

export function homeMarkdown({ content, featured, latest, menus }: HomeContent): string {
  const lines = [`# ${SITE_NAME}`, '', `> ${DEFAULT_DESCRIPTION}`, ''];
  if (featured) {
    lines.push('## À la une', '', recipeLine(featured), '');
  }
  if (latest.length) {
    lines.push(`## ${content.latestTitle}`, '');
    for (const group of latest) {
      lines.push(`### ${THEME_HEADINGS[group.theme]}`, '', ...group.recipes.map(recipeLine), '');
    }
    lines.push(link('Toutes les recettes', RECIPES_PATH, recipesDescription()), '');
  }
  if (menus.length) {
    lines.push(`## ${content.menusTitle}`, '', ...menus.map(menuLine), '');
  }
  lines.push(
    `## ${content.aboutTitle}`,
    '',
    ...textParagraphs(content.aboutText),
    link('À propos de Yona', ABOUT_PATH, "l'autrice des recettes"),
    '',
  );
  return lines.join('\n');
}

/** Every published recipe, or those of a category, the latest first. */
export function recipesMarkdown(recipes: RecipeCard[], categories: CategoryResponse[], category?: CategoryResponse): string {
  const lines = [
    `# ${category?.name ?? 'Toutes les recettes'}`,
    '',
    `> ${recipesDescription(category)}`,
    '',
    `${recipes.length} recette${recipes.length > 1 ? 's' : ''}, les plus récentes en premier. Chaque recette existe ` +
      'aussi en Markdown : son adresse suivie de « .md »',
    '',
  ];
  if (category) {
    lines.push(...recipes.map(recipeLine), '', link('Toutes les recettes', RECIPES_PATH), '');
    return lines.join('\n');
  }
  lines.push(...recipesByTheme(recipes, '##'));
  const withRecipes = categories.filter((known) => known.publishedThemes.length > 0);
  if (withRecipes.length) {
    lines.push('## Catégories', '', ...withRecipes.map((known) => link(known.name, categoryPath(known))), '');
  }
  return lines.join('\n');
}

export function menusMarkdown(menus: MenuSummary[]): string {
  return ['# Menus', '', `> ${MENUS_DESCRIPTION}`, '', ...menus.map(menuLine), ''].join('\n');
}

export function menuMarkdown(menu: MenuDetail): string {
  const lines = [`# ${menu.title}`, ''];
  if (menu.intro) {
    lines.push(...quote(menu.intro), '');
  }
  lines.push(
    `Un menu composé par Yona sur ${SITE_NAME} : ${absoluteUrl(menuLink(menu).join('/'))}`,
    '',
    '## Les recettes',
    '',
    ...menu.recipes.map(recipeLine),
    '',
    link('Tous les menus', MENUS_PATH),
    '',
  );
  return lines.join('\n');
}

/** Each word under its own heading, as on the page (/glossaire#chemiser). */
export function glossaryMarkdown(terms: GlossaryTermResponse[]): string {
  const lines = ['# Glossaire de pâtisserie', '', `> ${GLOSSARY_DESCRIPTION}`, ''];
  for (const term of terms) {
    lines.push(`## ${term.name}`, '', (term.definition ?? '').trim(), '');
  }
  return lines.join('\n');
}

export function aboutMarkdown(content: SiteContentResponse, socialLinks: SocialLinkResponse[]): string {
  const lines = ['# À propos de Yona', '', `## ${content.aboutTitle}`, '', ...textParagraphs(content.aboutText)];
  if (socialLinks.length) {
    lines.push(
      '## Retrouver Yona',
      '',
      ...socialLinks.map((social) => `- [${socialPlatformLabel(social.platform)}](${social.url})`),
      '',
    );
  }
  lines.push('## Ses recettes', '', link('Toutes les recettes', RECIPES_PATH, recipesDescription()), '');
  return lines.join('\n');
}

/** Savory, then sweet, as the site shows them; every recipe has a theme since 1.10. */
export function recipesByTheme(recipes: RecipeCard[], heading: '##' | '###'): string[] {
  return THEMES.flatMap((theme) => {
    const ofTheme = recipes.filter((recipe) => (recipe.theme ?? 'SWEET') === theme.value);
    return ofTheme.length ? [`${heading} ${THEME_HEADINGS[theme.value]}`, '', ...ofTheme.map(recipeLine), ''] : [];
  });
}

/** "- [Tarte aux pommes](…): Tartes, Desserts". */
export function recipeLine(recipe: RecipeCard): string {
  return link(recipe.title, recipeLink(recipe).join('/'), recipe.categories.map((category) => category.name).join(', '));
}

/** "- [Menu de Noël](…): 4 recettes · Un repas de fête…". */
function menuLine(menu: MenuSummary): string {
  const count = `${menu.recipeCount} recette${menu.recipeCount > 1 ? 's' : ''}`;
  return link(menu.title, menuLink(menu).join('/'), menu.intro ? `${count} · ${excerpt(menu.intro, 200)}` : count);
}

/** "- [title](https://…/path): notes", notes on one line. */
export function link(title: string, path: string, notes?: string | null): string {
  return `- [${title.replace(/[[\]]/g, '')}](${absoluteUrl(path)})${notes ? `: ${notes.replace(/\s+/g, ' ').trim()}` : ''}`;
}

/** A text of the back-office, one line per paragraph: Markdown would join the lines of a paragraph anyway. */
export function textParagraphs(text: string): string[] {
  return paragraphs(text).flatMap((paragraph) => [paragraph.replace(/\s+/g, ' '), '']);
}

export function quote(text: string): string[] {
  return text
    .trim()
    .split('\n')
    .map((line) => (line.trim() ? `> ${line}` : '>'));
}

/** /recettes?categorie=desserts. */
export function categoryPath(category: { slug: string }): string {
  return `${RECIPES_PATH}?${new URLSearchParams(categoryQueryParams(category))}`;
}
