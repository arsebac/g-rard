import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "@/api/projects";
import { labelsApi } from "@/api/labels";
import { tasksApi, Task } from "@/api/tasks";
import { usersApi } from "@/api/users";
import { AppShell } from "@/components/layout/AppShell";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { TaskListView } from "@/components/task/TaskListView";
import { TaskDrawer } from "@/components/task/TaskDrawer";
import { TaskForm } from "@/components/task/TaskForm";
import {
  Plus,
  Settings,
  Search,
  Tag,
  ChevronDown,
  Check,
  Pencil,
  Trash2,
  X,
  Download,
  Paperclip,
  LayoutGrid,
  List,
  Layers,
  GitBranch,
} from "lucide-react";

// ─── Label manager (popover) ──────────────────────────────────────────────────

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#6366f1", "#a855f7", "#ec4899",
  "#64748b", "#0ea5e9",
];

function LabelManager({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.get(projectId),
  });
  const labels = project?.labels ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
  };

  const createLabel = useMutation({
    mutationFn: () => labelsApi.create(projectId, { name: name.trim(), color }),
    onSuccess: () => { invalidate(); setName(""); setColor(PRESET_COLORS[0]); },
  });

  const updateLabel = useMutation({
    mutationFn: (id: number) => labelsApi.update(id, { name: name.trim(), color }),
    onSuccess: () => { invalidate(); setEditId(null); setName(""); setColor(PRESET_COLORS[0]); },
  });

  const deleteLabel = useMutation({
    mutationFn: (id: number) => labelsApi.delete(id),
    onSuccess: invalidate,
  });

  const startEdit = (label: { id: number; name: string; color: string }) => {
    setEditId(label.id);
    setName(label.name);
    setColor(label.color);
  };

  const cancelEdit = () => { setEditId(null); setName(""); setColor(PRESET_COLORS[0]); };

  const submit = () => {
    if (!name.trim()) return;
    if (editId !== null) updateLabel.mutate(editId);
    else createLabel.mutate();
  };

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Labels</p>
      {labels.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-3">
          {labels.map((label) => (
            <div key={label.id} className="flex items-center gap-2 group">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: label.color }} />
              <span className="flex-1 text-sm text-gray-700">{label.name}</span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => startEdit(label)} className="p-1 text-gray-400 hover:text-indigo-600 rounded">
                  <Pencil size={11} />
                </button>
                <button onClick={() => deleteLabel.mutate(label.id)} className="p-1 text-gray-400 hover:text-red-500 rounded">
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-gray-100 pt-2">
        <p className="text-xs text-gray-400 mb-1.5">{editId !== null ? "Modifier" : "Nouveau label"}</p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") cancelEdit(); }}
          placeholder="Nom du label…"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
        />
        <div className="flex flex-wrap gap-1 mb-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-5 h-5 rounded-full transition-transform ${color === c ? "ring-2 ring-offset-1 ring-gray-400 scale-110" : "hover:scale-110"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Check size={11} />
            {editId !== null ? "Modifier" : "Créer"}
          </button>
          {editId !== null && (
            <button onClick={cancelEdit} className="text-xs text-gray-400 hover:text-gray-600">Annuler</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Config popover ───────────────────────────────────────────────────────────

function ConfigPopover({ projectId, onExport }: { projectId: number; onExport: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors"
        title="Paramètres du projet"
      >
        <Settings size={15} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-30 w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800">Paramètres du projet</h3>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>

          <LabelManager projectId={projectId} />

          <div className="border-t border-gray-100 mt-3 pt-3">
            <button
              onClick={() => { onExport(); setOpen(false); }}
              className="flex items-center gap-2 w-full text-sm text-gray-600 hover:text-indigo-600 py-1.5 rounded-lg transition-colors"
            >
              <Download size={14} />
              Exporter en CSV
            </button>
            <button
              className="flex items-center gap-2 w-full text-sm text-gray-600 hover:text-indigo-600 py-1.5 rounded-lg transition-colors"
            >
              <Paperclip size={14} />
              Documents du projet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Label dropdown filter ────────────────────────────────────────────────────

function LabelDropdown({
  labels,
  value,
  onChange,
}: {
  labels: { id: number; name: string; color: string }[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selected = labels.find((l) => l.id === value);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 text-sm border px-3 py-1.5 rounded-lg transition-colors ${
          value !== null
            ? "bg-indigo-50 border-indigo-300 text-indigo-700"
            : "text-gray-500 hover:text-gray-700 border-gray-200 hover:border-gray-300"
        }`}
      >
        <Tag size={13} />
        {selected ? (
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selected.color }} />
            {selected.name}
          </span>
        ) : (
          "Labels"
        )}
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-20 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1 overflow-hidden">
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors ${
              value === null ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            Tous les labels
          </button>
          {labels.map((label) => (
            <button
              key={label.id}
              onClick={() => { onChange(label.id); setOpen(false); }}
              className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors ${
                value === label.id ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: label.color }} />
              {label.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── User avatar pill ─────────────────────────────────────────────────────────

function UserAvatar({
  user,
  active,
  onClick,
}: {
  user: { id: number; name: string; avatarUrl?: string | null };
  active: boolean;
  onClick: () => void;
}) {
  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <button
      onClick={onClick}
      title={user.name}
      className={`relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ring-2 ${
        active ? "ring-indigo-500 ring-offset-1 opacity-100" : "ring-transparent opacity-60 hover:opacity-100"
      }`}
    >
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-full object-cover" />
      ) : (
        <span className="w-full h-full rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
          {initials}
        </span>
      )}
    </button>
  );
}

// ─── View tabs ────────────────────────────────────────────────────────────────

type ViewMode = "kanban" | "list" | "all" | "versions";

const VIEWS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
  { id: "kanban", label: "Tableau", icon: <LayoutGrid size={14} /> },
  { id: "list", label: "Liste", icon: <List size={14} /> },
  { id: "all", label: "Tous les tickets", icon: <Layers size={14} /> },
  { id: "versions", label: "Versions", icon: <GitBranch size={14} /> },
];

// ─── Page principale ──────────────────────────────────────────────────────────

interface FilterState {
  search: string;
  assigneeId: number | null;
  labelId: number | null;
}

const EMPTY_FILTERS: FilterState = { search: "", assigneeId: null, labelId: null };

export function ProjectPage() {
  const { projectId } = useParams({ from: "/projects/$projectId" });
  const id = parseInt(projectId);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTaskStatus, setNewTaskStatus] = useState("a_faire");
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: () => projectsApi.get(id),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list,
  });

  const { data: rawTasks = [], isLoading } = useQuery({
    queryKey: ["tasks", id, { labelId: filters.labelId, assigneeId: filters.assigneeId }],
    queryFn: () =>
      tasksApi.list(id, {
        ...(filters.labelId ? { labelId: filters.labelId } : {}),
        ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
      }),
  });

  // Client-side text search filter
  const tasks = useMemo(() => {
    if (!filters.search.trim()) return rawTasks;
    const q = filters.search.toLowerCase();
    return rawTasks.filter((t) => t.title.toLowerCase().includes(q));
  }, [rawTasks, filters.search]);

  // Users who have at least one task assigned in this project
  const projectUsers = useMemo(() => {
    const ids = new Set(rawTasks.map((t) => t.assigneeId).filter(Boolean));
    return allUsers.filter((u) => ids.has(u.id));
  }, [rawTasks, allUsers]);

  const labels = project?.labels ?? [];

  const handleAddTask = (status: string) => {
    setNewTaskStatus(status);
    setShowTaskForm(true);
  };

  const handleExportCsv = () => {
    window.open(`/api/projects/${id}/export/csv`, "_blank");
  };

  // Keyboard shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        handleAddTask("a_faire");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!project) return null;

  return (
    <AppShell>
      <div className="flex flex-col h-full">

        {/* ── Row 1 : titre + actions ───────────────────────────────────────── */}
        <div className="bg-white border-b border-gray-100 px-6 pt-5 pb-0 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            {/* Left: project name */}
            <div className="flex items-center gap-3">
              <span
                className="w-7 h-7 rounded-md flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ backgroundColor: project.color }}
              >
                {project.name[0].toUpperCase()}
              </span>
              <h1 className="text-lg font-semibold text-gray-900">{project.name}</h1>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAddTask("a_faire")}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
                title="Nouvelle tâche (N)"
              >
                <Plus size={14} />
                Créer
              </button>
              <ConfigPopover projectId={id} onExport={handleExportCsv} />
            </div>
          </div>

          {/* ── Row 2 : onglets de navigation ──────────────────────────────── */}
          <div className="flex items-end gap-0">
            {VIEWS.map((view) => (
              <button
                key={view.id}
                onClick={() => setViewMode(view.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  viewMode === view.id
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {view.icon}
                {view.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Row 3 : barre de filtres ──────────────────────────────────────── */}
        <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center gap-3 flex-shrink-0">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="Rechercher un ticket…"
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
            />
            {filters.search && (
              <button
                onClick={() => setFilters((f) => ({ ...f, search: "" }))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Separator */}
          {projectUsers.length > 0 && <div className="w-px h-5 bg-gray-200" />}

          {/* Assignee avatars */}
          {projectUsers.length > 0 && (
            <div className="flex items-center gap-1">
              {projectUsers.map((user) => (
                <UserAvatar
                  key={user.id}
                  user={user}
                  active={filters.assigneeId === user.id}
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      assigneeId: f.assigneeId === user.id ? null : user.id,
                    }))
                  }
                />
              ))}
            </div>
          )}

          {/* Separator */}
          {labels.length > 0 && <div className="w-px h-5 bg-gray-200" />}

          {/* Label dropdown */}
          {labels.length > 0 && (
            <LabelDropdown
              labels={labels}
              value={filters.labelId}
              onChange={(id) => setFilters((f) => ({ ...f, labelId: id }))}
            />
          )}

          {/* Active filter reset */}
          {(filters.search || filters.assigneeId !== null || filters.labelId !== null) && (
            <>
              <div className="w-px h-5 bg-gray-200" />
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
              >
                <X size={11} />
                Réinitialiser
              </button>
            </>
          )}
        </div>

        {/* ── Contenu principal ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="text-sm text-gray-400">Chargement...</div>
          ) : viewMode === "kanban" ? (
            <KanbanBoard
              tasks={tasks}
              projectId={id}
              onTaskClick={setSelectedTask}
              onAddTask={handleAddTask}
            />
          ) : viewMode === "list" ? (
            <TaskListView tasks={tasks} onTaskClick={setSelectedTask} />
          ) : viewMode === "all" ? (
            <TaskListView tasks={tasks} onTaskClick={setSelectedTask} />
          ) : (
            /* Versions — placeholder */
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
              <GitBranch size={32} className="opacity-30" />
              <p className="text-sm">La gestion des versions arrive bientôt.</p>
            </div>
          )}
        </div>
      </div>

      {selectedTask && (
        <TaskDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}

      {showTaskForm && (
        <TaskForm
          projectId={id}
          defaultStatus={newTaskStatus}
          onClose={() => setShowTaskForm(false)}
        />
      )}
    </AppShell>
  );
}
