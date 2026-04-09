import { Task } from "@/api/tasks";
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, taskRef } from "@/lib/utils";
import { format, isPast, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, AlertCircle, MessageSquare } from "lucide-react";

interface TaskListViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

const STATUS_ORDER: Task["status"][] = ["a_faire", "en_cours", "bloque", "termine"];

export function TaskListView({ tasks, onTaskClick }: TaskListViewProps) {
  const grouped = STATUS_ORDER.map((status) => ({
    status,
    tasks: tasks.filter((t) => t.status === status),
  })).filter((g) => g.tasks.length > 0);

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        Aucune tâche dans ce projet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {grouped.map(({ status, tasks: groupTasks }) => (
        <div key={status}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
              {STATUS_LABELS[status]}
            </span>
            <span className="text-xs text-gray-400">{groupTasks.length}</span>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 font-medium uppercase tracking-wide">
                  <th className="text-left px-4 py-2.5 w-8">#</th>
                  <th className="text-left px-4 py-2.5">Titre</th>
                  <th className="text-left px-4 py-2.5 w-28">Priorité</th>
                  <th className="text-left px-4 py-2.5 w-32">Assignée</th>
                  <th className="text-left px-4 py-2.5 w-28">Échéance</th>
                  <th className="text-left px-4 py-2.5 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {groupTasks.map((task, idx) => {
                  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
                  const isOverdue = dueDate && isPast(dueDate) && task.status !== "termine";
                  const isDueToday = dueDate && isToday(dueDate);
                  return (
                    <tr
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      className={`cursor-pointer hover:bg-indigo-50/50 transition-colors ${
                        idx < groupTasks.length - 1 ? "border-b border-gray-100" : ""
                      }`}
                    >
                      {/* Ref */}
                      <td className="px-4 py-3 text-xs font-mono text-gray-300 whitespace-nowrap">
                        {task.number > 0 ? taskRef(task.projectKey, task.number) : "—"}
                      </td>

                      {/* Titre + labels */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900">{task.title}</span>
                          {task.labels?.map(({ label }) => (
                            <span
                              key={label.id}
                              className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                              style={{ backgroundColor: label.color + "30", color: label.color }}
                            >
                              {label.name}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Priorité */}
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${PRIORITY_COLORS[task.priority]}`}>
                          {task.priority === "urgente" && (
                            <AlertCircle size={11} className="inline mr-0.5" />
                          )}
                          {PRIORITY_LABELS[task.priority]}
                        </span>
                      </td>

                      {/* Assignée */}
                      <td className="px-4 py-3">
                        {task.assignee ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-700 flex-shrink-0">
                              {task.assignee.name[0].toUpperCase()}
                            </div>
                            <span className="text-gray-700 truncate">{task.assignee.name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Échéance */}
                      <td className="px-4 py-3">
                        {dueDate ? (
                          <span
                            className={`flex items-center gap-1 text-xs ${
                              isOverdue
                                ? "text-red-600 font-semibold"
                                : isDueToday
                                ? "text-orange-500 font-semibold"
                                : "text-gray-500"
                            }`}
                          >
                            <Calendar size={11} />
                            {format(dueDate, "d MMM yyyy", { locale: fr })}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Commentaires */}
                      <td className="px-4 py-3 text-right">
                        {(task._count?.comments ?? 0) > 0 && (
                          <span className="flex items-center justify-end gap-1 text-xs text-gray-400">
                            <MessageSquare size={11} />
                            {task._count?.comments}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
