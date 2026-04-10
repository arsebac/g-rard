import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tasksApi, CreateTaskData } from "@/api/tasks";
import { usersApi } from "@/api/users";
import { ticketTypesApi } from "@/api/ticketTypes";
import { STATUS_LABELS, PRIORITY_LABELS, taskRef } from "@/lib/utils";
import { X } from "lucide-react";

interface TaskFormProps {
  projectId: number;
  defaultStatus?: string;
  onClose: () => void;
}

export function TaskForm({ projectId, defaultStatus = "a_faire", onClose }: TaskFormProps) {
  const queryClient = useQueryClient();
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: usersApi.list });
  const { data: ticketTypes = [] } = useQuery({
    queryKey: ["ticket-types", projectId],
    queryFn: () => ticketTypesApi.list(projectId),
  });
  const { data: allTasks = [] } = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => tasksApi.list(projectId),
  });

  const [form, setForm] = useState<CreateTaskData>({
    title: "",
    description: "",
    status: defaultStatus as CreateTaskData["status"],
    priority: "normale",
    assigneeId: null,
    dueDate: null,
    typeId: null,
    parentId: null,
  });

  const selectedType = ticketTypes.find((t) => t.id === form.typeId);
  const isEpic = selectedType?.isEpic ?? false;

  // Parents possibles : epics + stories
  const possibleParents = allTasks.filter(
    (t) => t.type?.isEpic || t.type?.name === "Story"
  );

  const createMutation = useMutation({
    mutationFn: (data: CreateTaskData) => tasksApi.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    createMutation.mutate(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">New task</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Type */}
          {ticketTypes.length > 0 && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Type</label>
              <div className="flex flex-wrap gap-1.5">
                {ticketTypes.map((type) => {
                  const active = form.typeId === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setForm({ ...form, typeId: active ? null : type.id, parentId: null })}
                      className="text-xs px-2.5 py-1 rounded-lg font-semibold border transition-all"
                      style={{
                        backgroundColor: type.color + (active ? "25" : "10"),
                        color: type.color,
                        borderColor: type.color + (active ? "70" : "30"),
                        opacity: active ? 1 : 0.6,
                      }}
                    >
                      {type.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Titre */}
          <div>
            <input
              autoFocus
              type="text"
              placeholder="Task title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Parent (hidden if Epic) */}
          {!isEpic && possibleParents.length > 0 && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Parent (Epic / Story)</label>
              <select
                value={form.parentId ?? ""}
                onChange={(e) => setForm({ ...form, parentId: e.target.value ? parseInt(e.target.value) : null })}
                className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
              >
                <option value="">None</option>
                {possibleParents.map((t) => (
                  <option key={t.id} value={t.id}>
                    {taskRef(t.projectKey, t.number)} {t.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as CreateTaskData["status"] })}
                className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
              >
                {["a_faire", "en_cours", "termine", "bloque"].map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as CreateTaskData["priority"] })}
                className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
              >
                {["basse", "normale", "haute", "urgente"].map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Assigned to</label>
              <select
                value={form.assigneeId ?? ""}
                onChange={(e) => setForm({ ...form, assigneeId: e.target.value ? parseInt(e.target.value) : null })}
                className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
              >
                <option value="">Nobody</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Due date</label>
              <input
                type="date"
                value={form.dueDate ?? ""}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value || null })}
                className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
              />
            </div>
          </div>

          <div>
            <textarea
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={createMutation.isPending || !form.title.trim()} className="flex-1 px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {createMutation.isPending ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
