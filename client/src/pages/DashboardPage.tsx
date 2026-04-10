import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "@/api/projects";
import { AppShell } from "@/components/layout/AppShell";
import { Plus, X } from "lucide-react";

const PROJECT_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444",
  "#3b82f6", "#8b5cf6", "#f97316", "#06b6d4",
];

export function DashboardPage() {
  const queryClient = useQueryClient();
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", key: "", description: "", color: PROJECT_COLORS[0] });

  // Auto-generate the key from the name
  const autoKey = (name: string) => {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "";
    if (words.length === 1) return words[0].substring(0, 3).toUpperCase();
    return words.map((w) => w[0].toUpperCase()).join("").substring(0, 5);
  };

  const createMutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setShowForm(false);
      setForm({ name: "", key: "", description: "", color: PROJECT_COLORS[0] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const key = (form.key.trim() || autoKey(form.name)).toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 5);
    createMutation.mutate({ ...form, key });
  };

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {projects.length} project{projects.length !== 1 ? "s" : ""} in progress
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} />
            New project
          </button>
        </div>

        {isLoading ? (
          <div className="text-sm text-gray-400">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Link
                key={project.id}
                to="/projects/$projectId"
                params={{ projectId: String(project.id) }}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-indigo-200 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg font-bold"
                      style={{ backgroundColor: project.color }}
                    >
                      {project.name[0].toUpperCase()}
                    </span>
                    {project.key && (
                      <span className="text-xs font-mono font-bold text-gray-400">{project.key}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-1">
                    {project._count?.tasks ?? 0} task{(project._count?.tasks ?? 0) !== 1 ? "s" : ""}
                  </span>
                </div>
                <h2 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                  {project.name}
                </h2>
                {project.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{project.description}</p>
                )}
              </Link>
            ))}

            {/* Bouton rapide */}
            <button
              onClick={() => setShowForm(true)}
              className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 text-gray-400 hover:text-indigo-600"
            >
              <Plus size={20} />
              <span className="text-sm font-medium">New project</span>
            </button>
          </div>
        )}
      </div>

      {/* New project modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">New project</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">Project name *</label>
                  <input
                    autoFocus
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value, key: form.key || autoKey(e.target.value) })}
                    placeholder="E.g. Kitchen, Bathroom..."
                    required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="w-24">
                  <label className="text-xs text-gray-500 block mb-1">Key</label>
                  <input
                    type="text"
                    value={form.key || autoKey(form.name)}
                    onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 5) })}
                    placeholder="CUI"
                    maxLength={5}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional description..."
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-2">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {PROJECT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setForm({ ...form, color })}
                      className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                      style={{
                        backgroundColor: color,
                        outline: form.color === color ? `3px solid ${color}` : "none",
                        outlineOffset: "2px",
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !form.name.trim()}
                  className="flex-1 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
