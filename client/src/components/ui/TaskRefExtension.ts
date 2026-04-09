import { Mark, mergeAttributes, InputRule, PasteRule } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    taskRef: {
      setTaskRef: (ref: string) => ReturnType;
    };
  }
}

/**
 * Mark Tiptap qui reconnaît les références de tickets (ex: CUI-5)
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

  addCommands() {
    return {
      setTaskRef:
        (ref: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { ref }),
    };
  },

  addInputRules() {
    // Déclenche quand on tape "CUI-5 " (espace après la ref)
    return [
      new InputRule({
        find: /([A-Z]{2,5}-\d+)\s$/,
        handler: ({ state, range, match }) => {
          const ref = match[1];
          const { tr } = state;
          const markFrom = range.from;
          const markTo = range.from + ref.length;
          // Le texte est déjà dans le document, on ajoute juste le mark
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
