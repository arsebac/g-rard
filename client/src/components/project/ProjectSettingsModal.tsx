import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext, DragEndEvent, PointerSensor,
  useSensor, useSensors, closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { projectsApi } from "@/api/projects";
import { labelsApi } from "@/api/labels";
import { ticketTypesApi, TicketType } from "@/api/ticketTypes";
import { projectColumnsApi, ProjectColumn } from "@/api/projectColumns";
import { workflowApi } from "@/api/workflow";
import {
  X, Settings, Tag, Layers, LayoutGrid, GitMerge,
  Check, Pencil, Trash2, GripVertical, Eye, EyeOff,
  ChevronRight, Save,
} from "lucide-react";

// ─── Palette couleurs ──────────────────────────────────────────────────────────

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

// ─── Onglet Général ────────────────────────────────────────────────────────────

function TabGeneral({ project }: { project: NonNullable<ReturnType<typeof useCurrentProject>["data"]> }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: project.name,
    description: project.description ?? "",
    color: project.color,
    key: project.key ?? "",
  });

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

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1.5">Nom du projet</label>
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
          placeholder="Description du projet…"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-2">Couleur</label>
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ backgroundColor: form.color }}>
            {form.name[0]?.toUpperCase()}
          </span>
          <ColorPicker value={form.color} onChange={(c) => setForm({ ...form, color: c })} />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Clé projet</label>
        <p className="text-xs text-gray-400 mb-1.5">Préfixe des tickets (ex: CUI-1). Non modifiable après création.</p>
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
          {save.isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
        {save.isSuccess && <p className="text-xs text-green-600 mt-2">Modifications enregistrées.</p>}
      </div>
    </div>
  );
}

// ─── Onglet Labels ─────────────────────────────────────────────────────────────

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
      <p className="text-sm text-gray-500">Les labels permettent de catégoriser les tickets de ce projet.</p>

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
        <p className="text-sm font-medium text-gray-700 mb-3">{editId !== null ? "Modifier le label" : "Nouveau label"}</p>
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") cancel(); }}
          placeholder="Nom du label…"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <div className="mb-3"><ColorPicker value={color} onChange={setColor} /></div>
        <div className="flex gap-2">
          <button onClick={submit} disabled={!name.trim()} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors">
            <Check size={12} />{editId !== null ? "Modifier" : "Créer"}
          </button>
          {editId !== null && <button onClick={cancel} className="text-xs text-gray-400 hover:text-gray-600 px-2">Annuler</button>}
        </div>
      </div>
    </div>
  );
}

// ─── Onglet Types de tickets ────────────────────────────────────────────────────

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
      <p className="text-sm text-gray-500">Les types définissent la nature des tickets. Les types marqués Epic peuvent être parents d'autres tickets.</p>

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
        <p className="text-sm font-medium text-gray-700 mb-3">{editId !== null ? "Modifier le type" : "Nouveau type"}</p>
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") cancel(); }}
          placeholder="Nom du type…"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <div className="mb-3"><ColorPicker value={color} onChange={setColor} /></div>
        <label className="flex items-center gap-2 text-sm text-gray-600 mb-3 cursor-pointer">
          <input type="checkbox" checked={isEpic} onChange={(e) => setIsEpic(e.target.checked)} className="rounded accent-purple-500" />
          Ce type est un <span className="font-semibold text-purple-600">Epic</span> (peut être parent d'autres tickets)
        </label>
        <div className="flex gap-2">
          <button onClick={submit} disabled={!name.trim()} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors">
            <Check size={12} />{editId !== null ? "Modifier" : "Créer"}
          </button>
          {editId !== null && <button onClick={cancel} className="text-xs text-gray-400 hover:text-gray-600 px-2">Annuler</button>}
        </div>
      </div>
    </div>
  );
}

// ─── Onglet Colonnes ────────────────────────────────────────────────────────────

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
        title={col.visible ? "Masquer cette colonne" : "Afficher cette colonne"}
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
        Personnalisez les colonnes du tableau Kanban : renommez-les, changez leur couleur, réorganisez-les par glisser-déposer, ou masquez celles dont vous n'avez pas besoin.
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
        Cliquez sur le nom pour le renommer. Cliquez sur la pastille couleur pour changer la couleur. L'ordre ici est l'ordre d'affichage dans le Kanban.
      </p>
    </div>
  );
}

// ─── Onglet Workflow ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  termine: "Terminé",
  bloque: "Bloqué",
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
        // Si non configuré → tout autorisé (true par défaut)
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
          Définissez quelles transitions sont autorisées entre les statuts.
          Une case cochée signifie que le ticket peut passer de la colonne <strong>ligne</strong> vers la colonne <strong>colonne</strong>.
        </p>
        {!configured && (
          <div className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
            Aucun workflow configuré — toutes les transitions sont actuellement autorisées.
            Enregistrez pour figer les règles.
          </div>
        )}
      </div>

      {/* Matrice */}
      <div className="overflow-x-auto">
        <table className="text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left p-2 text-xs text-gray-400 font-medium w-28">De ↓ / Vers →</th>
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
                        <span className="inline-block w-5 h-5 rounded bg-gray-100" title="Même statut" />
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

      {/* Résumé des transitions autorisées */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Transitions autorisées</p>
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
            <p className="text-xs text-gray-400">Aucune transition autorisée.</p>
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
          {save.isPending ? "Enregistrement…" : "Enregistrer le workflow"}
        </button>
        <button onClick={resetAll} className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2">
          Tout autoriser
        </button>
        {saved && <span className="text-xs text-green-600">Workflow enregistré.</span>}
      </div>

      <p className="text-xs text-gray-400">
        ⚠️ La validation des transitions dans le Kanban sera appliquée dans une prochaine version.
        Cette configuration prépare les règles qui seront enforced automatiquement.
      </p>
    </div>
  );
}

// ─── Tabs config ───────────────────────────────────────────────────────────────

type Tab = "general" | "labels" | "types" | "columns" | "workflow";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "general",  label: "Général",           icon: <Settings size={15} /> },
  { id: "labels",   label: "Labels",             icon: <Tag size={15} /> },
  { id: "types",    label: "Types de tickets",   icon: <Layers size={15} /> },
  { id: "columns",  label: "Colonnes",           icon: <LayoutGrid size={15} /> },
  { id: "workflow", label: "Workflow",           icon: <GitMerge size={15} /> },
];

// ─── Hook helper ──────────────────────────────────────────────────────────────

function useCurrentProject(projectId: number) {
  return useQuery({ queryKey: ["project", projectId], queryFn: () => projectsApi.get(projectId) });
}

// ─── Modal principale ──────────────────────────────────────────────────────────

interface ProjectSettingsModalProps {
  projectId: number;
  onClose: () => void;
  initialTab?: Tab;
}

export function ProjectSettingsModal({ projectId, onClose, initialTab = "general" }: ProjectSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const { data: project } = useCurrentProject(projectId);

  // Fermer sur Escape
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
              <h2 className="text-base font-semibold text-gray-900">Paramètres du projet</h2>
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
          </div>
        </div>
      </div>
    </div>
  );
}
