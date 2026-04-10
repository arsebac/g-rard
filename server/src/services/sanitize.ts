import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const window = new JSDOM("").window;
const purify = DOMPurify(window as any);

/**
 * Nettoie le HTML pour éviter les injections XSS.
 * Autorise les balises courantes de mise en forme (WYSIWYG).
 */
export function sanitizeHtml(html: string): string {
  return purify.sanitize(html, {
    ALLOWED_TAGS: [
      "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "p", "a", "ul", "ol",
      "nl", "li", "b", "i", "strong", "em", "strike", "code", "hr", "br", "div",
      "table", "thead", "caption", "tbody", "tr", "th", "td", "pre", "span", "img"
    ],
    ALLOWED_ATTR: ["href", "name", "target", "src", "alt", "class", "style"],
    ALLOWED_SCHEMES: ["http", "https", "ftp", "mailto", "data"]
  });
}
