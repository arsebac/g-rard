import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { X, Plus, Trash2 } from "lucide-react";
import {
  recurringTasksApi,
  RecurringTask,
  CreateRecurringTaskData,
  RecurrenceType,
} from "@/api/recurringTasks";
import { usersApi } from "@/api/users";
import { ticketTypesApi } from "@/api/ticketTypes";
import { PRIORITY_LABELS } from "@/lib/utils";

interface RecurringTaskFormProps {
  projectId: number;
  initial?: RecurringTask;
  onClose: () => void;
}

const EMPTY_FORM: CreateRecurringTaskData = {
  title: "",
  description: null,
  priority: "normale",
  assigneeId: null,
  typeId: null,
  recurrenceType: "EVERY_N_WEEKS",
  intervalWeeks: 2,
  daysBeforeEndOfMonth: null,
  customDates: null,
};

export function RecurringTaskForm({ projectId, initial, onClose }: RecurringTaskFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: usersApi.list });
  const { data: ticketTypes = [] } = useQuery({
    queryKey: ["ticket-types", projectId],
    queryFn: () => ticketTypesApi.list(projectId),
  });

  const [form, setForm] = useState<CreateRecurringTaskData>(
    initial
      ? {
          title: initial.title,
          description: initial.description,
          priority: initial.priority,
          assigneeId: initial.assigneeId,
          typeId: initial.typeId,
          recurrenceType: initial.recurrenceType,
          intervalWeeks: initial.intervalWeeks,
          daysBeforeEndOfMonth: initial.daysBeforeEndOfMonth,
          customDates: initial.customDates,
        }
      : EMPTY_FORM
  );

  const [newDate, setNewDate] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: CreateRecurringTaskData) => recurringTasksApi.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-tasks", projectId] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CreateRecurringTaskData>) =>
      recurringTasksApi.update(initial!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-tasks", projectId] });
      onClose();
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (initial) {
      updateMutation.mutate(form);
    } else {
      createMutation.mutate(form);
    }
  };

  const addDate = () => {
    if (!newDate) return;
    const dates = form.customDates ?? [];
    if (!dates.includes(newDate)) {
      setForm({ ...form, customDates: [...dates, newDate].sort() });
    }
    setNewDate("");
  };

  const removeDate = (d: string) => {
    setForm({ ...form, customDates: (form.customDates ?? []).filter((x) => x !== d) });
  };

  const setType = (type: RecurrenceType) => {
    setForm({
      ...form,
      recurrenceType: type,
      intervalWeeks: type === "EVERY_N_WEEKS" ? (form.intervalWeeks ?? 2) : null,
      daysBeforeEndOfMonth: type === "MONTHLY_BEFORE_END" ? (form.daysBeforeEndOfMonth ?? 2) : null,
      customDates: type === "CUSTOM_DATES" ? (form.customDates ?? []) : null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">
            {initial ? t("recurring.edit") : t("recurring.new")}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <input
              autoFocus
              type="text"
              placeholder={t("task.titlePlaceholder")}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Recurrence type */}
          <div>
            <label className="text-xs text-gray-500 block mb-1.5">{t("task.type")}</label>
            <div className="flex flex-wrap gap-2">
              {(["EVERY_N_WEEKS", "MONTHLY_BEFORE_END", "CUSTOM_DATES"] as RecurrenceType[]).map((rt) => (
                <button
                  key={rt}
                  type="button"
                  onClick={() => setType(rt)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                    form.recurrenceType === rt
                      ? "bg-indigo-50 border-indigo-400 text-indigo-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {t(`recurring.types.${rt}`)}
                </button>
              ))}
            </div>
          </div>

          {/* EVERY_N_WEEKS */}
          {form.recurrenceType === "EVERY_N_WEEKS" && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">{t("recurring.intervalWeeks")}</label>
              <input
                type="number"
                min={1}
                max={52}
                value={form.intervalWeeks ?? 1}
                onChange={(e) => setForm({ ...form, intervalWeeks: parseInt(e.target.value) || 1 })}
                className="w-20 text-sm border border-gray-200 rounded-md px-2 py-1.5 text-center"
              />
              <span className="text-sm text-gray-600">{t("recurring.intervalWeeksUnit")}</span>
            </div>
          )}

          {/* MONTHLY_BEFORE_END */}
          {form.recurrenceType === "MONTHLY_BEFORE_END" && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={28}
                value={form.daysBeforeEndOfMonth ?? 0}
                onChange={(e) =>
                  setForm({ ...form, daysBeforeEndOfMonth: parseInt(e.target.value) || 0 })
                }
                className="w-20 text-sm border border-gray-200 rounded-md px-2 py-1.5 text-center"
              />
              <label className="text-sm text-gray-600">{t("recurring.daysBeforeEndOfMonth")}</label>
            </div>
          )}

          {/* CUSTOM_DATES */}
          {form.recurrenceType === "CUSTOM_DATES" && (
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">{t("recurring.customDates")}</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="flex-1 text-sm border border-gray-200 rounded-md px-2 py-1.5"
                />
                <button
                  type="button"
                  onClick={addDate}
                  disabled={!newDate}
                  className="flex items-center gap-1 text-sm px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md hover:bg-indigo-100 disabled:opacity-40 transition-colors"
                >
                  <Plus size={14} />
                  {t("recurring.addDate")}
                </button>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {(form.customDates ?? []).map((d) => (
                  <div
                    key={d}
                    className="flex items-center justify-between text-sm px-2 py-1 bg-gray-50 rounded"
                  >
                    <span className="text-gray-700">{d}</span>
                    <button
                      type="button"
                      onClick={() => removeDate(d)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Priority */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">{t("task.priority")}</label>
              <select
                value={form.priority ?? "normale"}
                onChange={(e) =>
                  setForm({ ...form, priority: e.target.value as CreateRecurringTaskData["priority"] })
                }
                className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
              >
                {(["basse", "normale", "haute", "urgente"] as const).map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">{t("task.assignedTo")}</label>
              <select
                value={form.assigneeId ?? ""}
                onChange={(e) =>
                  setForm({ ...form, assigneeId: e.target.value ? parseInt(e.target.value) : null })
                }
                className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
              >
                <option value="">{t("task.nobody")}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Type */}
          {ticketTypes.length > 0 && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">{t("task.type")}</label>
              <div className="flex flex-wrap gap-1.5">
                {ticketTypes.map((type) => {
                  const active = form.typeId === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setForm({ ...form, typeId: active ? null : type.id })}
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

          {/* Description */}
          <div>
            <textarea
              placeholder={t("task.descriptionOptional")}
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value || null })}
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
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={isPending || !form.title.trim()}
              className="flex-1 px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isPending
                ? t(initial ? "common.saving" : "common.creating")
                : t(initial ? "common.save" : "common.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
