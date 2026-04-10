import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml()", () => {
  it("devrait nettoyer les balises script malveillantes", () => {
    const dirty = '<p>Hello <script>alert("xss")</script></p>';
    const clean = sanitizeHtml(dirty);
    expect(clean).toBe("<p>Hello </p>");
  });

  it("devrait conserver les balises autorisées (h1, p, b)", () => {
    const dirty = "<h1>Titre</h1><p>Ceci est <b>important</b></p>";
    const clean = sanitizeHtml(dirty);
    expect(clean).toBe("<h1>Titre</h1><p>Ceci est <b>important</b></p>");
  });

  it("devrait supprimer les attributs onerror et onmouseover", () => {
    const dirty = '<img src="x" onerror="alert(1)">';
    const clean = sanitizeHtml(dirty);
    expect(clean).toBe('<img src="x">');
  });

  it("devrait autoriser les liens vers https", () => {
    const dirty = '<a href="https://google.com">Google</a>';
    const clean = sanitizeHtml(dirty);
    expect(clean).toBe('<a href="https://google.com">Google</a>');
  });

  it("devrait supprimer les schémas javascript: dans les liens", () => {
    const dirty = '<a href="javascript:alert(1)">Click me</a>';
    const clean = sanitizeHtml(dirty);
    expect(clean).toBe("<a>Click me</a>");
  });
});
