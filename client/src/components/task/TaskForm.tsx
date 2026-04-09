import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tasksApi, CreateTaskData } from "@/api/tasks";
import { usersApi } from "@/api/users";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/lib/utils";
import { X } from "lucide-react";

interface TaskFormProps {
  projectId: number;
  defaultStatus?: string;
  onClose: () => void;
}

export function TaskForm({ projectId, defaultStatus = "a_faire", onClose }: TaskFormProps) {
  const queryClient = useQueryClient();
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: usersApi.list });

  const [form, setForm] = useState<CreateTaskData>({
    title: "",
    description: "",
    status: defaultStatus as CreateTaskData["status"],
    priority: "normale",
    assigneeId: null,
    dueDate: null,
  });

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
          <h2 className="text-base font-semibold text-gray-900">Nouvelle tâche</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <input
              autoFocus
              type="text"
              placeholder="Titre de la tâche"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Statut</label>
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
              <label className="text-xs text-gray-500 block mb-1">Priorité</label>
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
              <label className="text-xs text-gray-500 block mb-1">Assignée à</label>
              <select
                value={form.assigneeId ?? ""}
                onChange={(e) => setForm({ ...form, assigneeId: e.target.value ? parseInt(e.target.value) : null })}
                className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
              >
                <option value="">Personne</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Échéance</label>
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
              placeholder="Description (optionnel)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !form.title.trim()}
              className="flex-1 px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending ? "Création..." : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
