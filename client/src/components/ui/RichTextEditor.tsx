import { useEffect, useState } from "react";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { Check, X } from "lucide-react";
import { TaskRefExtension } from "./TaskRefExtension";

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`flex items-center justify-center w-7 h-7 rounded text-sm transition-colors ${
        active
          ? "bg-indigo-100 text-indigo-700"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-gray-200 mx-0.5" />;
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50 rounded-t-xl">
      {/* Titres */}
      <ToolbarButton
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        title="Titre 1"
      >
        <span className="font-bold text-xs leading-none">H1</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Titre 2"
      >
        <span className="font-bold text-xs leading-none">H2</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title="Titre 3"
      >
        <span className="font-bold text-xs leading-none">H3</span>
      </ToolbarButton>

      <Divider />

      {/* Formatage inline */}
      <ToolbarButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Gras (Ctrl+B)"
      >
        <span className="font-bold text-sm leading-none">B</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italique (Ctrl+I)"
      >
        <span className="italic text-sm leading-none">I</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Souligné (Ctrl+U)"
      >
        <span className="underline text-sm leading-none">U</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Barré"
      >
        <span className="line-through text-sm leading-none">S</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="Code inline"
      >
        <span className="font-mono text-xs leading-none">{"`"}</span>
      </ToolbarButton>

      <Divider />

      {/* Listes */}
      <ToolbarButton
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Liste à puces"
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current">
          <circle cx="2" cy="4" r="1.5" />
          <rect x="5" y="3" width="9" height="2" rx="1" />
          <circle cx="2" cy="8" r="1.5" />
          <rect x="5" y="7" width="9" height="2" rx="1" />
          <circle cx="2" cy="12" r="1.5" />
          <rect x="5" y="11" width="9" height="2" rx="1" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Liste numérotée"
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current">
          <text x="0" y="5" fontSize="5" fontFamily="monospace">1.</text>
          <rect x="5" y="3" width="9" height="2" rx="1" />
          <text x="0" y="9" fontSize="5" fontFamily="monospace">2.</text>
          <rect x="5" y="7" width="9" height="2" rx="1" />
          <text x="0" y="13" fontSize="5" fontFamily="monospace">3.</text>
          <rect x="5" y="11" width="9" height="2" rx="1" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Citation"
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current">
          <rect x="1" y="2" width="2.5" height="12" rx="1" />
          <rect x="5" y="4" width="9" height="2" rx="1" opacity=".7" />
          <rect x="5" y="8" width="7" height="2" rx="1" opacity=".7" />
          <rect x="5" y="12" width="8" height="2" rx="1" opacity=".7" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        title="Bloc de code"
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current">
          <path d="M5.5 4L2 8l3.5 4-.8.8L.5 8l4.2-4.8.8.8zm5 0l.8-.8L15.5 8l-4.2 4.8-.8-.8L14 8l-3.5-4z" />
        </svg>
      </ToolbarButton>

      <Divider />

      {/* Alignement */}
      <ToolbarButton
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        title="Aligner à gauche"
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current">
          <rect x="1" y="3" width="14" height="2" rx="1" />
          <rect x="1" y="7" width="9" height="2" rx="1" />
          <rect x="1" y="11" width="12" height="2" rx="1" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        title="Centrer"
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current">
          <rect x="1" y="3" width="14" height="2" rx="1" />
          <rect x="3.5" y="7" width="9" height="2" rx="1" />
          <rect x="2" y="11" width="12" height="2" rx="1" />
        </svg>
      </ToolbarButton>

      <Divider />

      {/* Règle / reset */}
      <ToolbarButton
        active={false}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Séparateur horizontal"
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current">
          <rect x="1" y="7" width="14" height="2" rx="1" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        active={false}
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        title="Effacer la mise en forme"
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current">
          <path d="M12.5 2L14 3.5 6 11.5 2 12l.5-4L12.5 2zM2 14h12v1.5H2z" opacity=".6" />
        </svg>
      </ToolbarButton>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

interface RichTextEditorProps {
  defaultValue: string;
  onSave?: (html: string) => void;
  placeholder?: string;
  onTaskRefClick?: (ref: string) => void;
  readOnly?: boolean;
}

export function RichTextEditor({ defaultValue, onSave, placeholder, onTaskRefClick, readOnly }: RichTextEditorProps) {
  const [dirty, setDirty] = useState(false);

  const editor = useEditor({
    editable: !readOnly,
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: placeholder ?? "Ajouter une description…" }),
      Link.configure({ openOnClick: false }),
      TaskRefExtension,
    ],
    content: defaultValue || "",
    onUpdate: ({ editor }) => {
      if (readOnly) return;
      const current = editor.getHTML();
      const clean = current === "<p></p>" ? "" : current;
      setDirty(clean !== (defaultValue || ""));
    },
  });

  // sync si la tâche change
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.commands.setContent(defaultValue || "");
      editor.setEditable(!readOnly);
      setDirty(false);
    }
  }, [defaultValue, readOnly]);

  const commit = () => {
    if (!editor || !onSave) return;
    const html = editor.getHTML();
    onSave(html === "<p></p>" ? "" : html);
    setDirty(false);
  };

  const cancel = () => {
    if (!editor) return;
    editor.commands.setContent(defaultValue || "");
    setDirty(false);
  };

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
      <div
        className={`border rounded-xl overflow-hidden transition-colors ${
          readOnly ? "border-transparent" :
          editor?.isFocused
            ? "border-indigo-400 ring-2 ring-indigo-100"
            : "border-gray-200 hover:border-gray-300"
        }`}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const ref =
            target.getAttribute("data-task-ref") ??
            target.closest("[data-task-ref]")?.getAttribute("data-task-ref");
          if (ref && onTaskRefClick) {
            e.preventDefault();
            e.stopPropagation();
            onTaskRefClick(ref);
          }
        }}
      >
        {editor && !readOnly && <Toolbar editor={editor} />}
        <EditorContent editor={editor} className={`gerard-prose ${readOnly ? "px-0 py-0" : ""}`} />
      </div>

      {!readOnly && dirty && (
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={commit}
            className="flex items-center gap-1 px-2.5 py-1 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-md transition-colors"
          >
            <Check size={12} /> Enregistrer
          </button>
          <button
            onClick={cancel}
            className="flex items-center gap-1 px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-600 text-xs font-medium rounded-md transition-colors"
          >
            <X size={12} /> Annuler
          </button>
        </div>
      )}
    </>
  );
}
