import TurndownService from 'turndown';
import { absoluteUrl } from '../app/core/seo/page-seo';

/** Parts of the interface rather than of the text: controls, icons, images, dialogs. */
const INTERFACE_TAGS = new Set([
  'BUTTON',
  'DIALOG',
  'IMG',
  'INPUT',
  'LABEL',
  'NOSCRIPT',
  'SCRIPT',
  'SELECT',
  'STYLE',
  'SVG',
  'TEMPLATE',
  'TEXTAREA',
]);

/**
 * A page whose text is written in its template (legal pages, installation), as rendered by the
 * server, turned into Markdown: the content of <main>, without the controls around the text.
 * Tab panels each get their tab's name as a heading: all of them are in the HTML. Null when the
 * page has no main content.
 */
export function renderedToMarkdown(html: string, path: string): string | null {
  const main = /<main\b[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1];
  if (!main) {
    return null;
  }
  const pageUrl = absoluteUrl(path);
  const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', emDelimiter: '*' });
  // Added rules come before Turndown's own: an image or a hidden paragraph is left out, not converted
  turndown.addRule('interface', {
    filter: (node) =>
      INTERFACE_TAGS.has(node.nodeName.toUpperCase()) ||
      node.hasAttribute('hidden') ||
      node.getAttribute('aria-hidden') === 'true' ||
      // The small line above a title ("Informations légales"): a label, not part of the text
      ` ${node.getAttribute('class') ?? ''} `.includes(' eyebrow '),
    replacement: () => '',
  });
  turndown.addRule('tabPanel', {
    filter: (node) => node.getAttribute('role') === 'tabpanel',
    replacement: (content, node) => {
      const tab = node.ownerDocument.getElementById(node.getAttribute('aria-labelledby') ?? '');
      const name = tab?.textContent?.replace(/\s+/g, ' ').trim();
      return `\n\n${name ? `### ${name}\n\n` : ''}${content.trim()}\n\n`;
    },
  });
  // Absolute addresses: the Markdown is read away from the page
  turndown.addRule('link', {
    filter: (node) => node.nodeName.toUpperCase() === 'A' && node.hasAttribute('href'),
    replacement: (content, node) => {
      const text = content.replace(/\s+/g, ' ').trim();
      return text ? `[${text}](${new URL(node.getAttribute('href')!, pageUrl).href})` : '';
    },
  });
  const markdown = turndown
    .turndown(main)
    // What is left of an element emptied above (a tab list without its buttons)
    .replace(/^[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return markdown ? `${markdown}\n` : null;
}
