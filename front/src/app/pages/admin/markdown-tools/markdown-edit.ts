/**
 * The formatting buttons of a text written in Markdown (a step, an article): what each does to the
 * text and to the words selected. They read what is there rather than adding marks blindly: "Gras"
 * on words already bold takes the bold off (on part of a bold passage, only that part), on words
 * partly bold makes the whole selection bold in one passage; "Liste" on lines already in a list
 * takes them out of it, an "Intertitre" becomes a list item and the other way round.
 */

/** The text once changed, and the selection to give back to the field. */
export interface TextEdit {
  text: string;
  start: number;
  end: number;
}

export type InlineStyle = 'bold' | 'italic';

export type LineStyle = 'list' | 'title';

/** What a style is written with: **gras**, *italique*. */
const MARKS: Record<InlineStyle, string> = { bold: '**', italic: '*' };

/** The start of a line that is not its text: "- ", "1. ", "## ", "> ", with the indentation before it. */
const LINE_PREFIX = /^(\s*)([-*+] |\d{1,9}[.)] |#{1,6} |> )?/;

const BULLET = /^(\s*)[-*+] /;
const NUMBERED = /^(\s*)\d{1,9}[.)] /;
const HEADING = /^#{1,6} /;
const QUOTE = /^> /;
const TITLE = '## ';

const WORD_CHAR = /[\p{L}\p{N}_'’-]/u;

/** A character of the text of a line, its marks left out, with its styles. */
interface Styled {
  char: string;
  bold: boolean;
  italic: boolean;
}

/**
 * A line read: what precedes its text ("- "), then the characters of its text;
 * {@code plainAt[i]}: the character the raw position i of the text comes before (one more for its end).
 */
interface ReadLine {
  prefix: string;
  chars: Styled[];
  plainAt: number[];
}

interface Range {
  from: number;
  to: number;
}

interface LineSpan {
  start: number;
  /** Before its line break. */
  end: number;
}

// Inline styles

/**
 * "Gras" or "Italique" on the selection [start, end) of the text. Nothing selected: the word the
 * cursor is in, or the passage in that style it touches; elsewhere, {@code placeholder} written in
 * the style and selected, to type over it.
 */
export function toggleInline(text: string, start: number, end: number, style: InlineStyle, placeholder: string): TextEdit {
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  const lines = splitLines(text)
    .filter((line) => line.end >= from && line.start <= to && (line.start < to || from === to))
    .map((span) => {
      const parsed = readLine(text.slice(span.start, span.end));
      return { span, parsed, range: { from: plainIndex(parsed, from - span.start), to: plainIndex(parsed, to - span.start) } };
    });

  if (!lines.some(({ parsed, range }) => parsed.chars.slice(range.from, range.to).some((styled) => !isSpace(styled.char)))) {
    // Nothing but the cursor: a word, a passage in the style, or the placeholder
    const caret = lines.find(({ span }) => from >= span.start && from <= span.end);
    const around = caret && (wordAround(caret.parsed.chars, caret.range.from) ?? runAround(caret.parsed.chars, caret.range.from, style));
    if (!caret || !around) {
      const at = caret ? Math.max(from, caret.span.start + caret.parsed.prefix.length) : from;
      return insertPlaceholder(text, at, style, placeholder);
    }
    lines.forEach((line) => (line.range = line === caret ? around : { from: 0, to: 0 }));
  }

  const selected = lines.flatMap(({ parsed, range }) => parsed.chars.slice(range.from, range.to));
  const styledAlready = selected.every((styled) => isSpace(styled.char) || styled[style]);
  for (const { parsed, range } of lines) {
    for (let i = range.from; i < range.to; i++) {
      parsed.chars[i]![style] = !styledAlready;
    }
  }

  // Written again, line by line; the selection kept on the same characters, without the spaces around them
  let next = '';
  let copied = 0;
  let selectionStart = -1;
  let selectionEnd = -1;
  for (const { span, parsed, range } of lines) {
    next += text.slice(copied, span.start) + parsed.prefix;
    const written = writeLine(parsed.chars);
    const kept = trimRange(parsed.chars, range);
    if (kept) {
      if (selectionStart < 0) {
        selectionStart = next.length + written.rawAt[kept.from]!;
      }
      selectionEnd = next.length + written.rawAt[kept.to - 1]! + 1;
    }
    next += written.text;
    copied = span.end;
  }
  next += text.slice(copied);
  return selectionStart < 0 ? { text: next, start: from, end: from } : { text: next, start: selectionStart, end: selectionEnd };
}

function insertPlaceholder(text: string, at: number, style: InlineStyle, placeholder: string): TextEdit {
  const mark = MARKS[style];
  const start = at + mark.length;
  return { text: `${text.slice(0, at)}${mark}${placeholder}${mark}${text.slice(at)}`, start, end: start + placeholder.length };
}

/** The word the cursor is inside (letters on both sides), or null. */
function wordAround(chars: Styled[], at: number): Range | null {
  if (!isWordChar(chars[at - 1]?.char) || !isWordChar(chars[at]?.char)) {
    return null;
  }
  return expand(chars, at, (styled) => isWordChar(styled?.char));
}

/** The passage in the style the cursor is in, or just before or after; null when it touches none. */
function runAround(chars: Styled[], at: number, style: InlineStyle): Range | null {
  if (!chars[at - 1]?.[style] && !chars[at]?.[style]) {
    return null;
  }
  const inside = (styled: Styled | undefined) => !!styled?.[style];
  return chars[at]?.[style] ? expand(chars, at, inside) : expand(chars, at - 1, inside);
}

/** The characters around {@code at} that pass, {@code at} included. */
function expand(chars: Styled[], at: number, passes: (styled: Styled | undefined) => boolean): Range {
  let from = at;
  let to = at;
  while (passes(chars[from - 1])) {
    from--;
  }
  while (passes(chars[to])) {
    to++;
  }
  return { from, to };
}

/** The range without the spaces at its ends; null when it holds only spaces. */
function trimRange(chars: Styled[], range: Range): Range | null {
  let { from, to } = range;
  while (from < to && isSpace(chars[from]!.char)) {
    from++;
  }
  while (to > from && isSpace(chars[to - 1]!.char)) {
    to--;
  }
  return from < to ? { from, to } : null;
}

/** The character of the text a raw position of the line comes before; inside its prefix, the first one. */
function plainIndex(line: ReadLine, rawPosition: number): number {
  const inText = rawPosition - line.prefix.length;
  return inText <= 0 ? 0 : line.plainAt[Math.min(inText, line.plainAt.length - 1)]!;
}

interface Delimiter {
  length: number;
  canOpen: boolean;
  canClose: boolean;
  remaining: number;
  /** Marks it closes, from the inside out (its left side): 2 for bold, 1 for italics. */
  closing: number[];
  /** Marks it opens, from the inside out (its right side). */
  opening: number[];
  removed: boolean;
}

/**
 * The styles of a line of Markdown, as CommonMark reads emphasis written with "*": a run of
 * asterisks opens before a character and closes after one, ** for bold, * for italics, *** for
 * both; an asterisk paired with none stays a character of the text, as does an escaped one (\*).
 */
export function readLine(line: string): ReadLine {
  const prefix = LINE_PREFIX.exec(line)![0];
  const content = line.slice(prefix.length);
  const tokens: (string | Delimiter)[] = [];
  const delimiters: Delimiter[] = [];
  for (let i = 0; i < content.length; ) {
    const char = content[i]!;
    if (char === '\\' && i + 1 < content.length) {
      tokens.push(char, content[i + 1]!);
      i += 2;
    } else if (char !== '*') {
      tokens.push(char);
      i++;
    } else {
      let length = 1;
      while (content[i + length] === '*') {
        length++;
      }
      const before = content[i - 1];
      const after = content[i + length];
      const delimiter: Delimiter = {
        length,
        canOpen: after !== undefined && !isSpace(after),
        canClose: before !== undefined && !isSpace(before),
        remaining: length,
        closing: [],
        opening: [],
        removed: false,
      };
      tokens.push(delimiter);
      delimiters.push(delimiter);
      i += length;
    }
  }
  pairDelimiters(delimiters);

  const chars: Styled[] = [];
  const plainAt: number[] = [];
  let bold = 0;
  let italic = 0;
  const push = (char: string): void => {
    chars.push({ char, bold: bold > 0, italic: italic > 0 });
  };
  for (const token of tokens) {
    if (typeof token === 'string') {
      plainAt.push(chars.length);
      push(token);
      continue;
    }
    // A cursor among the asterisks is before the character that follows them
    for (let k = 0; k < token.length; k++) {
      plainAt.push(chars.length);
    }
    // Its left side closes, what pairs with nothing stays text, its right side opens
    for (const use of token.closing) {
      if (use === 2) {
        bold--;
      } else {
        italic--;
      }
    }
    for (let k = 0; k < token.remaining; k++) {
      push('*');
    }
    for (const use of [...token.opening].reverse()) {
      if (use === 2) {
        bold++;
      } else {
        italic++;
      }
    }
  }
  plainAt.push(chars.length);
  return { prefix, chars, plainAt };
}

/** CommonMark's "process emphasis", for "*" only. */
function pairDelimiters(delimiters: Delimiter[]): void {
  delimiters.forEach((closer, c) => {
    if (!closer.canClose) {
      return;
    }
    while (closer.remaining > 0) {
      let o = c - 1;
      for (; o >= 0; o--) {
        const opener = delimiters[o]!;
        if (opener.removed || !opener.canOpen || opener.remaining === 0) {
          continue;
        }
        // The rule of 3: "*foo**bar**baz*" is italics around bold, not two italics
        const bothWays = (opener.canOpen && opener.canClose) || (closer.canOpen && closer.canClose);
        if (bothWays && (opener.length + closer.length) % 3 === 0 && (opener.length % 3 !== 0 || closer.length % 3 !== 0)) {
          continue;
        }
        break;
      }
      if (o < 0) {
        return;
      }
      const opener = delimiters[o]!;
      const use = opener.remaining >= 2 && closer.remaining >= 2 ? 2 : 1;
      opener.opening.push(use);
      closer.closing.push(use);
      opener.remaining -= use;
      closer.remaining -= use;
      for (let between = o + 1; between < c; between++) {
        delimiters[between]!.removed = true;
      }
    }
  });
}

/** The text of a line written from its characters; {@code rawAt[i]}: where character i lands. */
export function writeLine(source: readonly Styled[]): { text: string; rawAt: number[] } {
  const chars = source.map((styled) => ({ ...styled }));
  // A style neither starts nor ends on a space ("** gras**" is not bold)
  for (const style of ['bold', 'italic'] as const) {
    for (let i = 0; i < chars.length; ) {
      if (!chars[i]![style]) {
        i++;
        continue;
      }
      const run = expand(chars, i, (styled) => !!styled?.[style]);
      for (let k = run.from; k < run.to && isSpace(chars[k]!.char); k++) {
        chars[k]![style] = false;
      }
      for (let k = run.to - 1; k >= run.from && isSpace(chars[k]!.char); k--) {
        chars[k]![style] = false;
      }
      i = run.to;
    }
  }

  let text = '';
  const rawAt: number[] = [];
  const open: InlineStyle[] = [];
  const runEnd = (from: number, style: InlineStyle): number => expand(chars, from, (styled) => !!styled?.[style]).to;
  for (let i = 0; i <= chars.length; i++) {
    const styled = chars[i];
    const space = !styled || isSpace(styled.char);
    // Kept open over a space inside a passage, never opened on one
    const wanted = (['bold', 'italic'] as const).filter((style) => styled?.[style] && (!space || open.includes(style)));
    const firstUnwanted = open.findIndex((style) => !wanted.includes(style));
    while (firstUnwanted >= 0 && open.length > firstUnwanted) {
      text += MARKS[open.pop()!];
    }
    if (!space) {
      // The longest passage opens first, around the others; bold around italics when they end together
      const opening = wanted
        .filter((style) => !open.includes(style))
        .sort((a, b) => runEnd(i, b) - runEnd(i, a) || (a === 'bold' ? -1 : 1));
      for (const style of opening) {
        text += MARKS[style];
        open.push(style);
      }
    }
    if (styled) {
      rawAt.push(text.length);
      text += styled.char;
    }
  }
  return { text, rawAt };
}

// Lines

/**
 * "Liste" or "Intertitre" on the lines the selection touches (the cursor's line if nothing is
 * selected): taken off when every line has it already, put on each line otherwise, in place of
 * the other one ("## " becomes "- "). Empty lines are left as they are, unless all of them are.
 */
export function toggleLines(text: string, start: number, end: number, style: LineStyle): TextEdit {
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  // The line of the start, and those starting inside the selection: one starting where it ends is left alone
  const lines = splitLines(text).filter((line) => (line.start <= from && from <= line.end) || (line.start > from && line.start < to));
  const written = lines.map((line) => text.slice(line.start, line.end));
  const filled = written.filter((line) => line.trim());
  const has = style === 'list' ? (line: string) => BULLET.test(line) : (line: string) => line.startsWith(TITLE);
  const removing = filled.length > 0 && filled.every(has);

  let next = '';
  let copied = 0;
  const shifts: { line: LineSpan; oldPrefix: number; newPrefix: number; newStart: number }[] = [];
  lines.forEach((line, index) => {
    const content = written[index]!;
    let changed = content;
    if (removing) {
      changed = style === 'list' ? content.replace(BULLET, '$1') : content.slice(TITLE.length);
    } else if (content.trim() || !filled.length) {
      changed = style === 'list' ? toBullet(content) : TITLE + withoutPrefix(content).trimStart();
    }
    next += text.slice(copied, line.start);
    shifts.push({ line, oldPrefix: prefixLength(content), newPrefix: prefixLength(changed), newStart: next.length });
    next += changed;
    copied = line.end;
  });
  next += text.slice(copied);

  /** A selection from the very start of a line keeps the whole line, its new marker included. */
  const move = (position: number, wholeLine: boolean): number => {
    const shift = shifts.find(({ line }) => line.start <= position && position <= line.end);
    if (!shift) {
      return position < (shifts[0]?.line.start ?? 0) ? position : position + next.length - text.length;
    }
    const column = position - shift.line.start;
    if (wholeLine && column === 0) {
      return shift.newStart;
    }
    return shift.newStart + (column < shift.oldPrefix ? shift.newPrefix : column - shift.oldPrefix + shift.newPrefix);
  };
  return { text: next, start: move(from, from < to), end: move(to, false) };
}

/** "- " in front of the text of the line, its indentation kept, in place of "1. " or "## ". */
function toBullet(line: string): string {
  if (BULLET.test(line)) {
    return line;
  }
  const indentation = /^\s*/.exec(line)![0];
  return `${indentation}- ${withoutPrefix(line.slice(indentation.length))}`;
}

function withoutPrefix(line: string): string {
  return line.replace(BULLET, '$1').replace(NUMBERED, '$1').replace(HEADING, '').replace(QUOTE, '');
}

function prefixLength(line: string): number {
  return LINE_PREFIX.exec(line)![0].length;
}

/**
 * Entrée in a list item: the next item started ("- ", or the next number); on an empty item, the
 * list ends there. Null when Entrée does what it always does.
 */
export function continueList(text: string, start: number, end: number): TextEdit | null {
  if (start !== end) {
    return null;
  }
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const lineBreak = text.indexOf('\n', start);
  const lineEnd = lineBreak < 0 ? text.length : lineBreak;
  const line = text.slice(lineStart, lineEnd);
  const item = /^(\s*)([-*+]|(\d{1,9})([.)])) /.exec(line);
  if (!item || start - lineStart < item[0].length) {
    return null;
  }
  if (!line.slice(item[0].length).trim()) {
    // An empty item: out of the list
    return { text: text.slice(0, lineStart) + text.slice(lineEnd), start: lineStart, end: lineStart };
  }
  const marker = item[3] ? `${Number(item[3]) + 1}${item[4]}` : item[2];
  const inserted = `\n${item[1]}${marker} `;
  const caret = start + inserted.length;
  return { text: text.slice(0, start) + inserted + text.slice(end), start: caret, end: caret };
}

// Helpers

function splitLines(text: string): LineSpan[] {
  const lines: LineSpan[] = [];
  for (let start = 0; ; ) {
    const lineBreak = text.indexOf('\n', start);
    if (lineBreak < 0) {
      lines.push({ start, end: text.length });
      return lines;
    }
    lines.push({ start, end: lineBreak });
    start = lineBreak + 1;
  }
}

function isSpace(char: string | undefined): boolean {
  return char === undefined || /\s/.test(char);
}

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && WORD_CHAR.test(char);
}
