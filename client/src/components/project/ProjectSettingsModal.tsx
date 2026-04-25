import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  DndContext, DragEndEvent, PointerSensor,
  useSensor, useSensors, closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { projectsApi, membersApi, type ProjectMemberRole } from "@/api/projects";
import { labelsApi } from "@/api/labels";
import { usersApi } from "@/api/users";
import { useAuthStore } from "@/store/auth";
import { ticketTypesApi, TicketType } from "@/api/ticketTypes";
import { projectColumnsApi, ProjectColumn } from "@/api/projectColumns";
import { workflowApi } from "@/api/workflow";
import {
  X, Settings, Tag, Layers, LayoutGrid, GitMerge,
  Check, Pencil, Trash2, GripVertical, Eye, EyeOff,
  ChevronRight, Save, Users,
} from "lucide-react";

// ─── Color palette ─────────────────────────────────────────────────────────────

const COLORS = [
  "#ef4444","#f97316","#eab308","#22c55e",
  "#06b6d4","#3b82f6","#6366f1","#8b5cf6",
  "#ec4899","#94a3b8",
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${value === c ? "ring-2 ring-offset-1 ring-gray-500 scale-110" : ""}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

// ─── General tab ───────────────────────────────────────────────────────────────

function TabGeneral({ project }: { project: NonNullable<ReturnType<typeof useCurrentProject>["data"]> }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: project.name,
    description: project.description ?? "",
    color: project.color,
    key: project.key ?? "",
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const save = useMutation({
    mutationFn: () => projectsApi.update(project.id, {
      name: form.name,
      description: form.description || undefined,
      color: form.color,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const archive = useMutation({
    mutationFn: () => projectsApi.delete(project.id, false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate({ to: "/" });
    },
  });

  const hardDelete = useMutation({
    mutationFn: () => projectsApi.delete(project.id, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate({ to: "/" });
    },
  });

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1.5">Project name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1.5">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="Project description…"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-2">Color</label>
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ backgroundColor: form.color }}>
            {form.name[0]?.toUpperCase()}
          </span>
          <ColorPicker value={form.color} onChange={(c) => setForm({ ...form, color: c })} />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Project key</label>
        <p className="text-xs text-gray-400 mb-1.5">Ticket prefix (e.g. CUI-1). Cannot be changed after creation.</p>
        <input
          type="text"
          value={form.key}
          disabled
          className="w-32 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-400 font-mono uppercase cursor-not-allowed"
        />
      </div>

      <div className="pt-2">
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending || !form.name.trim()}
          className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Save size={14} />
          {save.isPending ? "Saving…" : "Save"}
        </button>
        {save.isSuccess && <p className="text-xs text-green-600 mt-2">Changes saved.</p>}
      </div>

      <div className="mt-8 pt-8 border-t border-red-100">
        <h3 className="text-sm font-semibold text-red-600 mb-4">Danger Zone</h3>
        
        {!showDeleteConfirm ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between p-4 rounded-xl border border-red-100 bg-red-50/30">
              <div>
                <p className="text-sm font-medium text-gray-900">Archive project</p>
                <p className="text-xs text-gray-500">The project will be hidden but data is preserved.</p>
              </div>
              <button
                onClick={() => archive.mutate()}
                disabled={archive.isPending}
                className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
              >
                Archive
              </button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-red-100 bg-red-50/30">
              <div>
                <p className="text-sm font-medium text-gray-900">Delete project</p>
                <p className="text-xs text-gray-500">Permanently remove this project and all its data.</p>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-red-200 bg-red-50">
            <p className="text-sm font-bold text-red-700 mb-1">Are you absolutely sure?</p>
            <p className="text-xs text-red-600 mb-4">
              This action cannot be undone. All tasks, wiki pages, and history for <strong>{project.name}</strong> will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => hardDelete.mutate()}
                disabled={hardDelete.isPending}
                className="px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm"
              >
                {hardDelete.isPending ? "Deleting..." : "Yes, delete everything"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white rounded-lg transition-colors border border-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Labels tab ────────────────────────────────────────────────────────────────

function TabLabels({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);

  const { data: project } = useQuery({ queryKey: ["project", projectId], queryFn: () => projectsApi.get(projectId) });
  const labels = project?.labels ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["project", projectId] });

  const create = useMutation({ mutationFn: () => labelsApi.create(projectId, { name: name.trim(), color }), onSuccess: () => { invalidate(); setName(""); setColor(COLORS[0]); } });
  const update = useMutation({ mutationFn: (id: number) => labelsApi.update(id, { name: name.trim(), color }), onSuccess: () => { invalidate(); setEditId(null); setName(""); setColor(COLORS[0]); } });
  const del = useMutation({ mutationFn: (id: number) => labelsApi.delete(id), onSuccess: invalidate });

  const startEdit = (l: { id: number; name: string; color: string }) => { setEditId(l.id); setName(l.name); setColor(l.color); };
  const cancel = () => { setEditId(null); setName(""); setColor(COLORS[0]); };
  const submit = () => { if (!name.trim()) return; editId !== null ? update.mutate(editId) : create.mutate(); };

  return (
    <div className="flex flex-col gap-5 max-w-lg">
      <p className="text-sm text-gray-500">Labels allow you to categorize tickets in this project.</p>

      {labels.length > 0 && (
        <div className="flex flex-col gap-1">
          {labels.map((label) => (
            <div key={label.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 bg-gray-50 group">
              <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: label.color }} />
              <span
                className="flex-1 text-sm font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: label.color + "20", color: label.color }}
              >
                {label.name}
              </span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => startEdit(label)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-md hover:bg-white transition-colors"><Pencil size={13} /></button>
                <button onClick={() => del.mutate(label.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-white transition-colors"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border border-gray-200 rounded-xl p-4 bg-white">
        <p className="text-sm font-medium text-gray-700 mb-3">{editId !== null ? "Edit label" : "New label"}</p>
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") cancel(); }}
          placeholder="Label name…"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <div className="mb-3"><ColorPicker value={color} onChange={setColor} /></div>
        <div className="flex gap-2">
          <button onClick={submit} disabled={!name.trim()} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors">
            <Check size={12} />{editId !== null ? "Edit" : "Create"}
          </button>
          {editId !== null && <button onClick={cancel} className="text-xs text-gray-400 hover:text-gray-600 px-2">Cancel</button>}
        </div>
      </div>
    </div>
  );
}

// ─── Ticket types tab ──────────────────────────────────────────────────────────

function TabTicketTypes({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[5]);
  const [isEpic, setIsEpic] = useState(false);

  const { data: types = [] } = useQuery({ queryKey: ["ticket-types", projectId], queryFn: () => ticketTypesApi.list(projectId) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["ticket-types", projectId] });

  const create = useMutation({ mutationFn: () => ticketTypesApi.create(projectId, { name: name.trim(), color, isEpic, position: types.length }), onSuccess: () => { invalidate(); setName(""); setColor(COLORS[5]); setIsEpic(false); } });
  const upd = useMutation({ mutationFn: (id: number) => ticketTypesApi.update(id, { name: name.trim(), color, isEpic }), onSuccess: () => { invalidate(); setEditId(null); setName(""); setColor(COLORS[5]); setIsEpic(false); } });
  const del = useMutation({ mutationFn: (id: number) => ticketTypesApi.delete(id), onSuccess: invalidate });

  const startEdit = (t: TicketType) => { setEditId(t.id); setName(t.name); setColor(t.color); setIsEpic(t.isEpic); };
  const cancel = () => { setEditId(null); setName(""); setColor(COLORS[5]); setIsEpic(false); };
  const submit = () => { if (!name.trim()) return; editId !== null ? upd.mutate(editId) : create.mutate(); };

  return (
    <div className="flex flex-col gap-5 max-w-lg">
      <p className="text-sm text-gray-500">Types define the nature of tickets. Types marked as Epic can be parents of other tickets.</p>

      {types.length > 0 && (
        <div className="flex flex-col gap-1">
          {types.map((type) => (
            <div key={type.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 bg-gray-50 group">
              <span className="w-4 h-4 rounded flex-shrink-0" style={{ backgroundColor: type.color }} />
              <span className="flex-1 text-sm font-semibold px-2.5 py-0.5 rounded-lg" style={{ backgroundColor: type.color + "20", color: type.color }}>
                {type.name}
              </span>
              {type.isEpic && (
                <span className="text-xs font-medium text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full">Epic</span>
              )}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => startEdit(type)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-md hover:bg-white transition-colors"><Pencil size={13} /></button>
                <button onClick={() => del.mutate(type.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-white transition-colors"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border border-gray-200 rounded-xl p-4 bg-white">
        <p className="text-sm font-medium text-gray-700 mb-3">{editId !== null ? "Edit type" : "New type"}</p>
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") cancel(); }}
          placeholder="Type name…"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <div className="mb-3"><ColorPicker value={color} onChange={setColor} /></div>
        <label className="flex items-center gap-2 text-sm text-gray-600 mb-3 cursor-pointer">
          <input type="checkbox" checked={isEpic} onChange={(e) => setIsEpic(e.target.checked)} className="rounded accent-purple-500" />
          This type is an <span className="font-semibold text-purple-600">Epic</span> (can be parent of other tickets)
        </label>
        <div className="flex gap-2">
          <button onClick={submit} disabled={!name.trim()} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors">
            <Check size={12} />{editId !== null ? "Edit" : "Create"}
          </button>
          {editId !== null && <button onClick={cancel} className="text-xs text-gray-400 hover:text-gray-600 px-2">Cancel</button>}
        </div>
      </div>
    </div>
  );
}

// ─── Columns tab ───────────────────────────────────────────────────────────────

function SortableColumnRow({
  col,
  onUpdate,
}: {
  col: ProjectColumn;
  onUpdate: (statusKey: string, data: Partial<ProjectColumn>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: col.statusKey });

  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(col.label);
  const [color, setColor] = useState(col.color);
  const [showColor, setShowColor] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    setEditing(false);
    setShowColor(false);
    if (label.trim() !== col.label || color !== col.color) {
      onUpdate(col.statusKey, { label: label.trim() || col.label, color });
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white group"
    >
      {/* Drag handle */}
      <button {...attributes} {...listeners} className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing">
        <GripVertical size={16} />
      </button>

      {/* Color dot */}
      <div className="relative">
        <button
          onClick={() => setShowColor(!showColor)}
          className="w-5 h-5 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform"
          style={{ backgroundColor: color }}
        />
        {showColor && (
          <div className="absolute left-0 top-7 z-10 bg-white border border-gray-200 rounded-xl shadow-lg p-3" onClick={(e) => e.stopPropagation()}>
            <ColorPicker value={color} onChange={(c) => { setColor(c); }} />
            <button onClick={commit} className="mt-2 w-full text-xs py-1 bg-indigo-600 text-white rounded-lg">OK</button>
          </div>
        )}
      </div>

      {/* Label */}
      {editing ? (
        <input
          ref={inputRef}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setEditing(false); setLabel(col.label); } }}
          className="flex-1 text-sm font-medium border-b border-indigo-400 outline-none bg-transparent py-0.5"
        />
      ) : (
        <span
          className="flex-1 text-sm font-medium text-gray-800 cursor-text"
          onClick={() => setEditing(true)}
        >
          {col.label}
        </span>
      )}

      {/* Status key badge */}
      <span className="text-xs font-mono text-gray-300">{col.statusKey}</span>

      {/* Edit label button */}
      {!editing && (
        <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600 transition-opacity">
          <Pencil size={13} />
        </button>
      )}

      {/* Visibility toggle */}
      <button
        onClick={() => onUpdate(col.statusKey, { visible: !col.visible })}
        className={`transition-colors ${col.visible ? "text-gray-400 hover:text-gray-600" : "text-gray-200 hover:text-gray-400"}`}
        title={col.visible ? "Hide this column" : "Show this column"}
      >
        {col.visible ? <Eye size={15} /> : <EyeOff size={15} />}
      </button>
    </div>
  );
}

function TabColumns({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const [localCols, setLocalCols] = useState<ProjectColumn[]>([]);

  const { data: columns = [] } = useQuery({
    queryKey: ["columns", projectId],
    queryFn: () => projectColumnsApi.list(projectId),
  });

  useEffect(() => { if (columns.length) setLocalCols(columns); }, [columns]);

  const updateCol = useMutation({
    mutationFn: ({ statusKey, data }: { statusKey: string; data: Partial<ProjectColumn> }) =>
      projectColumnsApi.update(projectId, statusKey, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["columns", projectId] }),
  });

  const reorder = useMutation({
    mutationFn: (order: string[]) => projectColumnsApi.reorder(projectId, order),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["columns", projectId] }),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = localCols.findIndex((c) => c.statusKey === active.id);
    const newIdx = localCols.findIndex((c) => c.statusKey === over.id);
    const reordered = arrayMove(localCols, oldIdx, newIdx);
    setLocalCols(reordered);
    reorder.mutate(reordered.map((c) => c.statusKey));
  };

  const handleUpdate = (statusKey: string, data: Partial<ProjectColumn>) => {
    setLocalCols((prev) => prev.map((c) => c.statusKey === statusKey ? { ...c, ...data } : c));
    updateCol.mutate({ statusKey, data });
  };

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      <p className="text-sm text-gray-500">
        Customize the Kanban board columns: rename them, change their color, reorder them by drag and drop, or hide the ones you don't need.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={localCols.map((c) => c.statusKey)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {localCols.map((col) => (
              <SortableColumnRow key={col.statusKey} col={col} onUpdate={handleUpdate} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <p className="text-xs text-gray-400">
        Click on the name to rename it. Click on the color dot to change the color. The order here is the display order in the Kanban.
      </p>
    </div>
  );
}

// ─── Workflow tab ──────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  a_faire: "To do",
  en_cours: "In progress",
  termine: "Done",
  bloque: "Blocked",
};

const ALL_STATUSES = ["a_faire", "en_cours", "termine", "bloque"];

function TabWorkflow({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({});
  const [configured, setConfigured] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: columns = [] } = useQuery({
    queryKey: ["columns", projectId],
    queryFn: () => projectColumnsApi.list(projectId),
  });

  const { data: transitions = [] } = useQuery({
    queryKey: ["workflow", projectId],
    queryFn: () => workflowApi.get(projectId),
  });

  // Statuses dans l'ordre des colonnes
  const statuses = columns.length > 0
    ? columns.filter((c) => c.visible).map((c) => c.statusKey)
    : ALL_STATUSES;

  // Initialiser la matrice
  useEffect(() => {
    const isConfigured = transitions.length > 0;
    setConfigured(isConfigured);
    const m: Record<string, Record<string, boolean>> = {};
    statuses.forEach((from) => {
      m[from] = {};
      statuses.forEach((to) => {
        if (from === to) { m[from][to] = false; return; }
        // If not configured → all transitions allowed (true by default)
        m[from][to] = isConfigured
          ? transitions.some((t) => t.fromStatus === from && t.toStatus === to)
          : true;
      });
    });
    setMatrix(m);
  }, [transitions, columns]);

  const toggle = (from: string, to: string) => {
    setMatrix((prev) => ({
      ...prev,
      [from]: { ...prev[from], [to]: !prev[from][to] },
    }));
    setSaved(false);
  };

  const save = useMutation({
    mutationFn: () => {
      const t: { fromStatus: string; toStatus: string }[] = [];
      statuses.forEach((from) => {
        statuses.forEach((to) => {
          if (from !== to && matrix[from]?.[to]) t.push({ fromStatus: from, toStatus: to });
        });
      });
      return workflowApi.save(projectId, t);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow", projectId] });
      setConfigured(true);
      setSaved(true);
    },
  });

  const resetAll = () => {
    const m: Record<string, Record<string, boolean>> = {};
    statuses.forEach((from) => {
      m[from] = {};
      statuses.forEach((to) => { m[from][to] = from !== to; });
    });
    setMatrix(m);
    setSaved(false);
  };

  const colLabel = (key: string) =>
    columns.find((c) => c.statusKey === key)?.label ?? STATUS_LABELS[key] ?? key;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-gray-500 mb-1">
          Define which transitions are allowed between statuses.
          A checked box means the ticket can move from the <strong>row</strong> column to the <strong>column</strong> column.
        </p>
        {!configured && (
          <div className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
            No workflow configured — all transitions are currently allowed.
            Save to lock the rules.
          </div>
        )}
      </div>

      {/* Matrice */}
      <div className="overflow-x-auto">
        <table className="text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left p-2 text-xs text-gray-400 font-medium w-28">From ↓ / To →</th>
              {statuses.map((to) => (
                <th key={to} className="p-2 text-center min-w-[90px]">
                  <span className="text-xs font-medium text-gray-700 block">{colLabel(to)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {statuses.map((from) => (
              <tr key={from} className="border-t border-gray-100">
                <td className="p-2 text-xs font-medium text-gray-700 whitespace-nowrap">{colLabel(from)}</td>
                {statuses.map((to) => {
                  const isSelf = from === to;
                  const checked = matrix[from]?.[to] ?? false;
                  return (
                    <td key={to} className="p-2 text-center">
                      {isSelf ? (
                        <span className="inline-block w-5 h-5 rounded bg-gray-100" title="Same status" />
                      ) : (
                        <button
                          onClick={() => toggle(from, to)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-colors ${
                            checked
                              ? "bg-indigo-600 border-indigo-600 text-white"
                              : "border-gray-300 hover:border-indigo-400"
                          }`}
                        >
                          {checked && <Check size={12} />}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Allowed transitions summary */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Allowed transitions</p>
        <div className="flex flex-col gap-1">
          {statuses.flatMap((from) =>
            statuses
              .filter((to) => from !== to && matrix[from]?.[to])
              .map((to) => (
                <div key={`${from}-${to}`} className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">{colLabel(from)}</span>
                  <ChevronRight size={14} className="text-gray-400" />
                  <span className="text-gray-600">{colLabel(to)}</span>
                </div>
              ))
          )}
          {statuses.every((from) => statuses.filter((to) => from !== to && matrix[from]?.[to]).length === 0) && (
            <p className="text-xs text-gray-400">No transitions allowed.</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Save size={14} />
          {save.isPending ? "Saving…" : "Save workflow"}
        </button>
        <button onClick={resetAll} className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2">
          Allow all
        </button>
        {saved && <span className="text-xs text-green-600">Workflow saved.</span>}
      </div>
    </div>
  );
}

// ─── Members tab ───────────────────────────────────────────────────────────────

const ROLE_OPTIONS: { value: ProjectMemberRole; label: string }[] = [
  { value: "admin",  label: "Admin" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
];

const ROLE_BADGE: Record<ProjectMemberRole, string> = {
  admin:  "bg-indigo-50 text-indigo-700 border border-indigo-200",
  member: "bg-gray-100 text-gray-600 border border-gray-200",
  viewer: "bg-amber-50 text-amber-700 border border-amber-200",
};

function MemberAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />;
  }
  return (
    <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
      {name[0]?.toUpperCase()}
    </span>
  );
}

function TabMembers({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [addUserId, setAddUserId] = useState<number | "">("");
  const [addRole, setAddRole] = useState<ProjectMemberRole>("member");

  const { data: members = [], isLoading, isError: membersError } = useQuery({
    queryKey: ["members", projectId],
    queryFn: () => membersApi.list(projectId),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["members", projectId] });

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: ProjectMemberRole }) =>
      membersApi.updateRole(projectId, userId, role),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (userId: number) => membersApi.remove(projectId, userId),
    onSuccess: invalidate,
  });

  const add = useMutation({
    mutationFn: () => membersApi.add(projectId, { userId: addUserId as number, role: addRole }),
    onSuccess: () => { invalidate(); setAddUserId(""); setAddRole("member"); },
  });

  const myRole = members.find((m) => m.userId === currentUser?.id)?.role;
  const isAdmin = myRole === "admin";
  const adminCount = members.filter((m) => m.role === "admin").length;

  const nonMembers = allUsers.filter((u) => !members.some((m) => m.userId === u.id));

  if (isLoading) return <div className="text-sm text-gray-400">Loading…</div>;

  if (membersError) {
    return <div className="text-sm text-red-500">Failed to load members. Make sure the server is running and up to date.</div>;
  }

  return (
    <div className="flex flex-col gap-5 max-w-lg">
      <p className="text-sm text-gray-500">
        {members.length} member{members.length !== 1 ? "s" : ""} in this project.
      </p>

      {/* Error banners */}
      {updateRole.isError && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          Failed to update role: {(updateRole.error as Error)?.message ?? "Unknown error"}
        </div>
      )}
      {remove.isError && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          Failed to remove member: {(remove.error as Error)?.message ?? "Unknown error"}
        </div>
      )}

      {/* Last-admin notice */}
      {isAdmin && adminCount <= 1 && members.length > 0 && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          You are the only admin. Promote another member to admin before changing your own role.
        </div>
      )}

      {/* Member list */}
      <div className="flex flex-col gap-1">
        {members.map((m) => {
          const isLastAdmin = m.role === "admin" && adminCount <= 1;
          const isMe = m.userId === currentUser?.id;
          return (
            <div
              key={m.userId}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50"
            >
              <MemberAvatar name={m.user.name} avatarUrl={m.user.avatarUrl} />
              <span className="flex-1 text-sm font-medium text-gray-800">
                {m.user.name}
                {isMe && <span className="ml-1.5 text-xs text-gray-400">(you)</span>}
              </span>

              {isAdmin ? (
                <select
                  value={m.role}
                  disabled={isLastAdmin || updateRole.isPending}
                  onChange={(e) => updateRole.mutate({ userId: m.userId, role: e.target.value as ProjectMemberRole })}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${ROLE_BADGE[m.role] ?? ROLE_BADGE.member}`}>
                  {ROLE_OPTIONS.find((o) => o.value === m.role)?.label ?? m.role}
                </span>
              )}

              {isAdmin && (
                <button
                  onClick={() => remove.mutate(m.userId)}
                  disabled={isLastAdmin || remove.isPending}
                  className="p-1.5 text-gray-300 hover:text-red-500 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title={isLastAdmin ? "Cannot remove the last admin" : "Remove member"}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add member (admin only) */}
      {isAdmin && nonMembers.length > 0 && (
        <div className="border border-gray-200 rounded-xl p-4 bg-white">
          <p className="text-sm font-medium text-gray-700 mb-3">Add member</p>
          <div className="flex gap-2">
            <select
              value={addUserId}
              onChange={(e) => setAddUserId(e.target.value === "" ? "" : parseInt(e.target.value))}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">Select a user…</option>
              {nonMembers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <select
              value={addRole}
              onChange={(e) => setAddRole(e.target.value as ProjectMemberRole)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              onClick={() => add.mutate()}
              disabled={addUserId === "" || add.isPending}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Check size={13} />
              Add
            </button>
          </div>
          {add.isError && (
            <p className="text-xs text-red-500 mt-2">
              {(add.error as Error)?.message ?? "Failed to add member."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tabs config ───────────────────────────────────────────────────────────────

type Tab = "general" | "labels" | "types" | "columns" | "workflow" | "members";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "general",  label: "General",        icon: <Settings size={15} /> },
  { id: "labels",   label: "Labels",         icon: <Tag size={15} /> },
  { id: "types",    label: "Ticket types",   icon: <Layers size={15} /> },
  { id: "columns",  label: "Columns",        icon: <LayoutGrid size={15} /> },
  { id: "workflow", label: "Workflow",        icon: <GitMerge size={15} /> },
  { id: "members",  label: "Members",        icon: <Users size={15} /> },
];

// ─── Hook helper ──────────────────────────────────────────────────────────────

function useCurrentProject(projectId: number) {
  return useQuery({ queryKey: ["project", projectId], queryFn: () => projectsApi.get(projectId) });
}

// ─── Main modal ────────────────────────────────────────────────────────────────

interface ProjectSettingsModalProps {
  projectId: number;
  onClose: () => void;
  initialTab?: Tab;
}

export function ProjectSettingsModal({ projectId, onClose, initialTab = "general" }: ProjectSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const { data: project } = useCurrentProject(projectId);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            {project && (
              <span
                className="w-7 h-7 rounded-md flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                style={{ backgroundColor: project.color }}
              >
                {project.name[0]?.toUpperCase()}
              </span>
            )}
            <div>
              <h2 className="text-base font-semibold text-gray-900">Project settings</h2>
              {project && <p className="text-xs text-gray-400">{project.name}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body : sidebar + content */}
        <div className="flex flex-1 overflow-hidden">

          {/* Sidebar */}
          <nav className="w-48 flex-shrink-0 border-r border-gray-100 py-3 bg-gray-50/60">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors text-left ${
                  activeTab === tab.id
                    ? "text-indigo-700 bg-indigo-50 border-r-2 border-indigo-600"
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                }`}
              >
                <span className={activeTab === tab.id ? "text-indigo-600" : "text-gray-400"}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {project && activeTab === "general"  && <TabGeneral project={project} />}
            {activeTab === "labels"   && <TabLabels projectId={projectId} />}
            {activeTab === "types"    && <TabTicketTypes projectId={projectId} />}
            {activeTab === "columns"  && <TabColumns projectId={projectId} />}
            {activeTab === "workflow" && <TabWorkflow projectId={projectId} />}
            {activeTab === "members"  && <TabMembers projectId={projectId} />}
          </div>
        </div>
      </div>
    </div>
  );
}
