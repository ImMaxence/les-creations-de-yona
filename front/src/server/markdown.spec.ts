import { markdownPathOf } from '../app/core/seo/page-seo';
import { pagePathOf } from './markdown';

describe('Markdown addresses', () => {
  it('announces each page at its address + ".md", "/index.md" for the home page, before the query', () => {
    expect(markdownPathOf('/')).toBe('/index.md');
    expect(markdownPathOf('/a-propos')).toBe('/a-propos.md');
    expect(markdownPathOf('/recettes/desserts/tarte')).toBe('/recettes/desserts/tarte.md');
    expect(markdownPathOf('/recettes?categorie=desserts')).toBe('/recettes.md?categorie=desserts');
  });

  it('finds the page of a Markdown address, "index.md" too', () => {
    expect(pagePathOf('/index.md')).toBe('/');
    expect(pagePathOf('/index.html.md')).toBe('/');
    expect(pagePathOf('/a-propos.md')).toBe('/a-propos');
    expect(pagePathOf('/a-propos/index.md')).toBe('/a-propos');
    expect(pagePathOf('/recettes/desserts/tarte.md')).toBe('/recettes/desserts/tarte');
    expect(pagePathOf('/recettes/desserts/tarte/index.md')).toBe('/recettes/desserts/tarte');
  });

  it('leaves the other addresses alone', () => {
    expect(pagePathOf('/a-propos')).toBeNull();
    expect(pagePathOf('/llms.txt')).toBeNull();
    expect(pagePathOf('/recettes/desserts/tarte-md')).toBeNull();
  });
});
