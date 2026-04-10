import { useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { tasksApi } from "@/api/tasks";
import { AppShell } from "@/components/layout/AppShell";
import { TaskDrawer } from "@/components/task/TaskDrawer";
import { ArrowLeft } from "lucide-react";

/** Page accessible via /tickets/CUI-4 — opens the ticket drawer directly */
export function TicketPage() {
  const { ref } = useParams({ from: "/tickets/$ref" });
  const navigate = useNavigate();
  const [key, numStr] = ref.split("-");
  const number = parseInt(numStr ?? "0");

  const { data: task, isLoading, isError } = useQuery({
    queryKey: ["task-ref", key, number],
    queryFn: () => tasksApi.getByRef(key, number),
    enabled: !!key && !!number,
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full text-sm text-gray-400">
          Loading {ref}…
        </div>
      </AppShell>
    );
  }

  if (isError || !task) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <p className="text-sm text-gray-500">Ticket <span className="font-mono font-bold">{ref}</span> not found.</p>
          <button
            onClick={() => navigate({ to: "/" })}
            className="flex items-center gap-1 text-sm text-indigo-600 hover:underline"
          >
            <ArrowLeft size={14} /> Back to dashboard
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="h-full" />
      <TaskDrawer
        task={task}
        onClose={() => {
          // Navigate back to the source project
          navigate({ to: "/projects/$projectId", params: { projectId: String(task.projectId) } });
        }}
      />
    </AppShell>
  );
}
