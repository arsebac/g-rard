import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Task } from "@/api/tasks";
import { TaskCard } from "./TaskCard";
import { STATUS_LABELS, STATUS_COLUMN_COLORS } from "@/lib/utils";
import { Plus } from "lucide-react";

interface KanbanColumnProps {
  status: string;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddTask: (status: string) => void;
}

export function KanbanColumn({ status, tasks, onTaskClick, onAddTask }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      {/* Header */}
      <div
        className={`bg-white rounded-t-lg border border-b-0 border-gray-200 border-t-4 px-3 py-2.5 flex items-center justify-between ${STATUS_COLUMN_COLORS[status]}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">
            {STATUS_LABELS[status]}
          </span>
          <span className="text-xs font-medium text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => onAddTask(status)}
          className="text-gray-400 hover:text-indigo-600 transition-colors"
          title="Ajouter une tâche"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-b-lg border border-gray-200 p-2 min-h-32 transition-colors ${
          isOver ? "bg-indigo-50" : "bg-gray-50"
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onClick={onTaskClick} />
            ))}
          </div>
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-24 text-sm text-gray-300">
            Aucune tâche
          </div>
        )}
      </div>
    </div>
  );
}
