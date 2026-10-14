import {isValidPoemTitle} from './poem-policy.js';

export function parsePoemsFromMarkdown(markdown) {
  const lines = String(markdown ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
    .replace(/<!--[^]*?-->/g, '').split('\n');
  const poems = [];
  let title = '';
  let verses = [];
  const flush = () => {
    if (!title) return;
    // Remove separators around a poem, preserving verse indentation, Markdown
    // hard breaks, quotations and every blank line between stanzas.
    while (verses.length && !verses[0].trim()) verses.shift();
    while (verses.length && !verses.at(-1).trim()) verses.pop();
    if (isValidPoemTitle(title) && verses.length) poems.push({title, text:verses.join('\n')});
    verses = [];
  };
  for (const line of lines) {
    const heading = line.match(/^ {0,3}#(?!#)\s*(.+?)\s*$/);
    if (heading) { flush(); title = heading[1].trim(); }
    else if (title) verses.push(line);
  }
  flush();
  return poems;
}
