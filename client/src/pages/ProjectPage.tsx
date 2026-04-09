import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "@/api/projects";
import { labelsApi } from "@/api/labels";
import { tasksApi, Task } from "@/api/tasks";
import { AppShell } from "@/components/layout/AppShell";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { TaskListView } from "@/components/task/TaskListView";
import { TaskDrawer } from "@/components/task/TaskDrawer";
import { TaskForm } from "@/components/task/TaskForm";
import {
  Plus,
  LayoutGrid,
  List,
  Tag,
  X,
  Check,
  Pencil,
  Trash2,
  FileText,
  Paperclip,
} from "lucide-react";
import { AttachmentList } from "@/components/ui/AttachmentList";

// ─── Label manager (popover) ──────────────────────────────────────────────────

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#6366f1", "#a855f7", "#ec4899",
  "#64748b", "#0ea5e9",
];

function LabelManager({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
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

  const cancelEdit = () => {
    setEditId(null);
    setName("");
    setColor(PRESET_COLORS[0]);
  };

  const submit = () => {
    if (!name.trim()) return;
    if (editId !== null) updateLabel.mutate(editId);
    else createLabel.mutate();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300 px-3 py-1.5 rounded-lg transition-colors"
      >
        <Tag size={14} />
        Labels
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); cancelEdit(); }} />
          <div className="absolute right-0 top-full mt-2 z-20 w-80 bg-white border border-gray-200 rounded-xl shadow-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800">Gérer les labels</h3>
              <button onClick={() => { setOpen(false); cancelEdit(); }} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            </div>

            {/* Existing labels */}
            {labels.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-3">
                {labels.map((label) => (
                  <div key={label.id} className="flex items-center gap-2 group">
                    <span
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: label.color }}
                    />
                    <span className="flex-1 text-sm text-gray-700">{label.name}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(label)}
                        className="p-1 text-gray-400 hover:text-indigo-600 rounded"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => deleteLabel.mutate(label.id)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Form */}
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-gray-500 mb-2">
                {editId !== null ? "Modifier le label" : "Nouveau label"}
              </p>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") cancelEdit(); }}
                placeholder="Nom du label…"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />
              <div className="flex flex-wrap gap-1.5 mb-3">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full transition-transform ${color === c ? "ring-2 ring-offset-1 ring-gray-400 scale-110" : "hover:scale-110"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={submit}
                  disabled={!name.trim()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <Check size={12} />
                  {editId !== null ? "Modifier" : "Créer"}
                </button>
                {editId !== null && (
                  <button
                    onClick={cancelEdit}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

type ViewMode = "kanban" | "list" | "documents";

export function ProjectPage() {
  const { projectId } = useParams({ from: "/projects/$projectId" });
  const id = parseInt(projectId);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTaskStatus, setNewTaskStatus] = useState("a_faire");
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [filterLabelId, setFilterLabelId] = useState<number | null>(null);

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: () => projectsApi.get(id),
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", id, filterLabelId],
    queryFn: () => tasksApi.list(id, filterLabelId ? { labelId: filterLabelId } : undefined),
  });

  const handleAddTask = (status: string) => {
    setNewTaskStatus(status);
    setShowTaskForm(true);
  };

  if (!project) return null;

  const labels = project.labels ?? [];

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: project.color }}
              >
                {project.name[0].toUpperCase()}
              </span>
              <div>
                <h1 className="font-semibold text-gray-900">{project.name}</h1>
                {project.description && (
                  <p className="text-xs text-gray-400">{project.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Label filter */}
              {labels.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {labels.map((label) => (
                    <button
                      key={label.id}
                      onClick={() => setFilterLabelId(filterLabelId === label.id ? null : label.id)}
                      className={`text-xs px-2 py-1 rounded-full font-medium border transition-all ${
                        filterLabelId === label.id ? "opacity-100 shadow-sm" : "opacity-50 hover:opacity-80"
                      }`}
                      style={{
                        backgroundColor: label.color + "25",
                        color: label.color,
                        borderColor: label.color + "60",
                      }}
                    >
                      {label.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Label manager */}
              <LabelManager projectId={id} />

              {/* View toggle */}
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode("kanban")}
                  className={`p-1.5 transition-colors ${
                    viewMode === "kanban" ? "bg-indigo-50 text-indigo-600" : "text-gray-400 hover:text-gray-600"
                  }`}
                  title="Vue Kanban"
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 transition-colors ${
                    viewMode === "list" ? "bg-indigo-50 text-indigo-600" : "text-gray-400 hover:text-gray-600"
                  }`}
                  title="Vue Liste"
                >
                  <List size={16} />
                </button>
                <button
                  onClick={() => setViewMode("documents")}
                  className={`p-1.5 transition-colors ${
                    viewMode === "documents" ? "bg-indigo-50 text-indigo-600" : "text-gray-400 hover:text-gray-600"
                  }`}
                  title="Documents du projet"
                >
                  <Paperclip size={16} />
                </button>
              </div>

              <button
                onClick={() => handleAddTask("a_faire")}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={14} />
                Tâche
              </button>
            </div>
          </div>
        </div>

        {/* Board / List */}
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
          ) : (
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Documents du projet</h2>
                  <p className="text-sm text-gray-500">Tous les fichiers partagés pour ce projet</p>
                </div>
              </div>
              <AttachmentList entityType="project" entityId={id} />
            </div>
          )}
        </div>
      </div>

      {/* Task Drawer */}
      {selectedTask && (
        <TaskDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}

      {/* Task Form */}
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
