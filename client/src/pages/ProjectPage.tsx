import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { projectsApi } from "@/api/projects";
import { tasksApi, Task } from "@/api/tasks";
import { usersApi } from "@/api/users";
import { ticketTypesApi, TicketType } from "@/api/ticketTypes";
import { AppShell } from "@/components/layout/AppShell";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { ProjectSettingsModal } from "@/components/project/ProjectSettingsModal";
import { TaskListView } from "@/components/task/TaskListView";
import { RoadmapView } from "@/components/task/RoadmapView";
import { EpicBacklogView } from "@/components/task/EpicBacklogView";
import { SprintBacklogView } from "@/components/task/SprintBacklogView";
import { TaskDrawer } from "@/components/task/TaskDrawer";
import { TaskForm } from "@/components/task/TaskForm";
import {
  Plus, Settings, Search, Tag, ChevronDown, X,
  LayoutGrid, List, Layers, GitBranch, Calendar,
} from "lucide-react";

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
        ) : "Labels"}
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-20 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1 overflow-hidden">
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors ${value === null ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"}`}
          >
            All labels
          </button>
          {labels.map((label) => (
            <button
              key={label.id}
              onClick={() => { onChange(label.id); setOpen(false); }}
              className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors ${value === label.id ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"}`}
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

function SprintDropdown({
  projectId,
  value,
  onChange,
}: {
  projectId: number;
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: sprints = [] } = useQuery({
    queryKey: ["sprints", projectId],
    queryFn: () => sprintsApi.list(projectId),
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selected = sprints.find((s) => s.id === value);

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
        <Calendar size={13} />
        {selected ? selected.name : "Sprints"}
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-20 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1 overflow-hidden">
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors ${value === null ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"}`}
          >
            All sprints
          </button>
          {sprints.map((s) => (
            <button
              key={s.id}
              onClick={() => { onChange(s.id); setOpen(false); }}
              className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors ${value === s.id ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"}`}
            >
              <div className={`w-2 h-2 rounded-full ${s.status === "actif" ? "bg-green-500" : "bg-gray-400"}`} />
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── User avatar pill ─────────────────────────────────────────────────────────

function UserAvatar({
  user, active, onClick,
}: {
  user: { id: number; name: string; avatarUrl?: string | null };
  active: boolean;
  onClick: () => void;
}) {
  const initials = user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <button
      onClick={onClick}
      title={user.name}
      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ring-2 ${
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

type ViewMode = "kanban" | "list" | "backlog" | "sprints" | "roadmap" | "versions";

const VIEWS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
  { id: "kanban",   label: "Board",    icon: <LayoutGrid size={14} /> },
  { id: "list",     label: "List",     icon: <List size={14} /> },
  { id: "roadmap",  label: "Roadmap",  icon: <Calendar size={14} /> },
  { id: "backlog",  label: "Backlog",  icon: <Layers size={14} /> },
  { id: "sprints",  label: "Sprints",  icon: <Calendar size={14} /> },
  { id: "versions", label: "Versions", icon: <GitBranch size={14} /> },
];

// ─── Main page ────────────────────────────────────────────────────────────────

interface FilterState {
  search: string;
  assigneeId: number | null;
  labelId: number | null;
  typeId: number | null;
  sprintId: number | null;
}

const EMPTY_FILTERS: FilterState = { search: "", assigneeId: null, labelId: null, typeId: null, sprintId: null };

export function ProjectPage() {
  const { projectId } = useParams({ from: "/projects/$projectId" });
  const id = parseInt(projectId);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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

  const { data: ticketTypes = [] } = useQuery({
    queryKey: ["ticketTypes", id],
    queryFn: () => ticketTypesApi.list(id),
  });

  const isBacklog = viewMode === "backlog" || viewMode === "sprints";

  const { data: rawTasks = [], isLoading } = useQuery({
    queryKey: ["tasks", id, {
      labelId: filters.labelId,
      assigneeId: filters.assigneeId,
      typeId: isBacklog ? null : filters.typeId,
      sprintId: filters.sprintId,
    }],
    queryFn: () =>
      tasksApi.list(id, {
        ...(filters.labelId ? { labelId: filters.labelId } : {}),
        ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
        ...(!isBacklog && filters.typeId ? { typeId: filters.typeId } : {}),
        ...(filters.sprintId !== null ? { sprintId: filters.sprintId } : {}),
      }),
  });

  const tasks = useMemo(() => {
    if (!filters.search.trim()) return rawTasks;
    const q = filters.search.toLowerCase();
    return rawTasks.filter((t) => t.title.toLowerCase().includes(q));
  }, [rawTasks, filters.search]);

  const projectUsers = useMemo(() => {
    const ids = new Set(rawTasks.map((t) => t.assigneeId).filter(Boolean));
    return allUsers.filter((u) => ids.has(u.id));
  }, [rawTasks, allUsers]);

  const labels = project?.labels ?? [];

  const handleAddTask = (status: string) => {
    setNewTaskStatus(status);
    setShowTaskForm(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === "n" || e.key === "N") { e.preventDefault(); handleAddTask("a_faire"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!project) return null;

  return (
    <AppShell>
      <div className="flex flex-col h-full">

        {/* ── Row 1: title + actions ──────────────────────────────────────── */}
        <div className="bg-white border-b border-gray-100 px-6 pt-5 pb-0 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span
                className="w-7 h-7 rounded-md flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ backgroundColor: project.color }}
              >
                {project.name[0].toUpperCase()}
              </span>
              <h1 className="text-lg font-semibold text-gray-900">{project.name}</h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAddTask("a_faire")}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
                title="New task (N)"
              >
                <Plus size={14} />
                Create
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors"
                title="Project settings"
              >
                <Settings size={15} />
              </button>
            </div>
          </div>

          {/* ── Row 2: tabs ──────────────────────────────────────────────── */}
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

        {/* ── Row 3: filters ───────────────────────────────────────────────── */}
        <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center gap-3 flex-shrink-0">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="Search a ticket…"
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
            />
            {filters.search && (
              <button onClick={() => setFilters((f) => ({ ...f, search: "" }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={12} />
              </button>
            )}
          </div>

          {projectUsers.length > 0 && <div className="w-px h-5 bg-gray-200" />}
          {projectUsers.length > 0 && (
            <div className="flex items-center gap-1">
              {projectUsers.map((user) => (
                <UserAvatar
                  key={user.id}
                  user={user}
                  active={filters.assigneeId === user.id}
                  onClick={() => setFilters((f) => ({ ...f, assigneeId: f.assigneeId === user.id ? null : user.id }))}
                />
              ))}
            </div>
          )}

          {labels.length > 0 && <div className="w-px h-5 bg-gray-200" />}
          {labels.length > 0 && (
            <LabelDropdown
              labels={labels}
              value={filters.labelId}
              onChange={(labelId) => setFilters((f) => ({ ...f, labelId }))}
            />
          )}

          <div className="w-px h-5 bg-gray-200" />
          <SprintDropdown
            projectId={id}
            value={filters.sprintId}
            onChange={(sprintId) => setFilters((f) => ({ ...f, sprintId }))}
          />

          {/* Ticket type filter — hidden in backlog mode */}
          {!isBacklog && ticketTypes.length > 0 && (
            <>
              <div className="w-px h-5 bg-gray-200" />
              <div className="flex items-center gap-1">
                {ticketTypes.map((type: TicketType) => (
                  <button
                    key={type.id}
                    onClick={() =>
                      setFilters((f) => ({
                        ...f,
                        typeId: f.typeId === type.id ? null : type.id,
                      }))
                    }
                    className={`text-xs px-2 py-1 rounded-lg font-medium border transition-colors ${
                      filters.typeId === type.id
                        ? "border-transparent"
                        : "border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    }`}
                    style={
                      filters.typeId === type.id
                        ? { backgroundColor: type.color + "20", color: type.color, borderColor: type.color + "40" }
                        : {}
                    }
                  >
                    {type.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {(filters.search || filters.assigneeId !== null || filters.labelId !== null || filters.typeId !== null || filters.sprintId !== null) && (
            <>
              <div className="w-px h-5 bg-gray-200" />
              <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1">
                <X size={11} /> Reset
              </button>
            </>
          )}
        </div>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="text-sm text-gray-400">Loading...</div>
          ) : viewMode === "kanban" ? (
            <KanbanBoard
              tasks={tasks}
              projectId={id}
              onTaskClick={setSelectedTask}
              onAddTask={handleAddTask}
              columns={project.columns}
            />
          ) : viewMode === "list" ? (
            <TaskListView tasks={tasks} onTaskClick={setSelectedTask} />
          ) : viewMode === "roadmap" ? (
            <RoadmapView tasks={tasks} onTaskClick={setSelectedTask} />
          ) : viewMode === "backlog" ? (
            <EpicBacklogView tasks={tasks} onTaskClick={setSelectedTask} />
          ) : viewMode === "sprints" ? (
            <SprintBacklogView projectId={id} tasks={tasks} onTaskClick={setSelectedTask} />
          ) : (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
              <GitBranch size={32} className="opacity-30" />
              <p className="text-sm">Versions management coming soon.</p>
            </div>
          )}
        </div>
      </div>

      {showSettings && (
        <ProjectSettingsModal projectId={id} onClose={() => setShowSettings(false)} />
      )}

      {selectedTask && (
        <TaskDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}

      {showTaskForm && (
        <TaskForm projectId={id} defaultStatus={newTaskStatus} onClose={() => setShowTaskForm(false)} />
      )}
    </AppShell>
  );
}
