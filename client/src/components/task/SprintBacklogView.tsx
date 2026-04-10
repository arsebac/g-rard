import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Task, tasksApi } from "@/api/tasks";
import { Sprint, sprintsApi } from "@/api/sprints";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  taskRef,
} from "@/lib/utils";
import { format } from "date-fns";
import {
  ChevronRight,
  Calendar,
  AlertCircle,
  MessageSquare,
  Plus,
  Play,
  CheckCircle2,
  MoreVertical,
} from "lucide-react";

interface Props {
  projectId: number;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

// ─── Task Row ────────────────────────────────────────────────────────────────

function TaskRow({ task, onClick }: { task: Task; onClick: (t: Task) => void }) {
  return (
    <div
      onClick={() => onClick(task)}
      className="flex items-center gap-3 px-3 py-2 bg-white border border-gray-100 rounded-lg hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer group"
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

// ─── Sprint Section ───────────────────────────────────────────────────────────

function SprintSection({
  projectId,
  sprint,
  tasks,
  onTaskClick,
}: {
  projectId: number;
  sprint: Sprint | null;
  tasks: Task[];
  onTaskClick: (t: Task) => void;
}) {
  const [open, setOpen] = useState(true);
  const queryClient = useQueryClient();

  const updateSprint = useMutation({
    mutationFn: (data: any) => sprintsApi.update(sprint!.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sprints", projectId] }),
  });

  return (
    <div className={`flex flex-col gap-2 p-3 rounded-xl border-2 ${sprint?.status === "actif" ? "bg-indigo-50/30 border-indigo-100" : "bg-gray-50/50 border-gray-100"}`}>
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

        {sprint && (
          <div className="flex items-center gap-2">
            {sprint.status === "futur" && (
              <button 
                onClick={() => updateSprint.mutate({ status: "actif" })}
                className="flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 hover:border-indigo-300 text-indigo-600 rounded-lg text-xs font-bold transition-all shadow-sm"
              >
                <Play size={12} fill="currentColor" /> Start
              </button>
            )}
            {sprint.status === "actif" && (
              <button 
                onClick={() => updateSprint.mutate({ status: "termine" })}
                className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
              >
                <CheckCircle2 size={12} /> Complete
              </button>
            )}
          </div>
        )}
      </div>

      {open && (
        <div className="flex flex-col gap-1.5 mt-1">
          {tasks.length === 0 ? (
            <div className="py-8 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 gap-2">
              <p className="text-xs font-medium">Sprint is empty</p>
              <p className="text-[10px] opacity-60">Drag tickets here to plan</p>
            </div>
          ) : (
            tasks.map(task => (
              <TaskRow key={task.id} task={task} onClick={onTaskClick} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SprintBacklogView({ projectId, tasks, onTaskClick }: Props) {
  const queryClient = useQueryClient();
  const { data: sprints = [] } = useQuery({
    queryKey: ["sprints", projectId],
    queryFn: () => sprintsApi.list(projectId),
  });

  const createSprint = useMutation({
    mutationFn: () => sprintsApi.create(projectId, { name: `Sprint ${sprints.length + 1}` }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sprints", projectId] }),
  });

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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
          <Calendar size={14} /> Sprints Planning
        </h2>
        <button 
          onClick={() => createSprint.mutate()}
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
          />
        ))}

        <SprintSection
          projectId={projectId}
          sprint={null}
          tasks={sprintsById.get(null) ?? []}
          onTaskClick={onTaskClick}
        />
      </div>
    </div>
  );
}
