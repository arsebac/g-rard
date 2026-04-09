import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Task, tasksApi, CreateTaskData } from "@/api/tasks";
import { usersApi } from "@/api/users";
import { STATUS_LABELS, PRIORITY_LABELS, PRIORITY_COLORS } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { X, Trash2 } from "lucide-react";

interface TaskDrawerProps {
  task: Task;
  onClose: () => void;
}

export function TaskDrawer({ task, onClose }: TaskDrawerProps) {
  const queryClient = useQueryClient();
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: usersApi.list });

  const { data: fullTask } = useQuery({
    queryKey: ["task", task.id],
    queryFn: () => tasksApi.get(task.id),
    initialData: task,
  });

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

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-lg bg-white shadow-xl flex flex-col h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900 flex-1">{fullTask?.title}</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => deleteMutation.mutate()}
              className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
              title="Supprimer"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 p-4 space-y-4">
          {/* Status */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Statut</label>
            <select
              value={fullTask?.status}
              onChange={(e) => updateMutation.mutate({ status: e.target.value as Task["status"] })}
              className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
            >
              {["a_faire", "en_cours", "termine", "bloque"].map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Priorité</label>
            <select
              value={fullTask?.priority}
              onChange={(e) => updateMutation.mutate({ priority: e.target.value as Task["priority"] })}
              className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
            >
              {["basse", "normale", "haute", "urgente"].map((p) => (
                <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
              ))}
            </select>
          </div>

          {/* Assignee */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Assignée à</label>
            <select
              value={fullTask?.assigneeId ?? ""}
              onChange={(e) =>
                updateMutation.mutate({ assigneeId: e.target.value ? parseInt(e.target.value) : null })
              }
              className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
            >
              <option value="">Non assignée</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Due date */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Date d'échéance</label>
            <input
              type="date"
              value={fullTask?.dueDate ? fullTask.dueDate.slice(0, 10) : ""}
              onChange={(e) => updateMutation.mutate({ dueDate: e.target.value || null })}
              className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Description</label>
            <textarea
              defaultValue={fullTask?.description ?? ""}
              onBlur={(e) => {
                if (e.target.value !== fullTask?.description) {
                  updateMutation.mutate({ description: e.target.value });
                }
              }}
              rows={4}
              placeholder="Ajouter une description..."
              className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white resize-none"
            />
          </div>

          {/* Meta */}
          <div className="pt-2 border-t border-gray-100 text-xs text-gray-400 space-y-1">
            <p>Créée par <span className="text-gray-600">{fullTask?.creator?.name}</span></p>
            {fullTask?.createdAt && (
              <p>le {format(new Date(fullTask.createdAt), "d MMMM yyyy", { locale: fr })}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
