import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Task, tasksApi, CreateTaskData } from "@/api/tasks";
import { usersApi } from "@/api/users";
import { projectsApi } from "@/api/projects";
import { labelsApi } from "@/api/labels";
import { ticketTypesApi } from "@/api/ticketTypes";
import { taskLinksApi, LINK_TYPES, LINK_TYPE_LABELS, LinkType } from "@/api/taskLinks";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  taskRef,
} from "@/lib/utils";
import {
  X,
  Trash2,
  Calendar,
  Flag,
  ChevronDown,
  Check,
  Pencil,
  Tag,
  Paperclip,
  Link2,
  Plus,
  Search,
  Layers,
} from "lucide-react";
import { TaskActivity } from "./TaskActivity";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { AttachmentList } from "@/components/ui/AttachmentList";

// ─── EditableTitle ────────────────────────────────────────────────────────────

function EditableTitle({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      const el = inputRef.current;
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }
  }, [editing]);

  const commit = () => {
    if (!draft.trim()) return;
    setEditing(false);
    if (draft.trim() !== value) onSave(draft.trim());
  };

  const cancel = () => { setEditing(false); setDraft(value); };

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); }
            if (e.key === "Escape") cancel();
          }}
          rows={2}
          className="w-full text-xl font-semibold text-gray-900 leading-snug resize-none border-0 border-b-2 border-indigo-400 outline-none bg-transparent pb-1"
        />
        <div className="flex items-center gap-2">
          <button onClick={commit} disabled={!draft.trim()} className="flex items-center gap-1 px-2.5 py-1 bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white text-xs font-medium rounded-md transition-colors">
            <Check size={12} /> Save
          </button>
          <button onClick={cancel} className="flex items-center gap-1 px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-600 text-xs font-medium rounded-md transition-colors">
            <X size={12} /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-2 cursor-pointer" onClick={() => { setDraft(value); setEditing(true); }}>
      <h2 className="text-xl font-semibold text-gray-900 leading-snug flex-1 hover:text-indigo-700 transition-colors">{value}</h2>
      <Pencil size={14} className="mt-1.5 text-gray-300 group-hover:text-indigo-400 flex-shrink-0 transition-colors" />
    </div>
  );
}

// ─── SelectField ──────────────────────────────────────────────────────────────

function SelectField<T extends string>({
  label, icon, value, options, renderOption, renderValue, onChange,
}: {
  label: string; icon: React.ReactNode; value: T;
  options: T[]; renderOption: (v: T) => React.ReactNode;
  renderValue: (v: T) => React.ReactNode; onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">{label}</p>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-sm"
      >
        <span className="text-gray-400">{icon}</span>
        <span className="flex-1 text-left">{renderValue(value)}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1 overflow-hidden">
          {options.map((opt) => (
            <button key={opt} onClick={() => { onChange(opt); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-indigo-50 transition-colors">
              <span className="flex-1 text-left">{renderOption(opt)}</span>
              {opt === value && <Check size={14} className="text-indigo-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TaskLinksPanel ───────────────────────────────────────────────────────────

function TaskLinksPanel({ taskId, projectId }: { taskId: number; projectId: number }) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedLinkType, setSelectedLinkType] = useState<LinkType>("relates_to");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  const { data: links = [] } = useQuery({
    queryKey: ["links", taskId],
    queryFn: () => taskLinksApi.list(taskId),
  });

  const { data: projectTasks = [] } = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => tasksApi.list(projectId),
    enabled: adding,
  });

  const addLink = useMutation({
    mutationFn: () => taskLinksApi.create(taskId, { targetId: selectedTaskId!, linkType: selectedLinkType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["links", taskId] });
      setAdding(false);
      setSearch("");
      setSelectedTaskId(null);
    },
  });

  const removeLink = useMutation({
    mutationFn: (id: number) => taskLinksApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["links", taskId] }),
  });

  const filtered = projectTasks.filter(
    (t) => t.id !== taskId && t.title.toLowerCase().includes(search.toLowerCase())
  );

  // Grouper par type de lien
  const grouped = LINK_TYPES.flatMap((lt) => {
    const group = links.filter((l) => l.linkType === lt);
    return group.length > 0 ? [{ linkType: lt, links: group }] : [];
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center gap-1">
          <Link2 size={12} /> Links
        </p>
        <button
          onClick={() => setAdding(!adding)}
          className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5"
        >
          <Plus size={12} />
          Add
        </button>
      </div>

      {/* Add link form */}
      {adding && (
        <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200 flex flex-col gap-2">
          <select
            value={selectedLinkType}
            onChange={(e) => setSelectedLinkType(e.target.value as LinkType)}
            className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {LINK_TYPES.map((lt) => (
              <option key={lt} value={lt}>{LINK_TYPE_LABELS[lt]}</option>
            ))}
          </select>

          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedTaskId(null); }}
              placeholder="Search a ticket…"
              className="w-full pl-6 pr-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {search && (
            <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-md bg-white">
              {filtered.length === 0 ? (
                <p className="text-xs text-gray-400 p-2">No ticket found</p>
              ) : filtered.slice(0, 8).map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTaskId(t.id); setSearch(t.title); }}
                  className={`w-full text-left px-2 py-1.5 text-xs hover:bg-indigo-50 transition-colors ${selectedTaskId === t.id ? "bg-indigo-50 text-indigo-700" : "text-gray-700"}`}
                >
                  <span className="font-mono text-gray-400 mr-1">{taskRef(t.projectKey, t.number)}</span>
                  {t.title}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => addLink.mutate()}
              disabled={!selectedTaskId || addLink.isPending}
              className="flex-1 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-md transition-colors"
            >
              {addLink.isPending ? "…" : "Link"}
            </button>
            <button
              onClick={() => { setAdding(false); setSearch(""); setSelectedTaskId(null); }}
              className="flex-1 py-1.5 text-xs border border-gray-200 hover:bg-gray-50 rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Existing links */}
      {grouped.length === 0 && !adding && (
        <p className="text-xs text-gray-400">No links</p>
      )}
      {grouped.map(({ linkType, links: group }) => (
        <div key={linkType} className="mb-2">
          <p className="text-xs font-medium text-gray-500 mb-1">{LINK_TYPE_LABELS[linkType]}</p>
          {group.map((link) => (
            <div key={link.id} className="flex items-center gap-2 group py-1">
              <span className="font-mono text-xs text-indigo-500">
                {taskRef(link.task.projectKey, link.task.number)}
              </span>
              <span className="flex-1 text-xs text-gray-700 truncate">{link.task.title}</span>
              <button
                onClick={() => removeLink.mutate(link.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── TaskDrawer ───────────────────────────────────────────────────────────────

interface TaskDrawerProps {
  task: Task;
  onClose: () => void;
}

export function TaskDrawer({ task, onClose }: TaskDrawerProps) {
  const queryClient = useQueryClient();
  const [linkedTask, setLinkedTask] = useState<Task | null>(null);

  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: usersApi.list });
  const { data: project } = useQuery({
    queryKey: ["project", task.projectId],
    queryFn: () => projectsApi.get(task.projectId),
  });
  const { data: ticketTypes = [] } = useQuery({
    queryKey: ["ticket-types", task.projectId],
    queryFn: () => ticketTypesApi.list(task.projectId),
  });
  // Available Epics for this project (tickets with isEpic type)
  const { data: allTasks = [] } = useQuery({
    queryKey: ["tasks", task.projectId],
    queryFn: () => tasksApi.list(task.projectId),
  });

  const epicType = ticketTypes.find((t) => t.isEpic);
  const epics = allTasks.filter((t) => t.typeId === epicType?.id && t.id !== task.id);
  const isEpic = task.type?.isEpic ?? false;

  const { data: fullTask } = useQuery({
    queryKey: ["task", task.id],
    queryFn: () => tasksApi.get(task.id),
    initialData: task,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CreateTaskData>) => tasksApi.update(task.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", task.projectId] });
      queryClient.invalidateQueries({ queryKey: ["task", task.id] });
      queryClient.invalidateQueries({ queryKey: ["activity", task.id] });
    },
  });

  const update = (data: Partial<CreateTaskData>) => updateMutation.mutate(data);

  const addLabel = useMutation({
    mutationFn: (labelId: number) => labelsApi.addToTask(task.id, labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", task.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks", task.projectId] });
    },
  });
  const removeLabel = useMutation({
    mutationFn: (labelId: number) => labelsApi.removeFromTask(task.id, labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", task.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks", task.projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.delete(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", task.projectId] });
      onClose();
    },
  });

  if (!fullTask) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

        {linkedTask && <TaskDrawer task={linkedTask} onClose={() => setLinkedTask(null)} />}

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            {fullTask.type && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded"
                style={{ backgroundColor: fullTask.type.color + "20", color: fullTask.type.color }}
              >
                {fullTask.type.name}
              </span>
            )}
            <span className="text-xs font-mono font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
              {taskRef(project?.key, fullTask.number)}
            </span>
            {fullTask.parent && (
              <span className="text-xs text-gray-400">
                ↳ {fullTask.parent.project.key ? `${fullTask.parent.project.key}-${fullTask.parent.number}` : `#${fullTask.parent.number}`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => deleteMutation.mutate()} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors" title="Delete task">
              <Trash2 size={15} />
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left — title + description + links + activity */}
          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5 min-w-0">
            <EditableTitle value={fullTask.title} onSave={(title) => update({ title })} />

            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Description</p>
              <RichTextEditor
                key={fullTask.id}
                defaultValue={fullTask.description ?? ""}
                onSave={(description) => update({ description })}
                placeholder="Add a description…"
                onTaskRefClick={async (ref) => {
                  const [key, num] = ref.split("-");
                  if (!key || !num) return;
                  try {
                    const t = await tasksApi.getByRef(key, parseInt(num));
                    setLinkedTask(t);
                  } catch { /* ref invalide */ }
                }}
              />
            </div>

            {/* Liens */}
            <div className="border-t border-gray-100 pt-4">
              <TaskLinksPanel taskId={fullTask.id} projectId={fullTask.projectId} />
            </div>

            <div className="pt-2 border-t border-gray-100">
              <TaskActivity taskId={fullTask.id} />
            </div>
          </div>

          <div className="w-px bg-gray-100 flex-shrink-0" />

          {/* Right — metadata */}
          <div className="w-64 flex-shrink-0 overflow-y-auto px-5 py-5 flex flex-col gap-5 bg-gray-50/50">

            {/* Type de ticket */}
            {ticketTypes.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Type</p>
                <div className="flex flex-wrap gap-1.5">
                  {ticketTypes.map((type) => {
                    const active = fullTask.typeId === type.id;
                    return (
                      <button
                        key={type.id}
                        onClick={() => update({ typeId: active ? null : type.id })}
                        className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-semibold border transition-all ${
                          active ? "opacity-100 shadow-sm" : "opacity-50 hover:opacity-80"
                        }`}
                        style={{
                          backgroundColor: type.color + (active ? "25" : "15"),
                          color: type.color,
                          borderColor: type.color + (active ? "60" : "30"),
                        }}
                      >
                        {active && <Check size={10} />}
                        {type.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Parent ticket (Epic/Story) — hidden if the ticket is itself an Epic */}
            {!isEpic && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <Layers size={12} /> Parent (Epic / Story)
                </p>
                <select
                  value={fullTask.parentId ?? ""}
                  onChange={(e) => update({ parentId: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
                >
                  <option value="">No parent</option>
                  {epics.map((e) => (
                    <option key={e.id} value={e.id}>
                      {taskRef(e.projectKey, e.number)} {e.title}
                    </option>
                  ))}
                  {/* Stories comme parent */}
                  {allTasks
                    .filter((t) => t.type?.name === "Story" && t.id !== task.id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {taskRef(s.projectKey, s.number)} {s.title}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Statut */}
            <SelectField<Task["status"]>
              label="Status"
              icon={<span className="w-2 h-2 rounded-full bg-current" />}
              value={fullTask.status}
              options={["a_faire", "en_cours", "termine", "bloque"]}
              renderValue={(v) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[v]}`}>{STATUS_LABELS[v]}</span>}
              renderOption={(v) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[v]}`}>{STATUS_LABELS[v]}</span>}
              onChange={(v) => update({ status: v })}
            />

            {/* Priority */}
            <SelectField<Task["priority"]>
              label="Priority"
              icon={<Flag size={14} />}
              value={fullTask.priority}
              options={["basse", "normale", "haute", "urgente"]}
              renderValue={(v) => <span className={`font-medium ${PRIORITY_COLORS[v]}`}>{PRIORITY_LABELS[v]}</span>}
              renderOption={(v) => <span className={`font-medium ${PRIORITY_COLORS[v]}`}>{PRIORITY_LABELS[v]}</span>}
              onChange={(v) => update({ priority: v })}
            />

            {/* Assignee */}
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Assigned to</p>
              <div className="flex flex-col gap-1">
                {users.map((u) => {
                  const isAssigned = fullTask.assigneeId === u.id;
                  return (
                    <button key={u.id} onClick={() => update({ assigneeId: isAssigned ? null : u.id })}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                        isAssigned ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-gray-200 bg-white text-gray-600 hover:border-indigo-200 hover:bg-indigo-50"
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${isAssigned ? "bg-indigo-200 text-indigo-700" : "bg-gray-100 text-gray-500"}`}>
                        {u.name[0].toUpperCase()}
                      </div>
                      <span className="flex-1 text-left font-medium truncate">{u.name}</span>
                      {isAssigned && <Check size={13} className="text-indigo-500 flex-shrink-0" />}
                    </button>
                  );
                })}
                {!fullTask.assigneeId && <p className="text-xs text-gray-400 px-3">Unassigned</p>}
              </div>
            </div>

            {/* Labels */}
            {project?.labels && project.labels.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <Tag size={12} /> Labels
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {project.labels.map((label) => {
                    const isActive = fullTask.labels?.some((tl) => tl.labelId === label.id);
                    return (
                      <button key={label.id}
                        onClick={() => isActive ? removeLabel.mutate(label.id) : addLabel.mutate(label.id)}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium border transition-all ${isActive ? "opacity-100 shadow-sm scale-100" : "opacity-50 hover:opacity-75"}`}
                        style={{ backgroundColor: label.color + "25", color: label.color, borderColor: label.color + "60" }}
                        title={isActive ? "Remove this label" : "Add this label"}
                      >
                        {isActive && <Check size={10} />}
                        {label.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Due date */}
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Due date</p>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="date"
                  value={fullTask.dueDate ? fullTask.dueDate.slice(0, 10) : ""}
                  onChange={(e) => update({ dueDate: e.target.value || null })}
                  className="w-full text-sm border border-gray-200 rounded-lg pl-8 pr-3 py-2 bg-white hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-colors"
                />
              </div>
            </div>

            {/* Attachments */}
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Paperclip size={12} /> Attachments
              </p>
              <AttachmentList entityType="task" entityId={fullTask.id} />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
