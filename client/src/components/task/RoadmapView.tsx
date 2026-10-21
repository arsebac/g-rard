import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  startOfMonth,
} from "date-fns";
import { enUS, fr } from "date-fns/locale";
import { Calendar, ChevronRight } from "lucide-react";
import { Task } from "@/api/tasks";
import { STATUS_COLORS, STATUS_LABELS, taskRef } from "@/lib/utils";

interface Props {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

interface Span {
  start: Date;
  end: Date;
}

const BAR_COLORS: Record<Task["status"], string> = {
  a_faire: "bg-gray-300",
  en_cours: "bg-blue-400",
  termine: "bg-green-400",
  bloque: "bg-red-400",
};

const toDate = (value: string | null) => (value ? new Date(value) : null);

/** Own dates of a task: start → end (or due date). A single date yields a one-day span. */
function ownSpan(task: Task): Span | null {
  const start = toDate(task.startDate);
  const end = toDate(task.endDate) ?? toDate(task.dueDate);
  if (!start && !end) return null;
  const s = start ?? end!;
  const e = end ?? start!;
  return s <= e ? { start: s, end: e } : { start: e, end: s };
}

/** Epic span: its own dates, widened to cover its children. */
function epicSpan(epic: Task, children: Task[]): Span | null {
  const spans = [ownSpan(epic), ...children.map(ownSpan)].filter((s): s is Span => !!s);
  if (spans.length === 0) return null;
  return {
    start: new Date(Math.min(...spans.map((s) => s.start.getTime()))),
    end: new Date(Math.max(...spans.map((s) => s.end.getTime()))),
  };
}

function Bar({
  span,
  rangeStart,
  totalDays,
  className,
  children,
}: {
  span: Span;
  rangeStart: Date;
  totalDays: number;
  className: string;
  children?: React.ReactNode;
}) {
  const left = (differenceInCalendarDays(span.start, rangeStart) / totalDays) * 100;
  const width = ((differenceInCalendarDays(span.end, span.start) + 1) / totalDays) * 100;
  return (
    <div
      className={`absolute top-1/2 -translate-y-1/2 rounded overflow-hidden ${className}`}
      style={{ left: `${left}%`, width: `max(${width}%, 6px)` }}
    >
      {children}
    </div>
  );
}

export function RoadmapView({ tasks, onTaskClick }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("fr") ? fr : enUS;
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const rows = useMemo(() => {
    const epics = tasks.filter((task) => task.type?.isEpic);
    return epics
      .map((epic) => {
        const children = tasks.filter((task) => task.parentId === epic.id);
        const done = children.filter((c) => c.status === "termine").length;
        return { epic, children, done, span: epicSpan(epic, children) };
      })
      .sort((a, b) => {
        if (!a.span || !b.span) return a.span ? -1 : b.span ? 1 : a.epic.number - b.epic.number;
        return a.span.start.getTime() - b.span.start.getTime();
      });
  }, [tasks]);

  const scheduled = rows.filter((r) => r.span);
  const unscheduled = rows.filter((r) => !r.span);

  const range = useMemo(() => {
    if (scheduled.length === 0) return null;
    const today = new Date();
    const min = Math.min(today.getTime(), ...scheduled.map((r) => r.span!.start.getTime()));
    const max = Math.max(today.getTime(), ...scheduled.map((r) => r.span!.end.getTime()));
    const start = startOfMonth(new Date(min));
    const end = endOfMonth(new Date(max));
    const months: Date[] = [];
    for (let m = start; m <= end; m = addMonths(m, 1)) months.push(m);
    return { start, totalDays: differenceInCalendarDays(end, start) + 1, months };
  }, [scheduled]);

  const toggle = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
        <Calendar size={32} className="opacity-30" />
        <p className="text-sm">{t("roadmap.noEpics")}</p>
      </div>
    );
  }

  const todayLeft = range
    ? (differenceInCalendarDays(new Date(), range.start) / range.totalDays) * 100
    : 0;

  return (
    <div className="space-y-6">
      {range && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <div style={{ minWidth: 280 + range.months.length * 90 }}>
            {/* Month header */}
            <div className="flex border-b border-gray-200 bg-gray-50 text-xs text-gray-500">
              <div className="w-72 flex-shrink-0 px-4 py-2 font-medium">{t("roadmap.epic")}</div>
              <div className="flex-1 flex">
                {range.months.map((m) => {
                  const days = differenceInCalendarDays(endOfMonth(m), m) + 1;
                  return (
                    <div
                      key={m.toISOString()}
                      className="border-l border-gray-200 px-2 py-2 capitalize truncate"
                      style={{ width: `${(days / range.totalDays) * 100}%` }}
                    >
                      {format(m, "MMM yyyy", { locale })}
                    </div>
                  );
                })}
              </div>
            </div>

            {scheduled.map(({ epic, children, done, span }) => {
              const open = !collapsed.has(epic.id);
              const progress = children.length ? (done / children.length) * 100 : 0;
              return (
                <div key={epic.id} className="border-b border-gray-100 last:border-b-0">
                  <div className="flex items-stretch hover:bg-indigo-50/30">
                    <div className="w-72 flex-shrink-0 px-2 py-2 flex items-center gap-1.5 min-w-0">
                      <button
                        onClick={() => toggle(epic.id)}
                        className={`p-0.5 text-gray-400 hover:text-gray-700 ${children.length ? "" : "invisible"}`}
                      >
                        <ChevronRight size={14} className={`transition-transform ${open ? "rotate-90" : ""}`} />
                      </button>
                      <button onClick={() => onTaskClick(epic)} className="flex items-center gap-2 min-w-0 text-left">
                        <span className="text-xs font-mono text-gray-300 whitespace-nowrap">
                          {taskRef(epic.projectKey, epic.number)}
                        </span>
                        <span className="text-sm font-medium text-gray-900 truncate">{epic.title}</span>
                      </button>
                      <span className="ml-auto text-xs text-gray-400 whitespace-nowrap pl-1">
                        {done}/{children.length}
                      </span>
                    </div>
                    <div className="flex-1 relative h-10">
                      <div className="absolute inset-y-0 w-px bg-red-400/70 z-10" style={{ left: `${todayLeft}%` }} />
                      <Bar
                        span={span!}
                        rangeStart={range.start}
                        totalDays={range.totalDays}
                        className="h-5 cursor-pointer"
                      >
                        <button
                          onClick={() => onTaskClick(epic)}
                          title={`${format(span!.start, "P", { locale })} → ${format(span!.end, "P", { locale })}`}
                          className="w-full h-full bg-indigo-200 relative"
                          style={epic.type?.color ? { backgroundColor: epic.type.color + "40" } : undefined}
                        >
                          <span
                            className="absolute inset-y-0 left-0 bg-indigo-500/70"
                            style={{
                              width: `${progress}%`,
                              ...(epic.type?.color ? { backgroundColor: epic.type.color + "b0" } : {}),
                            }}
                          />
                        </button>
                      </Bar>
                    </div>
                  </div>

                  {open &&
                    children.map((child) => {
                      const childSpan = ownSpan(child);
                      return (
                        <div key={child.id} className="flex items-stretch hover:bg-indigo-50/30">
                          <button
                            onClick={() => onTaskClick(child)}
                            className="w-72 flex-shrink-0 pl-9 pr-2 py-1 flex items-center gap-2 min-w-0 text-left"
                          >
                            <span className="text-xs font-mono text-gray-300 whitespace-nowrap">
                              {taskRef(child.projectKey, child.number)}
                            </span>
                            <span className="text-xs text-gray-700 truncate">{child.title}</span>
                            <span
                              className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLORS[child.status]}`}
                            >
                              {STATUS_LABELS[child.status]}
                            </span>
                          </button>
                          <div className="flex-1 relative h-7">
                            <div className="absolute inset-y-0 w-px bg-red-400/70 z-10" style={{ left: `${todayLeft}%` }} />
                            {childSpan ? (
                              <Bar
                                span={childSpan}
                                rangeStart={range.start}
                                totalDays={range.totalDays}
                                className={`h-3 ${BAR_COLORS[child.status]}`}
                              />
                            ) : (
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-300 italic">
                                {t("roadmap.noDates")}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {unscheduled.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
            {t("roadmap.unscheduled")}
          </h3>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {unscheduled.map(({ epic, children, done }) => (
              <button
                key={epic.id}
                onClick={() => onTaskClick(epic)}
                className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-indigo-50/30"
              >
                <span className="text-xs font-mono text-gray-300">{taskRef(epic.projectKey, epic.number)}</span>
                <span className="text-sm text-gray-900 truncate">{epic.title}</span>
                <span className="ml-auto text-xs text-gray-400">{done}/{children.length}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">{t("roadmap.unscheduledHint")}</p>
        </div>
      )}
    </div>
  );
}
