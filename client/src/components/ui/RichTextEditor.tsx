import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { Markdown } from "@tiptap/markdown";
import { Check, ImagePlus, X } from "lucide-react";
import { TaskRefExtension } from "./TaskRefExtension";
import { markdownOptions } from "../../lib/markdownLexer";

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

function Toolbar({ editor, onPickImage }: { editor: Editor; onPickImage?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50 rounded-t-xl">
      {/* Titres */}
      <ToolbarButton
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        title="Heading 1"
      >
        <span className="font-bold text-xs leading-none">H1</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading 2"
      >
        <span className="font-bold text-xs leading-none">H2</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title="Heading 3"
      >
        <span className="font-bold text-xs leading-none">H3</span>
      </ToolbarButton>

      <Divider />

      {/* Formatage inline */}
      <ToolbarButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Ctrl+B)"
      >
        <span className="font-bold text-sm leading-none">B</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Ctrl+I)"
      >
        <span className="italic text-sm leading-none">I</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        <span className="line-through text-sm leading-none">S</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="Inline code"
      >
        <span className="font-mono text-xs leading-none">{"`"}</span>
      </ToolbarButton>

      <Divider />

      {/* Listes */}
      <ToolbarButton
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
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
        title="Numbered list"
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
        title="Quote"
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
        title="Code block"
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current">
          <path d="M5.5 4L2 8l3.5 4-.8.8L.5 8l4.2-4.8.8.8zm5 0l.8-.8L15.5 8l-4.2 4.8-.8-.8L14 8l-3.5-4z" />
        </svg>
      </ToolbarButton>

      <Divider />

      {/* Image / rule / reset */}
      {onPickImage && (
        <ToolbarButton active={false} onClick={onPickImage} title="Insert image">
          <ImagePlus size={15} />
        </ToolbarButton>
      )}
      <ToolbarButton
        active={false}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal rule"
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current">
          <rect x="1" y="7" width="14" height="2" rx="1" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        active={false}
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        title="Clear formatting"
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current">
          <path d="M12.5 2L14 3.5 6 11.5 2 12l.5-4L12.5 2zM2 14h12v1.5H2z" opacity=".6" />
        </svg>
      </ToolbarButton>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

// Descriptions are stored as Markdown. Older ones were saved as Tiptap HTML:
// load those as HTML, they are converted to Markdown on the next save.
function contentType(value: string): "html" | "markdown" {
  return /^\s*<(p|h[1-6]|ul|ol|blockquote|pre|hr|div)[\s>/]/i.test(value) ? "html" : "markdown";
}

interface RichTextEditorProps {
  defaultValue: string;
  onSave?: (markdown: string) => void;
  placeholder?: string;
  onTaskRefClick?: (ref: string) => void;
  readOnly?: boolean;
  /** Uploads an image and resolves with its URL; enables image paste/drop and the toolbar button. */
  onImageUpload?: (file: File) => Promise<string>;
}

export function RichTextEditor({ defaultValue, onSave, placeholder, onTaskRefClick, readOnly, onImageUpload }: RichTextEditorProps) {
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);

  const insertImages = async (files: File[], pos?: number) => {
    const target = editorRef.current;
    if (!target || !onImageUpload) return;
    setUploading(true);
    try {
      for (const file of files) {
        const src = await onImageUpload(file);
        const image = { type: "image", attrs: { src, alt: file.name } };
        if (pos !== undefined) target.chain().focus().insertContentAt(pos, image).run();
        else target.chain().focus().insertContent(image).run();
      }
    } finally {
      setUploading(false);
    }
  };

  const imageFiles = (list: FileList | null | undefined) =>
    Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));

  const editor = useEditor({
    editable: !readOnly,
    extensions: [
      // No underline: Markdown has no syntax for it
      StarterKit.configure({ underline: false, link: { openOnClick: false } }),
      Placeholder.configure({ placeholder: placeholder ?? "Add a description…" }),
      Image,
      Markdown.configure({ markedOptions: markdownOptions }),
      TaskRefExtension,
    ],
    content: defaultValue || "",
    contentType: contentType(defaultValue || ""),
    editorProps: {
      handlePaste: (_view, event) => {
        const files = imageFiles(event.clipboardData?.files);
        if (!files.length || !onImageUpload) return false;
        event.preventDefault();
        insertImages(files);
        return true;
      },
      handleDrop: (view, event) => {
        const files = imageFiles(event.dataTransfer?.files);
        if (!files.length || !onImageUpload) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        insertImages(files, pos);
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      if (readOnly) return;
      setDirty(editor.getMarkdown().trim() !== (defaultValue || "").trim());
    },
  });
  editorRef.current = editor;

  // sync when the task changes
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.commands.setContent(defaultValue || "", { contentType: contentType(defaultValue || "") });
      editor.setEditable(!readOnly);
      setDirty(false);
    }
  }, [defaultValue, readOnly]);

  const commit = () => {
    if (!editor || !onSave) return;
    onSave(editor.getMarkdown().trim());
    setDirty(false);
  };

  const cancel = () => {
    if (!editor) return;
    editor.commands.setContent(defaultValue || "", { contentType: contentType(defaultValue || "") });
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
        {editor && !readOnly && (
          <Toolbar
            editor={editor}
            onPickImage={onImageUpload ? () => fileInputRef.current?.click() : undefined}
          />
        )}
        {onImageUpload && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              insertImages(imageFiles(e.target.files));
              e.target.value = "";
            }}
          />
        )}
        {uploading && <p className="px-3 py-1 text-xs text-gray-400">Uploading image…</p>}
        <EditorContent editor={editor} className={`gerard-prose ${readOnly ? "px-0 py-0" : ""}`} />
      </div>

      {!readOnly && dirty && (
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={commit}
            className="flex items-center gap-1 px-2.5 py-1 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-md transition-colors"
          >
            <Check size={12} /> Save
          </button>
          <button
            onClick={cancel}
            className="flex items-center gap-1 px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-600 text-xs font-medium rounded-md transition-colors"
          >
            <X size={12} /> Cancel
          </button>
        </div>
      )}
    </>
  );
}
