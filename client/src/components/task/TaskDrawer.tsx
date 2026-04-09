import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Task, tasksApi, CreateTaskData } from "@/api/tasks";
import { usersApi } from "@/api/users";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  X,
  Trash2,
  Calendar,
  User,
  Flag,
  ChevronDown,
  Check,
  Pencil,
} from "lucide-react";

interface TaskDrawerProps {
  task: Task;
  onClose: () => void;
}

function EditableTitle({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft !== value) onSave(draft.trim());
    else setDraft(value);
  };

  if (editing) {
    return (
      <textarea
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); }
          if (e.key === "Escape") { setEditing(false); setDraft(value); }
        }}
        rows={2}
        className="w-full text-xl font-semibold text-gray-900 leading-snug resize-none border-0 border-b-2 border-indigo-400 outline-none bg-transparent pb-1"
      />
    );
  }

  return (
    <div
      className="group flex items-start gap-2 cursor-pointer"
      onClick={() => setEditing(true)}
    >
      <h2 className="text-xl font-semibold text-gray-900 leading-snug flex-1 hover:text-indigo-700 transition-colors">
        {value}
      </h2>
      <Pencil size={14} className="mt-1.5 text-gray-300 group-hover:text-indigo-400 flex-shrink-0 transition-colors" />
    </div>
  );
}

function SelectField<T extends string>({
  label,
  icon,
  value,
  options,
  renderOption,
  renderValue,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: T;
  options: T[];
  renderOption: (v: T) => React.ReactNode;
  renderValue: (v: T) => React.ReactNode;
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">{label}</p>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-sm"
      >
        <span className="text-gray-400">{icon}</span>
        <span className="flex-1 text-left">{renderValue(value)}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1 overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-indigo-50 transition-colors"
            >
              <span className="flex-1 text-left">{renderOption(opt)}</span>
              {opt === value && <Check size={14} className="text-indigo-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TaskDrawer({ task, onClose }: TaskDrawerProps) {
  const queryClient = useQueryClient();
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: usersApi.list });

  const { data: fullTask } = useQuery({
    queryKey: ["task", task.id],
    queryFn: () => tasksApi.get(task.id),
    initialData: task,
  });

  const update = (data: Partial<CreateTaskData>) =>
    updateMutation.mutate(data);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CreateTaskData>) => tasksApi.update(task.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", task.projectId] });
      queryClient.invalidateQueries({ queryKey: ["task", task.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.delete(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", task.projectId] });
      onClose();
    },
  });

  if (!fullTask) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 flex-shrink-0">
          <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
            #{fullTask.id}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => deleteMutation.mutate()}
              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
              title="Supprimer la tâche"
            >
              <Trash2 size={15} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left — titre + description */}
          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5 min-w-0">
            {/* Titre éditable */}
            <EditableTitle
              value={fullTask.title}
              onSave={(title) => update({ title })}
            />

            {/* Description */}
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Description
              </p>
              <textarea
                key={fullTask.id}
                defaultValue={fullTask.description ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (fullTask.description ?? "")) {
                    update({ description: e.target.value });
                  }
                }}
                rows={8}
                placeholder="Ajouter une description…"
                className="w-full text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder-gray-300"
              />
            </div>

            {/* Dates meta */}
            <div className="flex items-center gap-4 text-xs text-gray-400 pt-2 border-t border-gray-100">
              {fullTask.creator && (
                <span>
                  Créée par{" "}
                  <span className="font-medium text-gray-600">{fullTask.creator.name}</span>
                </span>
              )}
              {fullTask.createdAt && (
                <span>
                  le{" "}
                  <span className="text-gray-500">
                    {format(new Date(fullTask.createdAt), "d MMM yyyy", { locale: fr })}
                  </span>
                </span>
              )}
              {fullTask.updatedAt && fullTask.updatedAt !== fullTask.createdAt && (
                <span>
                  · modifiée le{" "}
                  <span className="text-gray-500">
                    {format(new Date(fullTask.updatedAt), "d MMM yyyy", { locale: fr })}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="w-px bg-gray-100 flex-shrink-0" />

          {/* Right — metadata */}
          <div className="w-64 flex-shrink-0 overflow-y-auto px-5 py-5 flex flex-col gap-5 bg-gray-50/50">

            {/* Statut */}
            <SelectField<Task["status"]>
              label="Statut"
              icon={<span className="w-2 h-2 rounded-full bg-current" />}
              value={fullTask.status}
              options={["a_faire", "en_cours", "termine", "bloque"]}
              renderValue={(v) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[v]}`}>
                  {STATUS_LABELS[v]}
                </span>
              )}
              renderOption={(v) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[v]}`}>
                  {STATUS_LABELS[v]}
                </span>
              )}
              onChange={(v) => update({ status: v })}
            />

            {/* Priorité */}
            <SelectField<Task["priority"]>
              label="Priorité"
              icon={<Flag size={14} />}
              value={fullTask.priority}
              options={["basse", "normale", "haute", "urgente"]}
              renderValue={(v) => (
                <span className={`font-medium ${PRIORITY_COLORS[v]}`}>
                  {PRIORITY_LABELS[v]}
                </span>
              )}
              renderOption={(v) => (
                <span className={`font-medium ${PRIORITY_COLORS[v]}`}>
                  {PRIORITY_LABELS[v]}
                </span>
              )}
              onChange={(v) => update({ priority: v })}
            />

            {/* Assignée */}
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                Assignée à
              </p>
              <div className="flex flex-col gap-1">
                {/* Utilisateurs */}
                {users.map((u) => {
                  const isAssigned = fullTask.assigneeId === u.id;
                  return (
                    <button
                      key={u.id}
                      onClick={() => update({ assigneeId: isAssigned ? null : u.id })}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                        isAssigned
                          ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                          : "border-gray-200 bg-white text-gray-600 hover:border-indigo-200 hover:bg-indigo-50"
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                          isAssigned ? "bg-indigo-200 text-indigo-700" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {u.name[0].toUpperCase()}
                      </div>
                      <span className="flex-1 text-left font-medium truncate">{u.name}</span>
                      {isAssigned && <Check size={13} className="text-indigo-500 flex-shrink-0" />}
                    </button>
                  );
                })}
                {!fullTask.assigneeId && (
                  <p className="text-xs text-gray-400 px-3">Non assignée</p>
                )}
              </div>
            </div>

            {/* Date d'échéance */}
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                Échéance
              </p>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="date"
                  value={fullTask.dueDate ? fullTask.dueDate.slice(0, 10) : ""}
                  onChange={(e) => update({ dueDate: e.target.value || null })}
                  className="w-full text-sm border border-gray-200 rounded-lg pl-8 pr-3 py-2 bg-white hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-colors"
                />
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
