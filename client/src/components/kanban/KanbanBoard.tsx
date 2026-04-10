import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useState } from "react";
import { Task, tasksApi } from "@/api/tasks";
import { KanbanColumn } from "./KanbanColumn";
import { TaskCard } from "./TaskCard";
import { STATUSES, Status } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ProjectColumn } from "@/api/projectColumns";

interface KanbanBoardProps {
  tasks: Task[];
  projectId: number;
  onTaskClick: (task: Task) => void;
  onAddTask: (status: string) => void;
  columns?: ProjectColumn[];
}

export function KanbanBoard({ tasks, projectId, onTaskClick, onAddTask, columns }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [optimisticTasks, setOptimisticTasks] = useState<Task[] | null>(null);
  const queryClient = useQueryClient();

  // Colonnes à afficher : ordre et visibilité depuis la config projet, sinon défaut
  const visibleStatuses = columns && columns.length > 0
    ? columns.filter((c) => c.visible).map((c) => c.statusKey)
    : [...STATUSES];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const moveMutation = useMutation({
    mutationFn: ({ id, status, position }: { id: number; status: Status; position: number }) =>
      tasksApi.move(id, status, position),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      setOptimisticTasks(null);
    },
    onError: () => {
      setOptimisticTasks(null);
    },
  });

  const displayedTasks = optimisticTasks ?? tasks;

  const tasksByStatus = visibleStatuses.reduce<Record<string, Task[]>>((acc, status) => {
    acc[status] = displayedTasks.filter((t) => t.status === status).sort((a, b) => a.position - b.position);
    return acc;
  }, {});

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeTaskId = active.id as number;
    const overId = over.id;

    const currentTasks = optimisticTasks ?? tasks;
    const draggedTask = currentTasks.find((t) => t.id === activeTaskId);
    if (!draggedTask) return;

    // over is a column
    const newStatus = STATUSES.includes(overId as Status) ? (overId as Status) : null;
    if (newStatus && draggedTask.status !== newStatus) {
      setOptimisticTasks(
        currentTasks.map((t) => (t.id === activeTaskId ? { ...t, status: newStatus } : t))
      );
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) {
      setOptimisticTasks(null);
      return;
    }

    const activeTaskId = active.id as number;
    const currentTasks = optimisticTasks ?? tasks;
    const draggedTask = currentTasks.find((t) => t.id === activeTaskId);
    if (!draggedTask) return;

    let newStatus = draggedTask.status;
    if (STATUSES.includes(over.id as Status)) {
      newStatus = over.id as Status;
    }

    const columnTasks = currentTasks
      .filter((t) => t.status === newStatus && t.id !== activeTaskId)
      .sort((a, b) => a.position - b.position);

    // Simple position: end of column
    const newPosition = columnTasks.length > 0
      ? (columnTasks[columnTasks.length - 1].position ?? 0) + 1000
      : 1000;

    moveMutation.mutate({ id: activeTaskId, status: newStatus, position: newPosition });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 h-full overflow-x-auto pb-4">
        {visibleStatuses.map((status) => {
          const colConfig = columns?.find((c) => c.statusKey === status);
          return (
            <KanbanColumn
              key={status}
              status={status}
              label={colConfig?.label}
              color={colConfig?.color}
              tasks={tasksByStatus[status]}
              onTaskClick={onTaskClick}
              onAddTask={onAddTask}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeTask ? (
          <TaskCard task={activeTask} onClick={() => {}} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
