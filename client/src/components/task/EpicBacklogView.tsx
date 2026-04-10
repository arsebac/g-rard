import { useMemo, useState } from "react";
import { Task } from "@/api/tasks";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  taskRef,
} from "@/lib/utils";
import { format, isPast, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ChevronRight,
  Calendar,
  AlertCircle,
  MessageSquare,
  Layers,
} from "lucide-react";

interface Props {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

// ─── Ligne de tâche enfant ────────────────────────────────────────────────────

function TaskRow({
  task,
  onClick,
  isLast,
  indent,
}: {
  task: Task;
  onClick: (t: Task) => void;
  isLast: boolean;
  indent: boolean;
}) {
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate && isPast(dueDate) && task.status !== "termine";
  const isDueToday = dueDate && isToday(dueDate);

  return (
    <tr
      onClick={() => onClick(task)}
      className={`cursor-pointer hover:bg-indigo-50/40 transition-colors ${
        !isLast ? "border-b border-gray-100" : ""
      }`}
    >
      {/* Référence */}
      <td
        className={`${indent ? "pl-9" : "pl-4"} pr-2 py-2.5 text-xs font-mono text-gray-300 whitespace-nowrap w-24`}
      >
        {task.number > 0 ? taskRef(task.projectKey, task.number) : "—"}
      </td>

      {/* Type badge */}
      <td className="px-2 py-2.5 w-24">
        {task.type && (
          <span
            className="text-xs px-1.5 py-0.5 rounded font-semibold whitespace-nowrap"
            style={{
              backgroundColor: task.type.color + "20",
              color: task.type.color,
            }}
          >
            {task.type.name}
          </span>
        )}
      </td>

      {/* Titre + labels */}
      <td className="px-2 py-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900">{task.title}</span>
          {task.labels?.map(({ label }) => (
            <span
              key={label.id}
              className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: label.color + "30",
                color: label.color,
              }}
            >
              {label.name}
            </span>
          ))}
        </div>
      </td>

      {/* Statut */}
      <td className="px-2 py-2.5 w-28">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[task.status]}`}
        >
          {STATUS_LABELS[task.status]}
        </span>
      </td>

      {/* Priorité */}
      <td className="px-2 py-2.5 w-24">
        <span className={`text-xs font-medium ${PRIORITY_COLORS[task.priority]}`}>
          {task.priority === "urgente" && (
            <AlertCircle size={11} className="inline mr-0.5" />
          )}
          {PRIORITY_LABELS[task.priority]}
        </span>
      </td>

      {/* Assignée */}
      <td className="px-2 py-2.5 w-32">
        {task.assignee ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-700 flex-shrink-0">
              {task.assignee.name[0].toUpperCase()}
            </div>
            <span className="text-xs text-gray-700 truncate">
              {task.assignee.name}
            </span>
          </div>
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </td>

      {/* Échéance */}
      <td className="px-2 py-2.5 w-28 pr-4">
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
      <td className="pr-4 py-2.5 w-10 text-right">
        {(task._count?.comments ?? 0) > 0 && (
          <span className="flex items-center justify-end gap-1 text-xs text-gray-400">
            <MessageSquare size={11} />
            {task._count?.comments}
          </span>
        )}
      </td>
    </tr>
  );
}

// ─── Section Epic ─────────────────────────────────────────────────────────────

function EpicSection({
  epic,
  children,
  onTaskClick,
}: {
  epic: Task | null; // null = section "Sans Epic"
  children: Task[];
  onTaskClick: (t: Task) => void;
}) {
  const [open, setOpen] = useState(true);

  const done = children.filter((t) => t.status === "termine").length;
  const total = children.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const epicColor = epic?.type?.color ?? "#94a3b8";

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* En-tête */}
      <div
        className="flex items-center gap-3 px-4 py-3 select-none border-l-4"
        style={{ borderLeftColor: epic ? epicColor : "#e2e8f0" }}
      >
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
        >
          <ChevronRight
            size={14}
            className={`transition-transform ${open ? "rotate-90" : ""}`}
          />
        </button>

        {epic ? (
          <>
            <span
              className="text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
              style={{
                backgroundColor: epicColor + "20",
                color: epicColor,
              }}
            >
              {epic.type?.name ?? "Epic"}
            </span>
            {epic.number > 0 && (
              <span className="text-xs font-mono text-gray-400 flex-shrink-0">
                {taskRef(epic.projectKey, epic.number)}
              </span>
            )}
            <button
              onClick={() => onTaskClick(epic)}
              className="font-semibold text-gray-900 text-sm hover:text-indigo-600 transition-colors text-left flex-1 truncate"
            >
              {epic.title}
            </button>
          </>
        ) : (
          <span className="text-sm font-medium text-gray-500 flex-1">
            Sans Epic
          </span>
        )}

        {/* Progression */}
        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          <span className="text-xs text-gray-400">
            {done}/{total}
          </span>
          {total > 0 && (
            <>
              <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: pct === 100 ? "#22c55e" : epicColor,
                  }}
                />
              </div>
              <span className="text-xs text-gray-400 w-7 text-right">
                {pct}%
              </span>
            </>
          )}
        </div>
      </div>

      {/* Tâches enfants */}
      {open && (
        <>
          {children.length === 0 ? (
            <div className="px-10 py-3 text-xs text-gray-400 italic border-t border-gray-50">
              Aucun ticket
            </div>
          ) : (
            <table className="w-full text-sm border-t border-gray-100">
              <tbody>
                {children.map((task, idx) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onClick={onTaskClick}
                    isLast={idx === children.length - 1}
                    indent={!!epic}
                  />
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function EpicBacklogView({ tasks, onTaskClick }: Props) {
  const { epics, epicChildrenMap, orphans } = useMemo(() => {
    const epics = tasks.filter((t) => t.type?.isEpic);
    const epicIds = new Set(epics.map((e) => e.id));

    const epicChildrenMap = new Map<number, Task[]>();
    epics.forEach((e) => epicChildrenMap.set(e.id, []));

    const orphans: Task[] = [];

    tasks.forEach((t) => {
      if (t.type?.isEpic) return;
      if (t.parentId && epicIds.has(t.parentId)) {
        epicChildrenMap.get(t.parentId)!.push(t);
      } else {
        orphans.push(t);
      }
    });

    return { epics, epicChildrenMap, orphans };
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
        <Layers size={32} className="opacity-30" />
        <p className="text-sm">Aucune tâche dans ce projet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Sections par Epic */}
      {epics.map((epic) => (
        <EpicSection
          key={epic.id}
          epic={epic}
          children={epicChildrenMap.get(epic.id) ?? []}
          onTaskClick={onTaskClick}
        />
      ))}

      {/* Section "Sans Epic" — orphelins et non-épics sans parent */}
      {orphans.length > 0 && (
        <EpicSection
          epic={null}
          children={orphans}
          onTaskClick={onTaskClick}
        />
      )}

      {/* Cas où il n'y a que des Epics (aucun enfant, aucun orphelin) */}
      {epics.length === 0 && orphans.length === 0 && tasks.length > 0 && (
        <EpicSection epic={null} children={tasks} onTaskClick={onTaskClick} />
      )}
    </div>
  );
}
