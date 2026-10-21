import { Pipe, PipeTransform } from '@angular/core';
import { marked } from 'marked';

/**
 * Recipe steps are stored as Markdown, never as HTML. The output goes through [innerHTML], so
 * Angular's sanitizer still removes scripts and event handlers if the text ever contained some.
 */
@Pipe({ name: 'markdown' })
export class MarkdownPipe implements PipeTransform {
  transform(markdown: string): string {
    return marked.parse(markdown, { async: false, gfm: true, breaks: true });
  }
}
