import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { documentsApi, DocumentSpace, Document, DocumentSpaceMemberRole } from "@/api/documents";
import { usersApi } from "@/api/users";
import { useAuthStore } from "@/store/auth";
import { AppShell } from "@/components/layout/AppShell";
import {
  FolderOpen,
  Plus,
  Trash2,
  Download,
  Upload,
  ChevronRight,
  FileText,
  Pencil,
  X,
  FolderPlus,
  Share2,
  Crown,
  Eye,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const COLOR_OPTIONS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6",
];

function RoleIcon({ role }: { role: DocumentSpaceMemberRole }) {
  if (role === "owner") return <Crown size={12} className="text-yellow-500" />;
  if (role === "editor") return <ShieldCheck size={12} className="text-indigo-500" />;
  return <Eye size={12} className="text-gray-400" />;
}

function roleLabel(role: DocumentSpaceMemberRole, t: (k: string) => string) {
  return t(`documents.roles.${role}`);
}

function isImageType(mimeType: string) {
  return mimeType.startsWith("image/");
}

function isPdfType(mimeType: string) {
  return mimeType === "application/pdf";
}

function isMarkdownType(mimeType: string, filename: string) {
  return mimeType.includes("markdown") || filename.toLowerCase().endsWith(".md");
}

// ─── Share modal ──────────────────────────────────────────────────────────────

interface ShareModalProps {
  space: DocumentSpace;
  currentUserId: number;
  onClose: () => void;
}

function ShareModal({ space, currentUserId, onClose }: ShareModalProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<number | "">("");
  const [selectedRole, setSelectedRole] = useState<"editor" | "viewer">("viewer");

  const { data: members = [] } = useQuery({
    queryKey: ["document-space-members", space.id],
    queryFn: () => documentsApi.listMembers(space.id),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list,
  });

  const memberUserIds = new Set(members.map((m) => m.userId));
  const invitableUsers = allUsers.filter((u) => !memberUserIds.has(u.id));

  const addMember = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: "editor" | "viewer" }) =>
      documentsApi.addMember(space.id, userId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["document-space-members", space.id] });
      qc.invalidateQueries({ queryKey: ["document-spaces"] });
      setSelectedUserId("");
    },
  });

  const updateMember = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: "editor" | "viewer" }) =>
      documentsApi.updateMember(space.id, userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["document-space-members", space.id] }),
  });

  const removeMember = useMutation({
    mutationFn: (userId: number) => documentsApi.removeMember(space.id, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["document-space-members", space.id] });
      qc.invalidateQueries({ queryKey: ["document-spaces"] });
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">{t("documents.share.title")}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{space.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              {t("documents.share.members")}
            </p>
            <ul className="space-y-1.5">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-semibold flex-shrink-0">
                    {m.user.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.user.name}</p>
                    <p className="text-xs text-gray-400 truncate">{m.user.email}</p>
                  </div>
                  {m.role === "owner" ? (
                    <span className="flex items-center gap-1 text-xs text-yellow-600 font-medium">
                      <Crown size={12} />
                      {roleLabel("owner", t)}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <select
                        value={m.role}
                        onChange={(e) =>
                          updateMember.mutate({ userId: m.userId, role: e.target.value as "editor" | "viewer" })
                        }
                        className="text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      >
                        <option value="editor">{roleLabel("editor", t)}</option>
                        <option value="viewer">{roleLabel("viewer", t)}</option>
                      </select>
                      {m.userId !== currentUserId && (
                        <button
                          onClick={() => removeMember.mutate(m.userId)}
                          disabled={removeMember.isPending}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          title={t("documents.share.remove")}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {invitableUsers.length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {t("documents.share.invite")}
              </p>
              <div className="flex gap-2">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value === "" ? "" : parseInt(e.target.value))}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">{t("documents.share.selectUser")}</option>
                  {invitableUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as "editor" | "viewer")}
                  className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="editor">{roleLabel("editor", t)}</option>
                  <option value="viewer">{roleLabel("viewer", t)}</option>
                </select>
                <button
                  onClick={() => {
                    if (selectedUserId !== "") {
                      addMember.mutate({ userId: selectedUserId as number, role: selectedRole });
                    }
                  }}
                  disabled={selectedUserId === "" || addMember.isPending}
                  className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  title={t("documents.share.addMember")}
                >
                  <UserPlus size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Space tree item ───────────────────────────────────────────────────────────

interface SpaceTreeItemProps {
  space: DocumentSpace;
  children: DocumentSpace[];
  selectedId: number | null;
  depth: number;
  currentUserId: number;
  onSelect: (id: number) => void;
  onDelete: (space: DocumentSpace) => void;
  onAddChild: (parentId: number) => void;
  onRename: (space: DocumentSpace) => void;
  onShare: (space: DocumentSpace) => void;
}

function SpaceTreeItem({
  space,
  children,
  selectedId,
  depth,
  currentUserId,
  onSelect,
  onDelete,
  onAddChild,
  onRename,
  onShare,
}: SpaceTreeItemProps) {
  const [open, setOpen] = useState(true);
  const hasChildren = children.length > 0;
  const isSelected = selectedId === space.id;
  const { t } = useTranslation();

  const myMembership = space.members?.find((m) => m.userId === currentUserId);
  const isOwner = myMembership?.role === "owner";
  const canWrite = isOwner || myMembership?.role === "editor";

  return (
    <li>
      <div
        className={`flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors group ${
          isSelected ? "bg-indigo-50 text-indigo-700 font-medium" : "text-gray-600 hover:bg-gray-100"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelect(space.id)}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
          >
            <ChevronRight size={12} className={`transition-transform ${open ? "rotate-90" : ""}`} />
          </button>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: space.color }} />
        <span className="truncate flex-1">{space.name}</span>

        {myMembership && (
          <span className="opacity-40 group-hover:opacity-100 flex-shrink-0">
            <RoleIcon role={myMembership.role} />
          </span>
        )}

        <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {isOwner && depth === 0 && (
            <button
              type="button"
              title={t("documents.share.title")}
              className="p-0.5 hover:text-indigo-600"
              onClick={(e) => { e.stopPropagation(); onShare(space); }}
            >
              <Share2 size={12} />
            </button>
          )}
          {canWrite && depth === 0 && (
            <button
              type="button"
              title={t("documents.addSubfolder")}
              className="p-0.5 hover:text-indigo-600"
              onClick={(e) => { e.stopPropagation(); onAddChild(space.id); }}
            >
              <FolderPlus size={12} />
            </button>
          )}
          {canWrite && (
            <button
              type="button"
              title={t("common.edit")}
              className="p-0.5 hover:text-indigo-600"
              onClick={(e) => { e.stopPropagation(); onRename(space); }}
            >
              <Pencil size={12} />
            </button>
          )}
          {isOwner && (
            <button
              type="button"
              title={t("common.delete")}
              className="p-0.5 hover:text-red-600"
              onClick={(e) => { e.stopPropagation(); onDelete(space); }}
            >
              <Trash2 size={12} />
            </button>
          )}
        </span>
      </div>

      {hasChildren && open && (
        <ul>
          {children.map((child) => (
            <SpaceTreeItem
              key={child.id}
              space={child}
              children={[]}
              selectedId={selectedId}
              depth={depth + 1}
              currentUserId={currentUserId}
              onSelect={onSelect}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onRename={onRename}
              onShare={onShare}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ─── Space modal (create / edit) ──────────────────────────────────────────────

interface SpaceModalProps {
  mode: "create" | "edit";
  parentId?: number | null;
  initial?: DocumentSpace;
  onClose: () => void;
  onSave: (data: { name: string; color: string; description: string }) => void;
  isPending: boolean;
}

function SpaceModal({ mode, parentId, initial, onClose, onSave, isPending }: SpaceModalProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? "#6366f1");
  const [description, setDescription] = useState(initial?.description ?? "");
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            {mode === "create"
              ? parentId ? t("documents.newSubfolder") : t("documents.newSpace")
              : t("documents.editSpace")}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("documents.spaceName")} *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder={t("documents.spaceNamePlaceholder")}
              onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onSave({ name: name.trim(), color, description }); }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("documents.color")}</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${color === c ? "border-gray-900 scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("documents.description")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              placeholder={t("documents.descriptionPlaceholder")}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            {t("common.cancel")}
          </button>
          <button
            onClick={() => name.trim() && onSave({ name: name.trim(), color, description })}
            disabled={!name.trim() || isPending}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Upload modal ──────────────────────────────────────────────────────────────

interface UploadModalProps {
  file: File;
  onClose: () => void;
  onUpload: (title: string, description: string) => void;
  isPending: boolean;
}

function UploadModal({ file, onClose, onUpload, isPending }: UploadModalProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(file.name.replace(/\.[^.]+$/, ""));
  const [description, setDescription] = useState("");

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{t("documents.upload")}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-400 truncate flex items-center gap-1.5">
            <FileText size={13} />
            {file.name}
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("documents.titleLabel")} *</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) onUpload(title.trim(), description); }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("documents.description")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              placeholder={t("documents.descriptionPlaceholder")}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            {t("common.cancel")}
          </button>
          <button
            onClick={() => title.trim() && onUpload(title.trim(), description)}
            disabled={!title.trim() || isPending}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Upload size={14} />
            {isPending ? t("documents.uploading") : t("documents.upload")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Document viewer modal ─────────────────────────────────────────────────────

interface DocumentViewerModalProps {
  doc: Document;
  canWrite: boolean;
  onClose: () => void;
  onUpdate: (id: number, data: { title?: string; description?: string | null }) => void;
  isPending: boolean;
}

function DocumentViewerModal({ doc, canWrite, onClose, onUpdate, isPending }: DocumentViewerModalProps) {
  const { t } = useTranslation();
  const [editingDesc, setEditingDesc] = useState(false);
  const [description, setDescription] = useState(doc.description ?? "");
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);
  const [markdownLoading, setMarkdownLoading] = useState(false);

  const isImage = isImageType(doc.mimeType);
  const isPdf = isPdfType(doc.mimeType);
  const isMarkdown = isMarkdownType(doc.mimeType, doc.filename);
  const previewUrl = documentsApi.getPreviewUrl(doc.id);

  useEffect(() => {
    if (!isMarkdown) return;
    setMarkdownLoading(true);
    fetch(previewUrl, { credentials: "include" })
      .then((r) => r.text())
      .then(setMarkdownContent)
      .finally(() => setMarkdownLoading(false));
  }, [isMarkdown, previewUrl]);

  const handleSaveDesc = () => {
    onUpdate(doc.id, { description: description.trim() || null });
    setEditingDesc(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <h2 className="font-semibold text-gray-900 truncate flex-1 mr-4">{doc.title}</h2>
        <div className="flex items-center gap-3 flex-shrink-0">
          <a
            href={documentsApi.getDownloadUrl(doc.id)}
            download={doc.filename}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download size={14} />
            {t("documents.download")}
          </a>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors"
            title={t("common.close")}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Preview area */}
        <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center">
          {isImage && (
            <img
              src={previewUrl}
              alt={doc.title}
              className="max-h-full max-w-full object-contain rounded shadow"
            />
          )}
          {isPdf && (
            <iframe
              src={previewUrl}
              title={doc.title}
              className="w-full h-full border-0"
            />
          )}
          {isMarkdown && (
            markdownLoading ? (
              <p className="text-sm text-gray-400">{t("common.loading")}</p>
            ) : markdownContent !== null ? (
              <div className="w-full h-full overflow-auto bg-white">
                <div className="max-w-3xl mx-auto px-8 py-8 gerard-prose">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdownContent}</ReactMarkdown>
                </div>
              </div>
            ) : null
          )}
          {!isImage && !isPdf && !isMarkdown && (
            <div className="text-center">
              <FileText size={52} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">{t("documents.noPreview")}</p>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="w-72 border-l border-gray-200 bg-white overflow-y-auto p-5 space-y-6 flex-shrink-0">
          {/* File info */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              {t("documents.fileInfo")}
            </p>
            <dl className="space-y-1.5 text-sm">
              <div>
                <dt className="text-xs text-gray-400">Fichier</dt>
                <dd className="text-gray-700 break-all">{doc.filename}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Taille</dt>
                <dd className="text-gray-700">{formatBytes(doc.sizeBytes)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Ajouté le</dt>
                <dd className="text-gray-700">{formatDate(doc.createdAt)}</dd>
              </div>
              {doc.uploader && (
                <div>
                  <dt className="text-xs text-gray-400">Par</dt>
                  <dd className="text-gray-700">{doc.uploader.name}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {t("documents.description")}
              </p>
              {canWrite && !editingDesc && (
                <button
                  onClick={() => setEditingDesc(true)}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  {t("common.edit")}
                </button>
              )}
            </div>
            {editingDesc ? (
              <div className="space-y-2">
                <textarea
                  autoFocus
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  placeholder={t("documents.descriptionPlaceholder")}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveDesc}
                    disabled={isPending}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {t("common.save")}
                  </button>
                  <button
                    onClick={() => { setEditingDesc(false); setDescription(doc.description ?? ""); }}
                    className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {doc.description || (
                  <span className="text-gray-400 italic">{t("documents.noDescription")}</span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Document row ──────────────────────────────────────────────────────────────

interface DocumentRowProps {
  doc: Document;
  canDelete: boolean;
  onDelete: (doc: Document) => void;
  onView: (doc: Document) => void;
}

function DocumentRow({ doc, canDelete, onDelete, onView }: DocumentRowProps) {
  const { t } = useTranslation();
  const isImage = isImageType(doc.mimeType);
  const isPdf = isPdfType(doc.mimeType);
  const isMarkdown = isMarkdownType(doc.mimeType, doc.filename);
  const canPreview = isImage || isPdf || isMarkdown;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg group transition-colors cursor-pointer"
      onClick={() => onView(doc)}
    >
      <FileText size={18} className={`flex-shrink-0 ${canPreview ? "text-indigo-400" : "text-gray-400"}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
        {doc.description && (
          <p className="text-xs text-gray-500 truncate">{doc.description}</p>
        )}
        <p className="text-xs text-gray-400 mt-0.5">
          {doc.filename} · {formatBytes(doc.sizeBytes)} · {formatDate(doc.createdAt)}
          {doc.uploader && ` · ${doc.uploader.name}`}
        </p>
      </div>
      <div
        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <a
          href={documentsApi.getDownloadUrl(doc.id)}
          download={doc.filename}
          className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors"
          title={t("documents.download")}
        >
          <Download size={15} />
        </a>
        {canDelete && (
          <button
            type="button"
            onClick={() => onDelete(doc)}
            className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
            title={t("common.delete")}
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function DocumentsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();

  const [selectedSpaceId, setSelectedSpaceId] = useState<number | null>(null);
  const [spaceModal, setSpaceModal] = useState<{
    mode: "create" | "edit";
    parentId?: number | null;
    initial?: DocumentSpace;
  } | null>(null);
  const [shareTarget, setShareTarget] = useState<DocumentSpace | null>(null);
  const [deleteSpaceTarget, setDeleteSpaceTarget] = useState<DocumentSpace | null>(null);
  const [deleteDocTarget, setDeleteDocTarget] = useState<Document | null>(null);
  const [viewTarget, setViewTarget] = useState<Document | null>(null);
  const [pendingUpload, setPendingUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: spaces = [], isLoading: spacesLoading } = useQuery({
    queryKey: ["document-spaces"],
    queryFn: documentsApi.listSpaces,
  });

  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ["documents", selectedSpaceId],
    queryFn: () => documentsApi.listDocuments(selectedSpaceId!),
    enabled: selectedSpaceId !== null,
  });

  const createSpace = useMutation({
    mutationFn: documentsApi.createSpace,
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["document-spaces"] });
      setSpaceModal(null);
      if (!created.parentId) setSelectedSpaceId(created.id);
    },
  });

  const updateSpace = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof documentsApi.updateSpace>[1] }) =>
      documentsApi.updateSpace(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["document-spaces"] });
      setSpaceModal(null);
    },
  });

  const deleteSpace = useMutation({
    mutationFn: (id: number) => documentsApi.deleteSpace(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["document-spaces"] });
      if (deleteSpaceTarget?.id === selectedSpaceId) setSelectedSpaceId(null);
      setDeleteSpaceTarget(null);
    },
  });

  const deleteDocument = useMutation({
    mutationFn: (id: number) => documentsApi.deleteDocument(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", selectedSpaceId] });
      setDeleteDocTarget(null);
    },
  });

  const updateDocument = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { title?: string; description?: string | null } }) =>
      documentsApi.updateDocument(id, data),
    onSuccess: (updated) => {
      qc.setQueryData(["documents", selectedSpaceId], (old: Document[] | undefined) =>
        old?.map((d) => (d.id === updated.id ? updated : d)) ?? []
      );
      setViewTarget((prev) => (prev?.id === updated.id ? updated : prev));
    },
  });

  const handleSaveSpace = (data: { name: string; color: string; description: string }) => {
    if (!spaceModal) return;
    if (spaceModal.mode === "create") {
      createSpace.mutate({ name: data.name, color: data.color, description: data.description || null, parentId: spaceModal.parentId ?? null });
    } else if (spaceModal.initial) {
      updateSpace.mutate({ id: spaceModal.initial.id, data: { name: data.name, color: data.color, description: data.description || null } });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || selectedSpaceId === null) return;
    setPendingUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async (title: string, description: string) => {
    if (!pendingUpload || selectedSpaceId === null) return;
    setIsUploading(true);
    try {
      await documentsApi.upload(selectedSpaceId, pendingUpload, title, description || undefined);
      qc.invalidateQueries({ queryKey: ["documents", selectedSpaceId] });
      setPendingUpload(null);
    } finally {
      setIsUploading(false);
    }
  };

  const topLevelSpaces = spaces.filter((s) => s.parentId === null);
  const selectedSpace = selectedSpaceId !== null ? spaces.find((s) => s.id === selectedSpaceId) : null;

  const selectedTopLevelId = selectedSpace?.parentId ?? selectedSpace?.id ?? null;
  const selectedTopLevel = selectedTopLevelId ? spaces.find((s) => s.id === selectedTopLevelId) : null;
  const myRole = selectedTopLevel?.members?.find((m) => m.userId === user?.id)?.role ?? null;
  const canWrite = myRole === "owner" || myRole === "editor";

  return (
    <AppShell>
      <div className="flex h-full">
        {/* Sidebar */}
        <aside className="w-56 border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {t("documents.spaces")}
            </span>
            <button
              type="button"
              onClick={() => setSpaceModal({ mode: "create", parentId: null })}
              className="text-gray-400 hover:text-indigo-600 transition-colors"
              title={t("documents.newSpace")}
            >
              <Plus size={14} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-2 px-2">
            {spacesLoading ? (
              <p className="text-xs text-gray-400 px-2 py-4 text-center">{t("common.loading")}</p>
            ) : topLevelSpaces.length === 0 ? (
              <p className="text-xs text-gray-400 px-2 py-4 text-center">{t("documents.noSpaces")}</p>
            ) : (
              <ul>
                {topLevelSpaces.map((space) => (
                  <SpaceTreeItem
                    key={space.id}
                    space={space}
                    children={spaces.filter((s) => s.parentId === space.id)}
                    selectedId={selectedSpaceId}
                    depth={0}
                    currentUserId={user?.id ?? 0}
                    onSelect={setSelectedSpaceId}
                    onDelete={setDeleteSpaceTarget}
                    onAddChild={(parentId) => setSpaceModal({ mode: "create", parentId })}
                    onRename={(s) => setSpaceModal({ mode: "edit", initial: s })}
                    onShare={setShareTarget}
                  />
                ))}
              </ul>
            )}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto min-w-0 bg-gray-50">
          {!selectedSpace ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <FolderOpen size={48} className="text-gray-300 mb-4" />
              <h2 className="text-lg font-semibold text-gray-700 mb-1">{t("documents.welcome.title")}</h2>
              <p className="text-sm text-gray-400 max-w-sm">{t("documents.welcome.description")}</p>
              <button
                onClick={() => setSpaceModal({ mode: "create", parentId: null })}
                className="mt-5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {t("documents.welcome.createFirst")}
              </button>
            </div>
          ) : (
            <div className="p-6 max-w-4xl mx-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span className="w-4 h-4 rounded-full" style={{ backgroundColor: selectedSpace.color }} />
                  <h1 className="text-xl font-bold text-gray-900">{selectedSpace.name}</h1>
                  {selectedSpace.description && (
                    <span className="text-sm text-gray-500">{selectedSpace.description}</span>
                  )}
                  {myRole && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-500">
                      <RoleIcon role={myRole} />
                      {roleLabel(myRole, t)}
                    </span>
                  )}
                </div>
                {canWrite && (
                  <div className="flex items-center gap-2">
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      <Upload size={14} />
                      {t("documents.upload")}
                    </button>
                  </div>
                )}
              </div>

              {/* Members summary (top-level only) */}
              {!selectedSpace.parentId && selectedTopLevel?.members && selectedTopLevel.members.length > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex -space-x-1.5">
                    {selectedTopLevel.members.slice(0, 5).map((m) => (
                      <div
                        key={m.userId}
                        title={`${m.user.name} (${roleLabel(m.role, t)})`}
                        className="w-6 h-6 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-indigo-700 text-xs font-semibold"
                      >
                        {m.user.name[0]?.toUpperCase()}
                      </div>
                    ))}
                  </div>
                  {myRole === "owner" && (
                    <button
                      onClick={() => setShareTarget(selectedTopLevel)}
                      className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                    >
                      <Share2 size={12} />
                      {t("documents.share.manage")}
                    </button>
                  )}
                </div>
              )}

              {/* Documents list */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {docsLoading ? (
                  <p className="text-sm text-gray-400 text-center py-12">{t("common.loading")}</p>
                ) : documents.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText size={36} className="text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">{t("documents.noDocuments")}</p>
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-3 text-sm text-indigo-600 hover:underline"
                      >
                        {t("documents.uploadFirst")}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {documents.map((doc) => (
                      <DocumentRow
                        key={doc.id}
                        doc={doc}
                        canDelete={canWrite}
                        onDelete={setDeleteDocTarget}
                        onView={setViewTarget}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      {spaceModal && (
        <SpaceModal
          mode={spaceModal.mode}
          parentId={spaceModal.parentId}
          initial={spaceModal.initial}
          onClose={() => setSpaceModal(null)}
          onSave={handleSaveSpace}
          isPending={createSpace.isPending || updateSpace.isPending}
        />
      )}

      {shareTarget && (
        <ShareModal
          space={shareTarget}
          currentUserId={user?.id ?? 0}
          onClose={() => setShareTarget(null)}
        />
      )}

      {pendingUpload && (
        <UploadModal
          file={pendingUpload}
          onClose={() => setPendingUpload(null)}
          onUpload={handleUpload}
          isPending={isUploading}
        />
      )}

      {viewTarget && (
        <DocumentViewerModal
          doc={viewTarget}
          canWrite={canWrite}
          onClose={() => setViewTarget(null)}
          onUpdate={(id, data) => updateDocument.mutate({ id, data })}
          isPending={updateDocument.isPending}
        />
      )}

      {deleteSpaceTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-2">{t("documents.confirmDeleteSpace")}</h2>
            <p className="text-sm text-gray-500 mb-5">
              {t("documents.confirmDeleteSpaceBody", { name: deleteSpaceTarget.name })}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteSpaceTarget(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                {t("common.cancel")}
              </button>
              <button
                onClick={() => deleteSpace.mutate(deleteSpaceTarget.id)}
                disabled={deleteSpace.isPending}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteDocTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-2">{t("documents.confirmDeleteDoc")}</h2>
            <p className="text-sm text-gray-500 mb-5">{deleteDocTarget.title}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteDocTarget(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                {t("common.cancel")}
              </button>
              <button
                onClick={() => deleteDocument.mutate(deleteDocTarget.id)}
                disabled={deleteDocument.isPending}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
