import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, RefreshCw, Repeat } from "lucide-react";
import { recurringTasksApi, RecurringTask } from "@/api/recurringTasks";
import { RecurringTaskForm } from "./RecurringTaskForm";

interface RecurringTasksViewProps {
  projectId: number;
}

function recurrenceLabel(t: (key: string, opts?: any) => string, template: RecurringTask): string {
  if (template.recurrenceType === "EVERY_N_WEEKS") {
    return `${t("recurring.intervalWeeks")} ${template.intervalWeeks} ${t("recurring.intervalWeeksUnit")}`;
  }
  if (template.recurrenceType === "MONTHLY_BEFORE_END") {
    return `${template.daysBeforeEndOfMonth} ${t("recurring.daysBeforeEndOfMonth")}`;
  }
  if (template.recurrenceType === "CUSTOM_DATES") {
    const dates = template.customDates ?? [];
    return `${t("recurring.types.CUSTOM_DATES")} (${dates.length})`;
  }
  return "";
}

export function RecurringTasksView({ projectId }: RecurringTasksViewProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["recurring-tasks", projectId],
    queryFn: () => recurringTasksApi.list(projectId),
  });

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RecurringTask | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => recurringTasksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-tasks", projectId] });
      setConfirmDeleteId(null);
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: (id: number) => recurringTasksApi.regenerate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-tasks", projectId] });
      setRegeneratingId(null);
    },
    onError: () => setRegeneratingId(null),
  });

  const handleRegenerate = (template: RecurringTask) => {
    setRegeneratingId(template.id);
    regenerateMutation.mutate(template.id);
  };

  if (isLoading) {
    return (
      <div className="p-8 text-sm text-gray-400">{t("common.loading")}</div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Repeat size={18} className="text-indigo-500" />
          <h2 className="text-base font-semibold text-gray-900">{t("recurring.title")}</h2>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-1.5 text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={14} />
          {t("recurring.new")}
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
          <Repeat size={32} className="opacity-30" />
          <p className="text-sm">{t("recurring.noRecurring")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-gray-900 truncate">{tpl.title}</span>
                  {tpl.type && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ backgroundColor: tpl.type.color + "20", color: tpl.type.color }}
                    >
                      {tpl.type.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <RefreshCw size={11} />
                    {recurrenceLabel(t, tpl)}
                  </span>
                  <span>
                    {t("recurring.generatedCount_other", { count: tpl._count?.tasks ?? 0 })}
                  </span>
                  {tpl.assignee && (
                    <span>{tpl.assignee.name}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleRegenerate(tpl)}
                  disabled={regeneratingId === tpl.id}
                  title={t("recurring.regenerate")}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={14} className={regeneratingId === tpl.id ? "animate-spin" : ""} />
                </button>
                <button
                  onClick={() => { setEditing(tpl); setShowForm(true); }}
                  title={t("recurring.edit")}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setConfirmDeleteId(tpl.id)}
                  title={t("common.delete")}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / edit modal */}
      {showForm && (
        <RecurringTaskForm
          projectId={projectId}
          initial={editing ?? undefined}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {/* Delete confirmation */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <p className="text-sm text-gray-700 mb-4">{t("recurring.deleteConfirm")}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirmDeleteId)}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
