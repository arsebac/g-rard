import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { wikiApi, WikiPageSummary } from "@/api/wiki";
import { AppShell } from "@/components/layout/AppShell";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { BookOpen, ChevronRight, Plus, Trash2, X, Download, Upload, Home, Loader2, Eye, EyeOff } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ─── Sidebar tree ─────────────────────────────────────────────────────────────

interface PageTreeItemProps {
  page: WikiPageSummary;
  children: WikiPageSummary[];
  allPages: WikiPageSummary[];
  selectedId: number | null;
  depth: number;
  onSelect: (id: number) => void;
}

function PageTreeItem({ page, children, allPages, selectedId, depth, onSelect }: PageTreeItemProps) {
  const [open, setOpen] = useState(true);
  const hasChildren = children.length > 0;

  return (
    <li>
      <div
        className={`flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors group ${
          selectedId === page.id
            ? "bg-indigo-50 text-indigo-700 font-medium"
            : "text-gray-600 hover:bg-gray-100"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelect(page.id)}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
          >
            <ChevronRight
              size={12}
              className={`transition-transform ${open ? "rotate-90" : ""}`}
            />
          </button>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        <span className="truncate">{page.title}</span>
      </div>

      {hasChildren && open && (
        <ul>
          {children.map((child) => (
            <PageTreeItem
              key={child.id}
              page={child}
              children={allPages.filter((p) => p.parentId === child.id)}
              allPages={allPages}
              selectedId={selectedId}
              depth={depth + 1}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ─── New page modal ───────────────────────────────────────────────────────────

interface NewPageModalProps {
  pages: WikiPageSummary[];
  onClose: () => void;
  onCreate: (id: number) => void;
}

function NewPageModal({ pages, onClose, onCreate }: NewPageModalProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [parentId, setParentId] = useState<number | "">("");

  const createMutation = useMutation({
    mutationFn: wikiApi.create,
    onSuccess: (page) => {
      queryClient.invalidateQueries({ queryKey: ["wiki-pages"] });
      onCreate(page.id);
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createMutation.mutate({
      title: title.trim(),
      parentId: parentId !== "" ? Number(parentId) : null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Nouvelle page</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Titre *</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de la page…"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Page parente</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">— Aucune (racine) —</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !title.trim()}
              className="flex-1 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {createMutation.isPending ? "Création…" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Breadcrumbs ─────────────────────────────────────────────────────────────

function getBreadcrumbs(pages: WikiPageSummary[], currentId: number): WikiPageSummary[] {
  const breadcrumbs: WikiPageSummary[] = [];
  let current = pages.find((p) => p.id === currentId);
  while (current) {
    breadcrumbs.unshift(current);
    current = pages.find((p) => p.id === current.parentId);
  }
  return breadcrumbs;
}

function Breadcrumb({ items, onSelect }: { items: WikiPageSummary[], onSelect: (id: number) => void }) {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-4 overflow-x-auto whitespace-nowrap pb-1">
      <button 
        onClick={() => onSelect(-1)} 
        className="hover:text-indigo-600 transition-colors"
      >
        <Home size={12} />
      </button>
      {items.map((item, idx) => (
        <div key={item.id} className="flex items-center gap-1.5">
          <ChevronRight size={10} className="flex-shrink-0" />
          <button
            onClick={() => onSelect(item.id)}
            className={`hover:text-indigo-600 transition-colors ${
              idx === items.length - 1 ? "text-gray-600 font-medium" : ""
            }`}
          >
            {item.title}
          </button>
        </div>
      ))}
    </nav>
  );
}

// ─── Page content ─────────────────────────────────────────────────────────────

interface PageContentProps {
  pageId: number;
  allPages: WikiPageSummary[];
  onSelectPage: (id: number) => void;
}

function PageContent({ pageId, allPages, onSelectPage }: PageContentProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isReadOnly, setIsReadOnly] = useState(false);

  const { data: page, isLoading } = useQuery({
    queryKey: ["wiki-page", pageId],
    queryFn: () => wikiApi.get(pageId),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { title?: string; body?: string | null }) =>
      wikiApi.update(pageId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wiki-page", pageId] });
      queryClient.invalidateQueries({ queryKey: ["wiki-pages"] });
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => wikiApi.deleteWiki(pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wiki-pages"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Chargement…
      </div>
    );
  }

  if (!page) return null;

  const handleSaveBody = (html: string) => {
    updateMutation.mutate({ body: html });
  };

  const handleSaveTitle = () => {
    if (editTitle.trim() && editTitle.trim() !== page.title) {
      updateMutation.mutate({ title: editTitle.trim() });
    } else {
      setEditing(false);
    }
  };

  const handleDelete = () => {
    if (!confirm(`Supprimer la page "${page.title}" ?`)) return;
    deleteMutation.mutate();
    onSelectPage(-1);
  };

  const breadcrumbs = getBreadcrumbs(allPages, pageId);
  const children = allPages.filter((p) => p.parentId === pageId);

  return (
    <div className="flex-1 overflow-auto p-8 max-w-4xl">
      <Breadcrumb items={breadcrumbs} onSelect={onSelectPage} />

      {/* Titre */}
      <div className="mb-6">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveTitle();
                if (e.key === "Escape") setEditing(false);
              }}
              className="flex-1 text-2xl font-bold text-gray-900 border-b-2 border-indigo-400 outline-none bg-transparent py-1"
            />
            <button
              onClick={handleSaveTitle}
              className="px-3 py-1 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              OK
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <h1
              className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-indigo-700 transition-colors"
              onClick={() => { setEditTitle(page.title); setEditing(true); }}
              title="Cliquer pour modifier le titre"
            >
              {page.title}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => setIsReadOnly(!isReadOnly)}
                className={`p-1.5 rounded-lg transition-colors ${isReadOnly ? "text-indigo-600 bg-indigo-50" : "text-gray-400 hover:text-indigo-600"}`}
                title={isReadOnly ? "Passer en édition" : "Passer en aperçu"}
              >
                {isReadOnly ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <a
                href={wikiApi.getExportUrl(page.id)}
                download
                className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg transition-colors"
                title="Exporter en Markdown"
              >
                <Download size={16} />
              </a>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"
                title="Supprimer cette page"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-1">
          Modifié le{" "}
          {new Date(page.updatedAt).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          {page.creator ? ` par ${page.creator.name}` : ""}
        </p>
      </div>

      {/* Contenu */}
      {isReadOnly && page.contentType === "markdown" ? (
        <div className="gerard-prose">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {page.body ?? ""}
          </ReactMarkdown>
        </div>
      ) : (
        <RichTextEditor
          key={pageId}
          defaultValue={page.body ?? ""}
          onSave={handleSaveBody}
          placeholder="Écrivez le contenu de cette page…"
          readOnly={isReadOnly}
        />
      )}

      {/* Sous-pages */}
      {children.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Sous-pages
          </h2>
          <ul className="space-y-1">
            {children.map((child) => (
              <li key={child.id}>
                <button
                  onClick={() => onSelectPage(child.id)}
                  className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  <BookOpen size={14} />
                  {child.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}


// ─── Main WikiPage ────────────────────────────────────────────────────────────

export function WikiPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showNewPage, setShowNewPage] = useState(false);

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["wiki-pages"],
    queryFn: wikiApi.list,
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => wikiApi.importMd(file),
    onSuccess: (page) => {
      queryClient.invalidateQueries({ queryKey: ["wiki-pages"] });
      setSelectedId(page.id);
    },
  });

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importMutation.mutate(file);
      e.target.value = "";
    }
  };

  // Racines = pages sans parent
  const roots = pages.filter((p) => p.parentId === null);

  const handleSelectPage = (id: number) => {
    if (id === -1) {
      setSelectedId(null);
    } else {
      setSelectedId(id);
    }
  };

  return (
    <AppShell>
      <div className="flex h-full">
        {/* Sidebar wiki */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-indigo-500" />
              <span className="text-sm font-semibold text-gray-800">Wiki Flatulence</span>
            </div>
            <div className="flex items-center gap-1">
              <label className="p-1 text-gray-400 hover:text-indigo-600 cursor-pointer transition-colors" title="Importer Markdown">
                {importMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                <input type="file" className="hidden" accept=".md" onChange={handleImport} disabled={importMutation.isPending} />
              </label>
              <button
                onClick={() => setShowNewPage(true)}
                className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                title="Nouvelle page"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto py-2 px-2">
            {isLoading ? (
              <p className="text-xs text-gray-400 px-2 py-2">Chargement…</p>
            ) : pages.length === 0 ? (
              <p className="text-xs text-gray-400 px-2 py-2">Aucune page pour l'instant.</p>
            ) : (
              <ul>
                {roots.map((root) => (
                  <PageTreeItem
                    key={root.id}
                    page={root}
                    children={pages.filter((p) => p.parentId === root.id)}
                    allPages={pages}
                    selectedId={selectedId}
                    depth={0}
                    onSelect={handleSelectPage}
                  />
                ))}
              </ul>
            )}
          </nav>
        </aside>

        {/* Contenu principal */}
        {selectedId !== null && pages.some((p) => p.id === selectedId) ? (
          <PageContent
            key={selectedId}
            pageId={selectedId}
            allPages={pages}
            onSelectPage={handleSelectPage}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
              <BookOpen size={32} className="text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Bienvenue dans le wiki Flatulence
            </h2>
            <p className="text-sm text-gray-500 max-w-sm mb-6">
              Cet espace vous permet de documenter vos projets de rénovation.
              Sélectionnez une page dans la barre latérale ou créez-en une nouvelle.
            </p>
            <button
              onClick={() => setShowNewPage(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={16} />
              Créer la première page
            </button>
          </div>
        )}
      </div>

      {showNewPage && (
        <NewPageModal
          pages={pages}
          onClose={() => setShowNewPage(false)}
          onCreate={(id) => setSelectedId(id)}
        />
      )}
    </AppShell>
  );
}
