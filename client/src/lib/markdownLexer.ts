import { Tokenizer, type Tokens } from "marked";

// Element names a description may legitimately embed as raw HTML. Anything else
// between angle brackets (placeholders like <route> or <id>) is plain text:
// left as an html token, Tiptap would drop it on display and on the next save.
const HTML_TAGS = new Set([
  "a", "abbr", "b", "blockquote", "br", "caption", "code", "col", "colgroup", "dd", "del",
  "details", "div", "dl", "dt", "em", "figcaption", "figure", "h1", "h2", "h3", "h4", "h5",
  "h6", "hr", "i", "img", "ins", "kbd", "li", "mark", "ol", "p", "pre", "q", "s", "samp",
  "small", "span", "strike", "strong", "sub", "summary", "sup", "table", "tbody", "td",
  "tfoot", "th", "thead", "tr", "u", "ul", "var",
]);

function isRealHtml(raw: string) {
  if (/^\s*<!--/.test(raw)) return true;
  const name = /^\s*<\/?([a-zA-Z][\w-]*)/.exec(raw)?.[1];
  return name !== undefined && HTML_TAGS.has(name.toLowerCase());
}

class PlaceholderAwareTokenizer extends Tokenizer {
  // marked types each tokenizer by the token it usually yields, but the lexer
  // accepts any token: the casts below hand back a paragraph or text instead.
  html(src: string) {
    const token = super.html(src);
    if (!token || isRealHtml(token.raw)) return token;
    const text = token.raw.trimEnd();
    const paragraph: Tokens.Paragraph = { type: "paragraph", raw: token.raw, text, tokens: this.lexer.inline(text) };
    return paragraph as unknown as Tokens.HTML;
  }

  tag(src: string) {
    const token = super.tag(src);
    if (!token || isRealHtml(token.raw)) return token;
    const text: Tokens.Text = { type: "text", raw: token.raw, text: token.raw };
    return text as unknown as Tokens.Tag;
  }
}

// Passed as Tiptap markedOptions: Tiptap lexes with `new marked.Lexer()`, which
// reads the global marked defaults, so a separate Marked instance is ignored.
export const markdownOptions = { tokenizer: new PlaceholderAwareTokenizer() };
