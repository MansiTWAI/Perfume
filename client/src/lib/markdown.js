import { marked } from 'marked';
import DOMPurify from 'dompurify';

const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// Renders Journal Markdown to sanitised HTML and returns the H2 outline.
export function renderMarkdown(md = '') {
  const toc = [];
  const renderer = new marked.Renderer();
  renderer.heading = function ({ tokens, depth }) {
    const text = this.parser.parseInline(tokens);
    const id = slug(text);
    if (depth === 2) toc.push({ id, text: text.replace(/<[^>]+>/g, '') });
    return `<h${depth} id="${id}">${text}</h${depth}>`;
  };
  renderer.table = function (token) {
    return `<div class="table-wrap">${marked.Renderer.prototype.table.call(this, token)}</div>`;
  };
  const html = marked.parse(md, { renderer, gfm: true });
  return { html: DOMPurify.sanitize(html), toc };
}
