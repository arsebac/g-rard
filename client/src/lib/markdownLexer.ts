import { Marked, Tokenizer, type Tokens } from "marked";

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
  html(src: string): Tokens.HTML | Tokens.Paragraph | undefined {
    const token = super.html(src);
    if (!token || isRealHtml(token.raw)) return token;
    const text = token.raw.trimEnd();
    return { type: "paragraph", raw: token.raw, text, tokens: this.lexer.inline(text) };
  }

  tag(src: string): Tokens.Tag | Tokens.Text | undefined {
    const token = super.tag(src);
    if (!token || isRealHtml(token.raw)) return token;
    return { type: "text", raw: token.raw, text: token.raw };
  }
}

export const markdownLexer = new Marked({ gfm: true, tokenizer: new PlaceholderAwareTokenizer() });
