#!/usr/bin/env node
/**
 * Serveur MCP Gérard — pilotez votre gestionnaire de projets maison depuis Claude Code.
 *
 * Configuration requise dans l'environnement :
 *   GERARD_URL      URL de base de l'API (défaut : http://localhost:3000)
 *   GERARD_API_KEY  Clé API configurée dans GERARD_API_KEY côté serveur
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { api } from "./client.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project {
  id: number;
  name: string;
  key: string | null;
  description: string | null;
  color: string;
  status: string;
  _count?: { tasks: number };
}

interface Task {
  id: number;
  projectId: number;
  number: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: number | null;
  dueDate: string | null;
  projectKey?: string | null;
  assignee?: { id: number; name: string } | null;
  labels?: { label: { name: string; color: string } }[];
}

interface WikiPage {
  id: number;
  projectId: number | null;
  parentId: number | null;
  title: string;
  slug: string;
  contentType: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

interface ActivityLog {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  actor: { id: number; name: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function err(message: string) {
  return {
    content: [{ type: "text" as const, text: `Erreur : ${message}` }],
    isError: true,
  };
}

// ─── Server ───────────────────────────────────────────────────────────────────

const server = new Server(
  { name: "gerard", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ─── Tool definitions ─────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_projects",
      description: "Liste tous les projets actifs dans Gérard",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "list_tasks",
      description: "Liste les tâches d'un projet, avec filtres optionnels",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "number", description: "ID du projet" },
          status: {
            type: "string",
            enum: ["a_faire", "en_cours", "termine", "bloque"],
            description: "Filtrer par statut",
          },
          assigneeId: { type: "number", description: "Filtrer par assignée (user ID)" },
        },
        required: ["projectId"],
      },
    },
    {
      name: "search_tasks",
      description: "Recherche fulltext dans les tâches (titre et description)",
      inputSchema: {
        type: "object",
        properties: {
          q: { type: "string", description: "Termes de recherche (min 2 caractères)" },
          projectId: { type: "number", description: "Restreindre à un projet (optionnel)" },
        },
        required: ["q"],
      },
    },
    {
      name: "get_task",
      description: "Récupère le détail d'une tâche par son ID ou sa référence (ex: CUI-4)",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "number", description: "ID numérique de la tâche" },
          ref: { type: "string", description: "Référence style CUI-4 (alternative à id)" },
        },
      },
    },
    {
      name: "create_task",
      description: "Crée une nouvelle tâche dans un projet",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "number", description: "ID du projet" },
          title: { type: "string", description: "Titre de la tâche" },
          description: { type: "string", description: "Description (texte libre ou JSON Tiptap)" },
          status: {
            type: "string",
            enum: ["a_faire", "en_cours", "termine", "bloque"],
            default: "a_faire",
          },
          priority: {
            type: "string",
            enum: ["basse", "normale", "haute", "urgente"],
            default: "normale",
          },
          assigneeId: { type: "number", description: "ID de l'utilisateur assigné" },
          dueDate: { type: "string", description: "Date d'échéance au format YYYY-MM-DD" },
        },
        required: ["projectId", "title"],
      },
    },
    {
      name: "update_task",
      description: "Modifie une tâche existante",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "number", description: "ID de la tâche" },
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["a_faire", "en_cours", "termine", "bloque"] },
          priority: { type: "string", enum: ["basse", "normale", "haute", "urgente"] },
          assigneeId: { type: ["number", "null"] },
          dueDate: { type: ["string", "null"], description: "YYYY-MM-DD ou null pour effacer" },
        },
        required: ["id"],
      },
    },
    {
      name: "move_task",
      description: "Déplace une tâche vers une autre colonne du kanban",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "number", description: "ID de la tâche" },
          status: {
            type: "string",
            enum: ["a_faire", "en_cours", "termine", "bloque"],
            description: "Nouvelle colonne",
          },
        },
        required: ["id", "status"],
      },
    },
    {
      name: "list_wiki_pages",
      description: "Liste les pages wiki d'un projet (ou le wiki global si pas de projectId)",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "number", description: "ID du projet (optionnel)" },
        },
      },
    },
    {
      name: "get_wiki_page",
      description: "Récupère le contenu d'une page wiki par son ID",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "number", description: "ID de la page wiki" },
        },
        required: ["id"],
      },
    },
    {
      name: "create_wiki_page",
      description: "Crée une nouvelle page wiki",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "number", description: "ID du projet (null = wiki global)" },
          parentId: { type: "number", description: "ID de la page parente (optionnel)" },
          title: { type: "string", description: "Titre de la page" },
          body: { type: "string", description: "Contenu en markdown" },
          contentType: {
            type: "string",
            enum: ["tiptap", "markdown"],
            default: "markdown",
          },
        },
        required: ["title", "body"],
      },
    },
    {
      name: "get_activity",
      description: "Récupère l'historique d'activité d'une tâche ou d'un projet",
      inputSchema: {
        type: "object",
        properties: {
          entityType: { type: "string", enum: ["task", "project"] },
          entityId: { type: "number" },
          limit: { type: "number", default: 20 },
        },
        required: ["entityType", "entityId"],
      },
    },
  ],
}));

// ─── Tool handlers ────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // ── Projects ──────────────────────────────────────────────────────────
      case "list_projects": {
        const projects = await api.get<Project[]>("/api/projects");
        return ok(projects.map((p) => ({
          id: p.id,
          name: p.name,
          key: p.key,
          description: p.description,
          color: p.color,
          taskCount: p._count?.tasks ?? 0,
        })));
      }

      // ── Tasks ─────────────────────────────────────────────────────────────
      case "list_tasks": {
        const { projectId, status, assigneeId } = z
          .object({
            projectId: z.number(),
            status: z.string().optional(),
            assigneeId: z.number().optional(),
          })
          .parse(args);

        const params = new URLSearchParams();
        if (status) params.set("status", status);
        if (assigneeId) params.set("assigneeId", String(assigneeId));
        const qs = params.toString();

        const tasks = await api.get<Task[]>(
          `/api/projects/${projectId}/tasks${qs ? `?${qs}` : ""}`
        );
        return ok(tasks.map(formatTask));
      }

      case "search_tasks": {
        const { q, projectId } = z
          .object({ q: z.string().min(2), projectId: z.number().optional() })
          .parse(args);

        const params = new URLSearchParams({ q });
        if (projectId !== undefined) params.set("projectId", String(projectId));

        const results = await api.get<unknown[]>(`/api/search?${params}`);
        return ok(results);
      }

      case "get_task": {
        const { id, ref } = z
          .object({ id: z.number().optional(), ref: z.string().optional() })
          .parse(args);

        if (ref) {
          const match = ref.match(/^([A-Z]+)-(\d+)$/i);
          if (!match) return err("Format de référence invalide (ex: CUI-4)");
          const task = await api.get<Task>(`/api/tasks/ref/${match[1]}/${match[2]}`);
          return ok(formatTask(task));
        }

        if (id !== undefined) {
          const task = await api.get<Task>(`/api/tasks/${id}`);
          return ok(formatTask(task));
        }

        return err("Fournir id ou ref");
      }

      case "create_task": {
        const data = z
          .object({
            projectId: z.number(),
            title: z.string().min(1),
            description: z.string().optional(),
            status: z.enum(["a_faire", "en_cours", "termine", "bloque"]).default("a_faire"),
            priority: z.enum(["basse", "normale", "haute", "urgente"]).default("normale"),
            assigneeId: z.number().optional(),
            dueDate: z.string().optional(),
          })
          .parse(args);

        const { projectId, ...body } = data;
        const task = await api.post<Task>(`/api/projects/${projectId}/tasks`, body);
        return ok(formatTask(task));
      }

      case "update_task": {
        const { id, ...body } = z
          .object({
            id: z.number(),
            title: z.string().optional(),
            description: z.string().optional(),
            status: z.enum(["a_faire", "en_cours", "termine", "bloque"]).optional(),
            priority: z.enum(["basse", "normale", "haute", "urgente"]).optional(),
            assigneeId: z.number().nullable().optional(),
            dueDate: z.string().nullable().optional(),
          })
          .parse(args);

        const task = await api.patch<Task>(`/api/tasks/${id}`, body);
        return ok(formatTask(task));
      }

      case "move_task": {
        const { id, status } = z
          .object({
            id: z.number(),
            status: z.enum(["a_faire", "en_cours", "termine", "bloque"]),
          })
          .parse(args);

        const task = await api.patch<Task>(`/api/tasks/${id}/move`, { status, position: 0 });
        return ok(formatTask(task));
      }

      // ── Wiki ──────────────────────────────────────────────────────────────
      case "list_wiki_pages": {
        const { projectId } = z
          .object({ projectId: z.number().optional() })
          .parse(args ?? {});

        const pages = await api.get<WikiPage[]>(
          projectId !== undefined
            ? `/api/projects/${projectId}/wiki`
            : "/api/wiki"
        );
        return ok(
          pages.map((p) => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            parentId: p.parentId,
            updatedAt: p.updatedAt,
          }))
        );
      }

      case "get_wiki_page": {
        const { id } = z.object({ id: z.number() }).parse(args);
        const page = await api.get<WikiPage>(`/api/wiki/pages/${id}`);
        return ok(page);
      }

      case "create_wiki_page": {
        const data = z
          .object({
            projectId: z.number().optional(),
            parentId: z.number().optional(),
            title: z.string().min(1),
            body: z.string(),
            contentType: z.enum(["tiptap", "markdown"]).default("markdown"),
          })
          .parse(args);

        const page = await api.post<WikiPage>("/api/wiki/pages", data);
        return ok({ id: page.id, title: page.title, slug: page.slug });
      }

      // ── Activity ──────────────────────────────────────────────────────────
      case "get_activity": {
        const { entityType, entityId, limit } = z
          .object({
            entityType: z.enum(["task", "project"]),
            entityId: z.number(),
            limit: z.number().default(20),
          })
          .parse(args);

        const path =
          entityType === "task"
            ? `/api/tasks/${entityId}/activity`
            : `/api/projects/${entityId}/activity`;

        const logs = await api.get<ActivityLog[]>(`${path}?limit=${limit}`);
        return ok(
          logs.map((l) => ({
            id: l.id,
            action: l.action,
            actor: l.actor.name,
            oldValue: l.oldValue ? JSON.parse(l.oldValue) : null,
            newValue: l.newValue ? JSON.parse(l.newValue) : null,
            createdAt: l.createdAt,
          }))
        );
      }

      default:
        return err(`Outil inconnu : ${name}`);
    }
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
});

// ─── Task formatter ───────────────────────────────────────────────────────────

function formatTask(t: Task) {
  return {
    id: t.id,
    ref: t.projectKey ? `${t.projectKey}-${t.number}` : null,
    title: t.title,
    status: t.status,
    priority: t.priority,
    assignee: t.assignee?.name ?? null,
    dueDate: t.dueDate,
    labels: t.labels?.map((l) => l.label.name) ?? [],
  };
}

// ─── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
