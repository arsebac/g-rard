import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "@/api/projects";
import { tasksApi, Task } from "@/api/tasks";
import { AppShell } from "@/components/layout/AppShell";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { TaskDrawer } from "@/components/task/TaskDrawer";
import { TaskForm } from "@/components/task/TaskForm";
import { Plus } from "lucide-react";

export function ProjectPage() {
  const { projectId } = useParams({ from: "/projects/$projectId" });
  const id = parseInt(projectId);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTaskStatus, setNewTaskStatus] = useState("a_faire");

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: () => projectsApi.get(id),
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", id],
    queryFn: () => tasksApi.list(id),
  });

  const handleAddTask = (status: string) => {
    setNewTaskStatus(status);
    setShowTaskForm(true);
  };

  if (!project) return null;

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: project.color }}
            >
              {project.name[0].toUpperCase()}
            </span>
            <div>
              <h1 className="font-semibold text-gray-900">{project.name}</h1>
              {project.description && (
                <p className="text-xs text-gray-400">{project.description}</p>
              )}
            </div>
          </div>

          <button
            onClick={() => handleAddTask("a_faire")}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={14} />
            Tâche
          </button>
        </div>

        {/* Board */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="text-sm text-gray-400">Chargement...</div>
          ) : (
            <KanbanBoard
              tasks={tasks}
              projectId={id}
              onTaskClick={setSelectedTask}
              onAddTask={handleAddTask}
            />
          )}
        </div>
      </div>

      {/* Task Drawer */}
      {selectedTask && (
        <TaskDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}

      {/* Task Form */}
      {showTaskForm && (
        <TaskForm
          projectId={id}
          defaultStatus={newTaskStatus}
          onClose={() => setShowTaskForm(false)}
        />
      )}
    </AppShell>
  );
}
