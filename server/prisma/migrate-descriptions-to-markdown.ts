/**
 * One-shot migration: task descriptions used to be stored as Tiptap HTML,
 * they are now Markdown. Converts the remaining HTML descriptions with the
 * same Tiptap setup the client editor uses, so the output matches what the
 * editor would save.
 *
 * Dry run (default):  npx tsx --env-file=../.env prisma/migrate-descriptions-to-markdown.ts
 * Apply:              npx tsx --env-file=../.env prisma/migrate-descriptions-to-markdown.ts --apply
 */
import { JSDOM } from "jsdom";
import { PrismaClient } from "@prisma/client";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  Node: dom.window.Node,
  HTMLElement: dom.window.HTMLElement,
  getComputedStyle: dom.window.getComputedStyle,
});

const HTML_PATTERN = /^\s*<(p|h[1-6]|ul|ol|blockquote|pre|hr|div)[\s>/]/i;

async function main() {
  const apply = process.argv.includes("--apply");
  const { Editor } = await import("@tiptap/core");
  const StarterKit = (await import("@tiptap/starter-kit")).default;
  const Image = (await import("@tiptap/extension-image")).default;
  const { Markdown } = await import("@tiptap/markdown");
  const { TaskRefExtension } = await import("../../client/src/components/ui/TaskRefExtension");

  const toMarkdown = (html: string) => {
    const editor = new Editor({
      extensions: [StarterKit.configure({ underline: false }), Image, Markdown, TaskRefExtension],
      content: html,
      contentType: "html",
    });
    const markdown = editor.getMarkdown().trim();
    editor.destroy();
    return markdown;
  };

  const db = new PrismaClient();
  const tasks = await db.task.findMany({
    where: { description: { startsWith: "<" } },
    select: { id: true, description: true },
  });
  const legacy = tasks.filter((t) => t.description && HTML_PATTERN.test(t.description));
  console.log(`${legacy.length} HTML description(s) to convert${apply ? "" : " (dry run)"}`);

  for (const task of legacy) {
    const markdown = toMarkdown(task.description!);
    if (!apply) {
      console.log(`\n── task ${task.id}\n${task.description!.slice(0, 200)}\n→\n${markdown.slice(0, 200)}`);
      continue;
    }
    await db.task.update({ where: { id: task.id }, data: { description: markdown || null } });
  }

  if (apply) console.log("Done.");
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
