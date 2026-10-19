import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { commentsApi, Comment, ActivityLog } from "@/api/comments";
import { attachmentsApi } from "@/api/attachments";
import { useAuthStore } from "@/store/auth";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  MessageSquare,
  History,
  Send,
  Pencil,
  Trash2,
  Check,
  X,
  ArrowRight,
  ImagePlus,
  Loader2,
} from "lucide-react";

type Tab = "comments" | "history";

// ─── Event rendering helpers ──────────────────────────────────────────────────

function parseJson(v: string | null): Record<string, unknown> {
  if (!v) return {};
  try { return JSON.parse(v); } catch { return {}; }
}

const ACTION_ICONS: Record<string, string> = {
  task_created: "✨",
  title_changed: "✏️",
  status_changed: "🔄",
  priority_changed: "🚩",
  assignee_changed: "👤",
  due_date_changed: "📅",
  description_changed: "📝",
  type_changed: "🏷️",
  parent_changed: "🔗",
  sprint_changed: "🏃",
  comment_added: "💬",
  comment_deleted: "🗑️",
};

function formatAction(log: ActivityLog, users: { id: number; name: string }[]): React.ReactNode {
  const old = parseJson(log.oldValue);
  const next = parseJson(log.newValue);
  const userName = (id: unknown) =>
    users.find((u) => u.id === id)?.name ?? `#${id}`;

  switch (log.action) {
    case "task_created":
      return <span>created this task</span>;
    case "title_changed":
      return (
        <span>
          changed the title{" "}
          <span className="line-through text-gray-400 text-xs">{String(old.title ?? "")}</span>
          {" "}<ArrowRight size={11} className="inline text-gray-400" />{" "}
          <span className="font-medium text-gray-800">{String(next.title ?? "")}</span>
        </span>
      );
    case "status_changed":
      return (
        <span>
          changed the status{" "}
          <span className="text-gray-400 text-xs">{STATUS_LABELS[String(old.status)] ?? old.status}</span>
          {" "}<ArrowRight size={11} className="inline text-gray-400" />{" "}
          <span className="font-medium text-gray-800">{STATUS_LABELS[String(next.status)] ?? next.status}</span>
        </span>
      );
    case "priority_changed":
      return (
        <span>
          changed the priority{" "}
          <span className="text-gray-400 text-xs">{PRIORITY_LABELS[String(old.priority)] ?? old.priority}</span>
          {" "}<ArrowRight size={11} className="inline text-gray-400" />{" "}
          <span className="font-medium text-gray-800">{PRIORITY_LABELS[String(next.priority)] ?? next.priority}</span>
        </span>
      );
    case "assignee_changed":
      return (
        <span>
          {next.assigneeId
            ? <span>assigned the task to <span className="font-medium text-gray-800">{userName(next.assigneeId)}</span></span>
            : <span>removed the assignee</span>}
        </span>
      );
    case "due_date_changed":
      return (
        <span>
          {next.dueDate
            ? <span>set the due date to <span className="font-medium text-gray-800">{format(new Date(String(next.dueDate)), "d MMM yyyy", { locale: fr })}</span></span>
            : <span>removed the due date</span>}
        </span>
      );
    case "description_changed":
      return <span>updated the description</span>;
    case "type_changed":
      return (
        <span>
          {next.typeId
            ? <span>changed the ticket type</span>
            : <span>removed the ticket type</span>}
        </span>
      );
    case "parent_changed":
      return (
        <span>
          {next.parentId
            ? <span>set parent ticket <span className="font-medium text-gray-800">#{String(next.parentId)}</span></span>
            : <span>removed the parent ticket</span>}
        </span>
      );
    case "sprint_changed":
      return (
        <span>
          {next.sprintId
            ? <span>moved the task to sprint <span className="font-medium text-gray-800">#{String(next.sprintId)}</span></span>
            : <span>moved the task to the backlog</span>}
        </span>
      );
    case "comment_added":
      return <span>added a comment</span>;
    case "comment_deleted":
      return <span>deleted a comment</span>;
    default:
      return <span className="text-gray-400">{log.action}</span>;
  }
}

// ─── Markdown comment body ────────────────────────────────────────────────────

const TASK_REF = /\b[A-Z]{2,5}-\d+\b/g;
const TASK_REF_URL = "#task-ref:";

interface MdNode { type: string; value?: string; url?: string; children?: MdNode[] }

// Turns plain-text ticket refs ("DEV-12") into links, like descriptions do.
// Code spans are separate nodes and link text is skipped, so neither is touched.
function remarkTaskRefs() {
  const walk = (node: MdNode) => {
    if (!node.children || node.type === "link") return;
    node.children = node.children.flatMap((child) => {
      if (child.type !== "text" || !child.value) { walk(child); return [child]; }
      const parts: MdNode[] = [];
      let last = 0;
      for (const m of child.value.matchAll(TASK_REF)) {
        if (m.index > last) parts.push({ type: "text", value: child.value.slice(last, m.index) });
        parts.push({ type: "link", url: TASK_REF_URL + m[0], children: [{ type: "text", value: m[0] }] });
        last = m.index + m[0].length;
      }
      if (!parts.length) return [child];
      if (last < child.value.length) parts.push({ type: "text", value: child.value.slice(last) });
      return parts;
    });
  };
  return walk;
}

function CommentBody({ body, onTaskRefClick }: { body: string; onTaskRefClick?: (ref: string) => void }) {
  return (
    <div className="gerard-prose !min-h-0 !p-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkTaskRefs]}
        components={{
          a: ({ href, children }) =>
            href?.startsWith(TASK_REF_URL) ? (
              <a
                href={href}
                className="task-ref-link"
                onClick={(e) => { e.preventDefault(); onTaskRefClick?.(href.slice(TASK_REF_URL.length)); }}
              >
                {children}
              </a>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
            ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}

// ─── Image upload ─────────────────────────────────────────────────────────────

const imageFiles = (list: FileList | null | undefined) =>
  Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));

// Uploads images as task attachments and inserts Markdown image links at the
// textarea cursor. Returns the props to spread on the textarea, plus a picker.
function useCommentImages(taskId: number, setText: (update: (text: string) => string) => void) {
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const insertImages = async (files: File[]) => {
    if (!files.length) return;
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart;
    const end = textarea?.selectionEnd;
    setUploading(true);
    try {
      const links: string[] = [];
      for (const file of files) {
        const attachment = await attachmentsApi.upload("task", taskId, file);
        links.push(`![${file.name.replace(/[[\]]/g, "")}](${attachmentsApi.getDownloadUrl(attachment.id)})`);
      }
      queryClient.invalidateQueries({ queryKey: ["attachments", "task", taskId] });
      setText((text) => {
        const from = start ?? text.length;
        return text.slice(0, from) + links.join("\n\n") + text.slice(end ?? from);
      });
    } finally {
      setUploading(false);
    }
  };

  const textareaProps = {
    ref: textareaRef,
    onPaste: (e: React.ClipboardEvent) => {
      const files = imageFiles(e.clipboardData.files);
      if (!files.length) return;
      e.preventDefault();
      insertImages(files);
    },
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      const files = imageFiles(e.dataTransfer.files);
      if (!files.length) return;
      e.preventDefault();
      insertImages(files);
    },
  };

  const picker = (
    <>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        title="Insert image (or paste / drop it in the text)"
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 disabled:opacity-50"
      >
        {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
        Image
      </button>
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
    </>
  );

  return { textareaProps, picker, uploading };
}

// ─── Individual comment component ────────────────────────────────────────────

function CommentItem({
  taskId,
  comment,
  currentUserId,
  onUpdate,
  onDelete,
  onTaskRefClick,
}: {
  taskId: number;
  comment: Comment;
  currentUserId: number;
  onUpdate: (body: string) => void;
  onDelete: () => void;
  onTaskRefClick?: (ref: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const isOwn = comment.authorId === currentUserId;
  const images = useCommentImages(taskId, setDraft);

  const commit = () => {
    if (draft.trim() && draft !== comment.body) onUpdate(draft.trim());
    setEditing(false);
  };

  return (
    <div className="flex gap-3 group">
      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
        {comment.author.name[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-gray-800">{comment.author.name}</span>
          <span className="text-xs text-gray-400">
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: fr })}
          </span>
          {comment.updatedAt !== comment.createdAt && (
            <span className="text-xs text-gray-300 italic">edited</span>
          )}
          {isOwn && !editing && (
            <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => { setDraft(comment.body); setEditing(true); }}
                className="p-1 text-gray-400 hover:text-indigo-600 rounded transition-colors"
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={onDelete}
                className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <div>
            <textarea
              {...images.textareaProps}
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); }
                if (e.key === "Escape") { setEditing(false); setDraft(comment.body); }
              }}
              rows={3}
              className="w-full text-sm border border-indigo-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={commit}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                <Check size={12} /> Save
              </button>
              <button
                onClick={() => { setEditing(false); setDraft(comment.body); }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
              >
                <X size={12} /> Cancel
              </button>
              <div className="ml-auto">{images.picker}</div>
            </div>
          </div>
        ) : (
          <CommentBody body={comment.body} onTaskRefClick={onTaskRefClick} />
        )}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function TaskActivity({ taskId, onTaskRefClick }: { taskId: number; onTaskRefClick?: (ref: string) => void }) {
  const [tab, setTab] = useState<Tab>("comments");
  const [newComment, setNewComment] = useState("");
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const images = useCommentImages(taskId, setNewComment);

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", taskId],
    queryFn: () => commentsApi.list(taskId),
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["activity", taskId],
    queryFn: () => commentsApi.activity(taskId),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { usersApi } = await import("@/api/users");
      return usersApi.list();
    },
  });

  const createComment = useMutation({
    mutationFn: (body: string) => commentsApi.create(taskId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", taskId] });
      queryClient.invalidateQueries({ queryKey: ["activity", taskId] });
      setNewComment("");
    },
  });

  const updateComment = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) => commentsApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", taskId] });
      queryClient.invalidateQueries({ queryKey: ["activity", taskId] });
    },
  });

  const deleteComment = useMutation({
    mutationFn: (id: number) => commentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", taskId] });
      queryClient.invalidateQueries({ queryKey: ["activity", taskId] });
    },
  });

  const submitComment = () => {
    if (!newComment.trim()) return;
    createComment.mutate(newComment.trim());
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Onglets */}
      <div className="flex items-center gap-1 border-b border-gray-100 pb-0">
        <button
          onClick={() => setTab("comments")}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === "comments"
              ? "border-indigo-500 text-indigo-600"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <MessageSquare size={14} />
          Comments
          {comments.length > 0 && (
            <span className="text-xs bg-indigo-100 text-indigo-600 rounded-full px-1.5 py-0.5 leading-none">
              {comments.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("history")}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === "history"
              ? "border-indigo-500 text-indigo-600"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <History size={14} />
          History
          {activity.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 leading-none">
              {activity.length}
            </span>
          )}
        </button>
      </div>

      {/* Commentaires */}
      {tab === "comments" && (
        <div className="flex flex-col gap-4">
          {/* Zone de saisie */}
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
              {user?.name[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1">
              <textarea
                {...images.textareaProps}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); }
                }}
                placeholder="Add a comment in Markdown… (Enter to send, Shift+Enter for a new line)"
                rows={newComment ? 3 : 1}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder-gray-300 transition-all"
              />
              {(newComment || images.uploading) && (
                <div className="flex items-center justify-end gap-3 mt-1.5">
                  {images.picker}
                  <button
                    onClick={submitComment}
                    disabled={createComment.isPending || images.uploading || !newComment.trim()}
                    className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    <Send size={11} />
                    Send
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Liste */}
          {comments.length === 0 ? (
            <p className="text-sm text-gray-300 text-center py-4">No comments</p>
          ) : (
            <div className="flex flex-col gap-4">
              {comments.map((c) => (
                <CommentItem
                  key={c.id}
                  taskId={taskId}
                  comment={c}
                  currentUserId={user?.id ?? -1}
                  onUpdate={(body) => updateComment.mutate({ id: c.id, body })}
                  onDelete={() => deleteComment.mutate(c.id)}
                  onTaskRefClick={onTaskRefClick}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Historique */}
      {tab === "history" && (
        <div className="flex flex-col gap-0">
          {activity.length === 0 ? (
            <p className="text-sm text-gray-300 text-center py-4">No events</p>
          ) : (
            <div className="relative">
              {/* Ligne verticale */}
              <div className="absolute left-3.5 top-2 bottom-2 w-px bg-gray-100" />

              <div className="flex flex-col gap-3">
                {activity.map((log) => (
                  <div key={log.id} className="flex gap-3 items-start relative">
                    <div className="w-7 h-7 rounded-full bg-white border-2 border-gray-200 text-sm flex items-center justify-center flex-shrink-0 z-10">
                      {ACTION_ICONS[log.action] ?? "•"}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <span className="text-sm text-gray-600">
                        <span className="font-semibold text-gray-800">{log.actor.name}</span>{" "}
                        {formatAction(log, users)}
                      </span>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: fr })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
