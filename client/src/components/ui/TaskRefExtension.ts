import { Mark, mergeAttributes, InputRule, PasteRule } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    taskRef: {
      setTaskRef: (ref: string) => ReturnType;
    };
  }
}

/**
 * Tiptap mark that recognizes ticket references (e.g. CUI-5)
 * et les rend comme des liens cliquables.
 */
export const TaskRefExtension = Mark.create({
  name: "taskRef",

  addAttributes() {
    return {
      ref: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-task-ref"),
        renderHTML: (attrs) => ({ "data-task-ref": attrs.ref }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "a[data-task-ref]",
        // Must win over the Link mark's generic a[href] rule
        priority: 100,
        getAttrs: (el) => ({ ref: (el as HTMLElement).getAttribute("data-task-ref") }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        class: "task-ref-link",
        href: `/tickets/${HTMLAttributes["data-task-ref"]}`,
      }),
      0,
    ];
  },

  // Markdown: refs are stored as plain text ("CUI-5") and turned back into
  // the mark when the description is loaded.
  markdownTokenName: "taskRef",
  markdownTokenizer: {
    name: "taskRef",
    level: "inline",
    start: (src: string) => src.search(/\b[A-Z]{2,5}-\d+\b/),
    tokenize: (src: string) => {
      const match = /^([A-Z]{2,5}-\d+)\b/.exec(src);
      if (!match) return undefined;
      return { type: "taskRef", raw: match[0], text: match[1] };
    },
  },
  parseMarkdown: (token, helpers) =>
    helpers.applyMark("taskRef", [{ type: "text", text: token.text }], { ref: token.text }),
  renderMarkdown: (node, helpers) => helpers.renderChildren(node),

  addCommands() {
    return {
      setTaskRef:
        (ref: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { ref }),
    };
  },

  addInputRules() {
    // Fires when typing "CUI-5 " (space after the ref)
    return [
      new InputRule({
        find: /([A-Z]{2,5}-\d+)\s$/,
        handler: ({ state, range, match }) => {
          const ref = match[1];
          const { tr } = state;
          const markFrom = range.from;
          const markTo = range.from + ref.length;
          // The text is already in the document, just apply the mark
          tr.addMark(markFrom, markTo, this.type.create({ ref }));
          tr.removeStoredMark(this.type);
        },
      }),
    ];
  },

  addPasteRules() {
    return [
      new PasteRule({
        find: /([A-Z]{2,5}-\d+)/g,
        handler: ({ state, range, match }) => {
          const ref = match[1];
          const { tr } = state;
          tr.addMark(range.from, range.to, this.type.create({ ref }));
        },
      }),
    ];
  },
});
