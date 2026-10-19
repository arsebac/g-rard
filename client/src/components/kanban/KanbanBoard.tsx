import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  CollisionDetection,
  PointerSensor,
  UniqueIdentifier,
  closestCorners,
  pointerWithin,
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

  // Visible columns: order and visibility from project config, fallback to defaults
  const visibleStatuses = columns && columns.length > 0
    ? columns.filter((c) => c.visible).map((c) => c.statusKey)
    : [...STATUSES];

  // Prefer whatever is under the pointer; fall back to the nearest droppable.
  const collisionDetection: CollisionDetection = (args) => {
    const hits = pointerWithin(args);
    return hits.length > 0 ? hits : closestCorners(args);
  };

  // `over` can be a column (status key) or a task card — resolve both to a status.
  const resolveStatus = (overId: UniqueIdentifier, currentTasks: Task[]): Status | null => {
    if (visibleStatuses.includes(overId as string)) return overId as Status;
    return (currentTasks.find((t) => t.id === overId)?.status as Status) ?? null;
  };

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
    onError: (error: any) => {
      setOptimisticTasks(null);
      const message = error.response?.data?.error || "Une erreur est survenue lors du déplacement.";
      alert(message);
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

    const newStatus = resolveStatus(overId, currentTasks);
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

    const newStatus = resolveStatus(over.id, currentTasks) ?? draggedTask.status;

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
      collisionDetection={collisionDetection}
      autoScroll={{ threshold: { x: 0.15, y: 0.15 }, acceleration: 20 }}
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
