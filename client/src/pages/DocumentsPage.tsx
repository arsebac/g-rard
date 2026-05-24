import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { documentsApi, DocumentSpace, Document } from "@/api/documents";
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
} from "lucide-react";
import { useTranslation } from "react-i18next";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const COLOR_OPTIONS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6",
];

// ─── Space tree item ───────────────────────────────────────────────────────────

interface SpaceTreeItemProps {
  space: DocumentSpace;
  children: DocumentSpace[];
  selectedId: number | null;
  depth: number;
  onSelect: (id: number) => void;
  onDelete: (space: DocumentSpace) => void;
  onAddChild: (parentId: number) => void;
  onRename: (space: DocumentSpace) => void;
}

function SpaceTreeItem({
  space,
  children,
  selectedId,
  depth,
  onSelect,
  onDelete,
  onAddChild,
  onRename,
}: SpaceTreeItemProps) {
  const [open, setOpen] = useState(true);
  const hasChildren = children.length > 0;
  const isSelected = selectedId === space.id;
  const { t } = useTranslation();

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
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: space.color }}
        />
        <span className="truncate flex-1">{space.name}</span>
        <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
          {depth === 0 && (
            <button
              type="button"
              title={t("documents.addSubfolder")}
              className="p-0.5 hover:text-indigo-600"
              onClick={(e) => { e.stopPropagation(); onAddChild(space.id); }}
            >
              <FolderPlus size={12} />
            </button>
          )}
          <button
            type="button"
            title={t("common.edit")}
            className="p-0.5 hover:text-indigo-600"
            onClick={(e) => { e.stopPropagation(); onRename(space); }}
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            title={t("common.delete")}
            className="p-0.5 hover:text-red-600"
            onClick={(e) => { e.stopPropagation(); onDelete(space); }}
          >
            <Trash2 size={12} />
          </button>
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
              onSelect={onSelect}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onRename={onRename}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ─── New / Edit space modal ────────────────────────────────────────────────────

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
              ? parentId
                ? t("documents.newSubfolder")
                : t("documents.newSpace")
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
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${
                    color === c ? "border-gray-900 scale-110" : "border-transparent"
                  }`}
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
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
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

// ─── Document row ──────────────────────────────────────────────────────────────

interface DocumentRowProps {
  doc: Document;
  onDelete: (doc: Document) => void;
}

function DocumentRow({ doc, onDelete }: DocumentRowProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg group transition-colors">
      <FileText size={18} className="text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
        {doc.description && (
          <p className="text-xs text-gray-500 truncate">{doc.description}</p>
        )}
        <p className="text-xs text-gray-400 mt-0.5">
          {doc.filename} · {formatDate(doc.createdAt)}
          {doc.uploader && ` · ${doc.uploader.name}`}
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <a
          href={documentsApi.getDownloadUrl(doc.id)}
          download={doc.filename}
          className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors"
          title={t("documents.download")}
        >
          <Download size={15} />
        </a>
        <button
          type="button"
          onClick={() => onDelete(doc)}
          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
          title={t("common.delete")}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function DocumentsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedSpaceId, setSelectedSpaceId] = useState<number | null>(null);
  const [spaceModal, setSpaceModal] = useState<{
    mode: "create" | "edit";
    parentId?: number | null;
    initial?: DocumentSpace;
  } | null>(null);
  const [deleteSpaceTarget, setDeleteSpaceTarget] = useState<DocumentSpace | null>(null);
  const [deleteDocTarget, setDeleteDocTarget] = useState<Document | null>(null);
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["document-spaces"] });
      setSpaceModal(null);
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

  const handleSaveSpace = (data: { name: string; color: string; description: string }) => {
    if (!spaceModal) return;
    if (spaceModal.mode === "create") {
      createSpace.mutate({
        name: data.name,
        color: data.color,
        description: data.description || null,
        parentId: spaceModal.parentId ?? null,
      });
    } else if (spaceModal.initial) {
      updateSpace.mutate({
        id: spaceModal.initial.id,
        data: { name: data.name, color: data.color, description: data.description || null },
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || selectedSpaceId === null) return;
    setIsUploading(true);
    try {
      await documentsApi.upload(selectedSpaceId, file);
      qc.invalidateQueries({ queryKey: ["documents", selectedSpaceId] });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const topLevelSpaces = spaces.filter((s) => s.parentId === null);
  const selectedSpace = selectedSpaceId !== null ? spaces.find((s) => s.id === selectedSpaceId) : null;

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
                    onSelect={setSelectedSpaceId}
                    onDelete={setDeleteSpaceTarget}
                    onAddChild={(parentId) => setSpaceModal({ mode: "create", parentId })}
                    onRename={(s) => setSpaceModal({ mode: "edit", initial: s })}
                  />
                ))}
              </ul>
            )}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto min-w-0 bg-gray-50">
          {selectedSpace === undefined || selectedSpaceId === null ? (
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
                  <span
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: selectedSpace!.color }}
                  />
                  <h1 className="text-xl font-bold text-gray-900">{selectedSpace!.name}</h1>
                  {selectedSpace!.description && (
                    <span className="text-sm text-gray-500">{selectedSpace!.description}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={isUploading}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    <Upload size={14} />
                    {isUploading ? t("documents.uploading") : t("documents.upload")}
                  </button>
                </div>
              </div>

              {/* Documents list */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {docsLoading ? (
                  <p className="text-sm text-gray-400 text-center py-12">{t("common.loading")}</p>
                ) : documents.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText size={36} className="text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">{t("documents.noDocuments")}</p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-3 text-sm text-indigo-600 hover:underline"
                    >
                      {t("documents.uploadFirst")}
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {documents.map((doc) => (
                      <DocumentRow key={doc.id} doc={doc} onDelete={setDeleteDocTarget} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Space modal */}
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

      {/* Delete space confirm */}
      {deleteSpaceTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-2">{t("documents.confirmDeleteSpace")}</h2>
            <p className="text-sm text-gray-500 mb-5">
              {t("documents.confirmDeleteSpaceBody", { name: deleteSpaceTarget.name })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteSpaceTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
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

      {/* Delete document confirm */}
      {deleteDocTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-2">{t("documents.confirmDeleteDoc")}</h2>
            <p className="text-sm text-gray-500 mb-5">{deleteDocTarget.title}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteDocTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
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
