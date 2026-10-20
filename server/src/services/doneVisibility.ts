import { DoneVisibility } from "@prisma/client";

export interface DoneVisibilitySettings {
  doneVisibility: DoneVisibility;
  doneVisibilityHours: number;
}

interface ArchivableTask {
  status: string;
  completedAt: Date | null;
  archivedAt: Date | null;
  sprint?: { status: string } | null;
}

// A done task leaves the board (but stays reachable everywhere else) when it was
// removed by hand, or when the project's rule says its time on the board is over.
export function isTaskArchived(task: ArchivableTask, settings: DoneVisibilitySettings, now = new Date()): boolean {
  if (task.status !== "termine") return false;
  if (task.archivedAt) return true;
  switch (settings.doneVisibility) {
    case "immediate":
      return true;
    case "delay":
      return !!task.completedAt && now.getTime() - task.completedAt.getTime() >= settings.doneVisibilityHours * 3_600_000;
    case "sprint_end":
      return task.sprint?.status === "termine";
    default:
      return false;
  }
}

// Fields to write when a task's status changes: stamp completion, clear it (and any
// manual archive) on reopen so the task comes back to the board.
export function completionFields(oldStatus: string | null, newStatus: string | undefined) {
  if (!newStatus || newStatus === oldStatus) return {};
  if (newStatus === "termine") return { completedAt: new Date() };
  if (oldStatus === "termine") return { completedAt: null, archivedAt: null };
  return {};
}
