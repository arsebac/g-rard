import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task } from "@/api/tasks";
import { PRIORITY_COLORS, PRIORITY_LABELS, taskRef } from "@/lib/utils";
import { format, isPast, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import { MessageSquare, Calendar, AlertCircle } from "lucide-react";

interface TaskCardProps {
  task: Task;
  onClick: (task: Task) => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate && isPast(dueDate) && task.status !== "termine";
  const isDueToday = dueDate && isToday(dueDate);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(task)}
      className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all select-none"
    >
      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels.map(({ label }) => (
            <span
              key={label.id}
              className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: label.color + "30", color: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <p className="text-sm text-gray-900 font-medium leading-snug mb-2">{task.title}</p>

      {/* Ref */}
      {task.number > 0 && (
        <p className="text-xs font-mono text-gray-300 mb-1">{taskRef(task.projectKey, task.number)}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Priority */}
          <span className={`text-xs font-medium ${PRIORITY_COLORS[task.priority]}`}>
            {task.priority === "urgente" && <AlertCircle size={12} className="inline mr-0.5" />}
            {PRIORITY_LABELS[task.priority]}
          </span>

          {/* Due date */}
          {dueDate && (
            <span
              className={`flex items-center gap-1 text-xs ${
                isOverdue
                  ? "text-red-600 font-semibold"
                  : isDueToday
                  ? "text-orange-500 font-semibold"
                  : "text-gray-400"
              }`}
            >
              <Calendar size={11} />
              {format(dueDate, "d MMM", { locale: fr })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Comments count */}
          {(task._count?.comments ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <MessageSquare size={11} />
              {task._count?.comments}
            </span>
          )}

          {/* Assignee avatar */}
          {task.assignee && (
            <div
              className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-700"
              title={task.assignee.name}
            >
              {task.assignee.name[0].toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
