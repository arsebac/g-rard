import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Task, tasksApi } from "@/api/tasks";
import { Sprint, sprintsApi } from "@/api/sprints";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  taskRef,
} from "@/lib/utils";
import {
  ChevronRight,
  Calendar,
  Plus,
  Play,
  CheckCircle2,
  X,
  Save,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  projectId: number;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

// ─── Draggable Task Row ───────────────────────────────────────────────────────

function DraggableTaskRow({ task, onClick }: { task: Task; onClick: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task-${task.id}`,
    data: { task },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onClick(task)}
      className="flex items-center gap-3 px-3 py-2 bg-white border border-gray-100 rounded-lg hover:border-indigo-200 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing group"
    >
      <span className="text-[10px] font-mono text-gray-400 w-16 flex-shrink-0">
        {taskRef(task.projectKey, task.number)}
      </span>
      <span className="flex-1 text-sm text-gray-700 font-medium truncate group-hover:text-indigo-700">
        {task.title}
      </span>
      <div className="flex items-center gap-2">
        {task.type && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
            style={{ backgroundColor: task.type.color + "20", color: task.type.color }}
          >
            {task.type.name}
          </span>
        )}
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${STATUS_COLORS[task.status]}`}>
          {STATUS_LABELS[task.status]}
        </span>
      </div>
    </div>
  );
}

// ─── Droppable Sprint Section ─────────────────────────────────────────────────

function SprintSection({
  projectId,
  sprint,
  tasks,
  onTaskClick,
  onEdit,
  onComplete,
}: {
  projectId: number;
  sprint: Sprint | null;
  tasks: Task[];
  onTaskClick: (t: Task) => void;
  onEdit: (s: Sprint) => void;
  onComplete: (s: Sprint) => void;
}) {
  const [open, setOpen] = useState(true);
  const queryClient = useQueryClient();
  const { setNodeRef, isOver } = useDroppable({
    id: sprint ? `sprint-${sprint.id}` : "backlog",
    data: { sprintId: sprint?.id ?? null },
  });

  const updateSprint = useMutation({
    mutationFn: (data: any) => sprintsApi.update(sprint!.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sprints", projectId] }),
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-2 p-3 rounded-xl border-2 transition-all ${
        isOver ? "border-indigo-400 bg-indigo-50/50 shadow-inner scale-[1.01]" : 
        sprint?.status === "actif" ? "bg-indigo-50/30 border-indigo-100" : "bg-gray-50/50 border-gray-100"
      }`}
    >
      <div className="flex items-center gap-3 px-1">
        <button onClick={() => setOpen(!open)} className="text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronRight size={16} className={`transition-transform ${open ? "rotate-90" : ""}`} />
        </button>
        
        <div className="flex-1 flex items-center gap-3">
          <h3 className="font-bold text-gray-900">
            {sprint ? sprint.name : "Backlog"}
          </h3>
          {sprint && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-widest ${
              sprint.status === "actif" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
            }`}>
              {sprint.status}
            </span>
          )}
          <span className="text-xs text-gray-400 font-medium">
            {tasks.length} {tasks.length > 1 ? "tickets" : "ticket"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {sprint && (
            <>
              <button
                onClick={() => onEdit(sprint)}
                className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-white transition-all"
                title="Edit sprint"
              >
                <Pencil size={14} />
              </button>
              
              {sprint.status === "futur" && (
                <button 
                  onClick={() => updateSprint.mutate({ status: "actif", startDate: new Date().toISOString() })}
                  className="flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 hover:border-indigo-300 text-indigo-600 rounded-lg text-xs font-bold transition-all shadow-sm"
                >
                  <Play size={12} fill="currentColor" /> Start
                </button>
              )}
              {sprint.status === "actif" && (
                <button 
                  onClick={() => onComplete(sprint)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                >
                  <CheckCircle2 size={12} /> Complete
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {sprint?.goal && open && (
        <p className="px-1 text-xs text-gray-500 mb-1 line-clamp-2 italic">
          “{sprint.goal}”
        </p>
      )}

      {open && (
        <div className="flex flex-col gap-1.5 mt-1 min-h-[40px]">
          {tasks.length === 0 ? (
            <div className="py-8 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 gap-2">
              <p className="text-xs font-medium">Sprint is empty</p>
              <p className="text-[10px] opacity-60">Drag tickets here to plan</p>
            </div>
          ) : (
            tasks.map(task => (
              <DraggableTaskRow key={task.id} task={task} onClick={onTaskClick} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sprint Modal ────────────────────────────────────────────────────────────

function SprintModal({
  projectId,
  sprint,
  onClose,
}: {
  projectId: number;
  sprint: Sprint | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: sprint?.name ?? "",
    goal: sprint?.goal ?? "",
    startDate: sprint?.startDate ? sprint.startDate.split("T")[0] : "",
    endDate: sprint?.endDate ? sprint.endDate.split("T")[0] : "",
  });

  const upsert = useMutation({
    mutationFn: () => sprint 
      ? sprintsApi.update(sprint.id, form) 
      : sprintsApi.create(projectId, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sprints", projectId] });
      onClose();
    },
  });

  const del = useMutation({
    mutationFn: () => sprintsApi.delete(sprint!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sprints", projectId] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {sprint ? "Edit Sprint" : "New Sprint"}
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Sprint name *</label>
            <input
              autoFocus
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="e.g. Sprint 1"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Sprint goal</label>
            <textarea
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="What do we want to achieve?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Start date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">End date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 flex items-center justify-between">
          {sprint && (
            <button
              onClick={() => { if (confirm("Delete this sprint?")) del.mutate(); }}
              className="text-red-500 hover:text-red-700 p-2 rounded-lg transition-colors"
              title="Delete sprint"
            >
              <Trash2 size={16} />
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">
              Cancel
            </button>
            <button
              onClick={() => upsert.mutate()}
              disabled={!form.name.trim() || upsert.isPending}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all shadow-md"
            >
              <Save size={14} />
              {upsert.isPending ? "Saving..." : "Save Sprint"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Completion Modal ────────────────────────────────────────────────────────

function CompletionModal({
  projectId,
  sprint,
  unfinishedTasks,
  onClose,
}: {
  projectId: number;
  sprint: Sprint;
  unfinishedTasks: Task[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: sprints = [] } = useQuery({
    queryKey: ["sprints", projectId],
    queryFn: () => sprintsApi.list(projectId),
  });

  const futureSprints = sprints.filter(s => s.status === "futur" && s.id !== sprint.id);
  const [targetSprintId, setTargetSprintId] = useState<number | null>(null);

  const complete = useMutation({
    mutationFn: async () => {
      // 1. Mark sprint as complete
      await sprintsApi.update(sprint.id, { status: "termine", endDate: new Date().toISOString() });
      
      // 2. Move unfinished tasks to target sprint (or backlog)
      for (const task of unfinishedTasks) {
        await tasksApi.update(task.id, { sprintId: targetSprintId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sprints", projectId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Complete {sprint.name}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          <p className="text-sm text-gray-600">
            This sprint contains <strong>{unfinishedTasks.length}</strong> unfinished tasks. 
            Where should they be moved?
          </p>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
              <input 
                type="radio" 
                name="target" 
                checked={targetSprintId === null} 
                onChange={() => setTargetSprintId(null)} 
                className="accent-indigo-600"
              />
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">Backlog</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Default</p>
              </div>
            </label>

            {futureSprints.map(s => (
              <label key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                <input 
                  type="radio" 
                  name="target" 
                  checked={targetSprintId === s.id} 
                  onChange={() => setTargetSprintId(s.id)} 
                  className="accent-indigo-600"
                />
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900">{s.name}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Next sprint</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">
            Cancel
          </button>
          <button
            onClick={() => complete.mutate()}
            disabled={complete.isPending}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all shadow-md"
          >
            <CheckCircle2 size={14} />
            {complete.isPending ? "Completing..." : "Complete Sprint"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SprintBacklogView({ projectId, tasks, onTaskClick }: Props) {
  const queryClient = useQueryClient();
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [completingSprint, setCompletingSprint] = useState<Sprint | null>(null);

  const { data: sprints = [] } = useQuery({
    queryKey: ["sprints", projectId],
    queryFn: () => sprintsApi.list(projectId),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const moveMutation = useMutation({
    mutationFn: ({ taskId, sprintId }: { taskId: number; sprintId: number | null }) =>
      tasksApi.update(taskId, { sprintId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = (active.data.current as any).task.id;
    const sprintId = (over.data.current as any).sprintId;

    if (taskId && (active.data.current as any).task.sprintId !== sprintId) {
      moveMutation.mutate({ taskId, sprintId });
    }
  };

  const sprintsById = useMemo(() => {
    const map = new Map<number | null, Task[]>();
    map.set(null, []); // Backlog
    sprints.forEach(s => map.set(s.id, []));
    
    tasks.forEach(t => {
      const list = map.get(t.sprintId);
      if (list) list.push(t);
      else map.get(null)!.push(t);
    });
    
    return map;
  }, [sprints, tasks]);

  const activeSprints = sprints.filter(s => s.status !== "termine");

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-6 pb-20">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <Calendar size={14} /> Sprints Planning
          </h2>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all border border-indigo-200"
          >
            <Plus size={14} /> Create Sprint
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {activeSprints.map(sprint => (
            <SprintSection
              key={sprint.id}
              projectId={projectId}
              sprint={sprint}
              tasks={sprintsById.get(sprint.id) ?? []}
              onTaskClick={onTaskClick}
              onEdit={setEditingSprint}
              onComplete={setCompletingSprint}
            />
          ))}

          <SprintSection
            projectId={projectId}
            sprint={null}
            tasks={sprintsById.get(null) ?? []}
            onTaskClick={onTaskClick}
            onEdit={() => {}}
            onComplete={() => {}}
          />
        </div>

        {showCreateModal && (
          <SprintModal projectId={projectId} sprint={null} onClose={() => setShowCreateModal(false)} />
        )}
        {editingSprint && (
          <SprintModal projectId={projectId} sprint={editingSprint} onClose={() => setEditingSprint(null)} />
        )}
        {completingSprint && (
          <CompletionModal 
            projectId={projectId} 
            sprint={completingSprint} 
            unfinishedTasks={(sprintsById.get(completingSprint.id) ?? []).filter(t => t.status !== "termine")}
            onClose={() => setCompletingSprint(null)} 
          />
        )}
      </div>
    </DndContext>
  );
}
