# Gérard — Plan de développement

> Clone local de Jira + Confluence pour gérer les projets de rénovation maison à deux.

---

## Stack technique

| Couche | Choix | Raison |
|---|---|---|
| Backend | Node.js + Fastify + TypeScript | Léger, rapide, parfait pour usage local |
| ORM | Prisma | Support MariaDB natif, migrations simples |
| Base de données | MariaDB | Robuste, SQL standard |
| Frontend | React + Vite + TypeScript | Moderne, DX excellent |
| State serveur | TanStack Query | Cache, refetch, optimistic updates |
| Routing | TanStack Router | Type-safe, file-based |
| UI | shadcn/ui + Tailwind CSS | Composants propres, zéro CSS custom |
| Kanban DnD | dnd-kit | Léger, accessible |
| Rich text | Tiptap | Headless, supporte WYSIWYG et import MD |
| Auth | Sessions (bcrypt + fastify-session) | Suffisant pour 2 utilisateurs |
| Déploiement | Docker Compose | MariaDB + app Node sur serveur maison |

---

## Schéma base de données

### Tables principales

```sql
users
  id            INT PK AUTO_INCREMENT
  name          VARCHAR(100)           -- "Marie", "Thomas"
  email         VARCHAR(255) UNIQUE
  password_hash VARCHAR(255)
  avatar_url    VARCHAR(500) NULL
  created_at    DATETIME

projects
  id            INT PK AUTO_INCREMENT
  name          VARCHAR(255)           -- "Cuisine", "Salle de bain"
  key           VARCHAR(10)            -- "CUI", "SDB" (clé courte unique)
  description   TEXT NULL
  color         VARCHAR(7)             -- couleur hex pour le badge UI
  status        ENUM('actif','archivé') DEFAULT 'actif'
  created_by    INT FK -> users.id
  created_at    DATETIME
  updated_at    DATETIME

labels
  id            INT PK AUTO_INCREMENT
  project_id    INT FK -> projects.id
  name          VARCHAR(100)
  color         VARCHAR(7)

tasks
  id            INT PK AUTO_INCREMENT
  project_id    INT FK -> projects.id
  number        INT                    -- numéro séquentiel par projet (CUI-1, CUI-2…)
  title         VARCHAR(500)
  description   TEXT NULL              -- Tiptap JSON
  status        ENUM('à_faire','en_cours','terminé','bloqué') DEFAULT 'à_faire'
  priority      ENUM('basse','normale','haute','urgente')     DEFAULT 'normale'
  assignee_id   INT FK -> users.id NULL
  created_by    INT FK -> users.id
  due_date      DATE NULL
  position      INT                    -- ordre dans la colonne kanban
  created_at    DATETIME
  updated_at    DATETIME

task_labels                            -- many-to-many
  task_id       INT FK -> tasks.id
  label_id      INT FK -> labels.id
  PRIMARY KEY (task_id, label_id)

comments
  id            INT PK AUTO_INCREMENT
  task_id       INT FK -> tasks.id
  author_id     INT FK -> users.id
  body          TEXT                   -- texte brut
  created_at    DATETIME
  updated_at    DATETIME

attachments
  id            INT PK AUTO_INCREMENT
  entity_type   ENUM('task','project','wiki_page')
  entity_id     INT
  uploaded_by   INT FK -> users.id
  filename      VARCHAR(255)
  stored_path   VARCHAR(500)           -- /uploads/2024/01/uuid.jpg
  mime_type     VARCHAR(100)
  size_bytes    INT
  created_at    DATETIME

activity_log
  id            INT PK AUTO_INCREMENT
  entity_type   ENUM('task','project','wiki_page')
  entity_id     INT
  actor_id      INT FK -> users.id
  action        VARCHAR(100)           -- 'status_changed', 'comment_added', etc.
  old_value     TEXT NULL              -- JSON
  new_value     TEXT NULL              -- JSON
  created_at    DATETIME

wiki_pages
  id            INT PK AUTO_INCREMENT
  project_id    INT FK -> projects.id NULL  -- NULL = wiki global
  parent_id     INT FK -> wiki_pages.id NULL
  title         VARCHAR(500)
  slug          VARCHAR(500)
  content_type  ENUM('tiptap','markdown')
  body          LONGTEXT
  source_file   VARCHAR(500) NULL
  created_by    INT FK -> users.id
  created_at    DATETIME
  updated_at    DATETIME
```

---

## API Routes

### Auth
```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/auth/register
```

### Projets
```
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id
DELETE /api/projects/:id
GET    /api/projects/:id/activity
```

### Tâches
```
GET    /api/projects/:id/tasks
POST   /api/projects/:id/tasks
GET    /api/tasks/:id
GET    /api/tasks/ref/:key/:number      -- accès direct par ref (ex: CUI-4)
PATCH  /api/tasks/:id
DELETE /api/tasks/:id
PATCH  /api/tasks/:id/move
```

### Commentaires
```
GET    /api/tasks/:id/comments
POST   /api/tasks/:id/comments
PATCH  /api/comments/:id
DELETE /api/comments/:id
GET    /api/tasks/:id/activity
```

### Labels
```
GET    /api/projects/:id/labels
POST   /api/projects/:id/labels
PATCH  /api/labels/:id
DELETE /api/labels/:id
```

### Pièces jointes
```
POST   /api/attachments
GET    /api/attachments/:id/download
DELETE /api/attachments/:id
```

### Wiki
```
GET    /api/wiki
GET    /api/projects/:id/wiki
POST   /api/wiki/pages
GET    /api/wiki/pages/:id
PATCH  /api/wiki/pages/:id
DELETE /api/wiki/pages/:id
POST   /api/wiki/pages/import-md
GET    /api/wiki/pages/:id/export-md
```

### Utilisateurs
```
GET    /api/users
PATCH  /api/users/:id
PATCH  /api/users/:id/password
```

---

## Structure des dossiers

```
gerard/
├── package.json                    -- npm workspaces root
│
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── index.ts
│       ├── config.ts
│       ├── db.ts
│       ├── plugins/
│       │   ├── auth.ts
│       │   └── multipart.ts
│       ├── routes/
│       │   ├── auth.ts
│       │   ├── projects.ts
│       │   ├── tasks.ts
│       │   ├── comments.ts
│       │   ├── labels.ts
│       │   ├── attachments.ts        -- à faire (Phase 3)
│       │   ├── wiki.ts
│       │   └── users.ts
│       ├── services/
│       │   ├── activity.ts
│       │   └── storage.ts            -- à faire (Phase 3)
│       └── schemas/
│           └── *.ts
│
├── client/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── router.tsx
│       ├── api/
│       ├── components/
│       │   ├── ui/
│       │   │   ├── RichTextEditor.tsx
│       │   │   └── TaskRefExtension.ts
│       │   ├── kanban/
│       │   │   ├── KanbanBoard.tsx
│       │   │   ├── KanbanColumn.tsx
│       │   │   └── TaskCard.tsx
│       │   ├── task/
│       │   │   ├── TaskDrawer.tsx
│       │   │   ├── TaskForm.tsx
│       │   │   └── TaskActivity.tsx
│       │   ├── wiki/
│       │   └── layout/
│       │       └── AppShell.tsx
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   ├── DashboardPage.tsx
│       │   ├── ProjectPage.tsx
│       │   ├── TicketPage.tsx
│       │   └── WikiPage.tsx
│       └── lib/
│
├── mcp/                              -- Phase 5
│   ├── package.json
│   └── src/
│       ├── index.ts
│       └── tools/
│
├── docker-compose.yml
├── .env.example
└── PLAN.md
```

---

## Phases de développement

### Phase 1 — MVP Kanban ✅ Complète
**Objectif : tableau kanban fonctionnel pour un projet**

- [x] Scaffold monorepo (npm workspaces, Vite, Fastify, Prisma)
- [x] Docker Compose : MariaDB + app
- [x] Migrations Prisma : `users`, `projects`, `tasks`
- [x] Seed : 2 utilisateurs + page d'inscription
- [x] Auth : login/logout, session, middleware
- [x] API : projets CRUD
- [x] API : tâches CRUD + move (changement de colonne)
- [x] UI : page login
- [x] UI : dashboard projets
- [x] UI : tableau kanban avec drag & drop (dnd-kit)
- [x] UI : formulaire création/édition tâche (TaskDrawer)

**Bonus :**
- [x] Clés de projet courtes (`CUI`, `SDB`…) + numéros séquentiels par projet (CUI-1, CUI-2…)
- [x] URL directe par ticket : `/tickets/CUI-4` → ouvre le drawer

---

### Phase 2 — Fonctionnalités core ✅ Complète
**Objectif : remplacer le document de notes partagé**

- [x] Labels : création par projet, assignation aux tâches, filtre
- [x] Commentaires sur les tâches (création, édition, suppression)
- [x] Historique d'activité automatique (changement de statut, assignée, titre…)
- [x] Drawer latéral pour le détail d'une tâche (style Jira)
- [x] Vue liste (en plus du kanban)
- [x] Mise en évidence des dates : rouge = dépassé, orange = aujourd'hui

---

### Phase 3 — Pièces jointes & rich text ✅ Complète
**Objectif : remplacer le dossier photos/liens partagé**

- [x] Upload fichiers/images sur tâches et projets
- [x] Intégration Tiptap pour descriptions (WYSIWYG + mentions @ticket cliquables)
- [x] Prévisualisation des images dans la liste des pièces jointes
- [x] Onglet "Documents" sur la page projet
- [x] Upload avatar utilisateur
- [x] Layout responsive mobile

---

### Phase 3 bis — Wiki WYSIWYG ✅ Complète
**Objectif : espace Confluence-like par projet**

- [x] Migration Prisma : `wiki_pages`
- [x] API wiki CRUD
- [x] Arborescence de pages dans la sidebar (recursif)
- [x] Éditeur Tiptap WYSIWYG
- [x] Import de fichiers `.md` (rendu via `react-markdown` + `rehype-highlight`)
- [x] Export d'une page en `.md`
- [x] Toggle Édition ↔ Aperçu
- [x] Breadcrumb de navigation

---

### Phase 4 — Recherche & export ⭐⭐
**Objectif : confort d'utilisation**

- [ ] Recherche fulltext sur les tâches (index FULLTEXT MariaDB)
- [ ] Panneau de filtres avancés (labels, assignée, plage de dates)
- [ ] Export projet CSV/PDF
- [ ] Raccourcis clavier (`N` = nouvelle tâche, etc.)

---

### Phase 5 — Serveur MCP ⭐⭐⭐
**Objectif : piloter Gérard depuis Claude Code**

- [ ] Package `mcp/` dans le monorepo
- [ ] Outils MCP : `list_projects`, `create_task`, `update_task`, `move_task`, `search_tasks`
- [ ] Outils MCP : `list_wiki_pages`, `get_wiki_page`, `create_wiki_page`
- [ ] Outils MCP : `get_activity`
- [ ] Configuration dans `.claude/settings.json`

#### Exemple d'usage
```
"Gérard, crée une tâche urgente dans le projet Cuisine :
 commander le carrelage avant le 15 mai, assigne-la à Marie"

"Montre-moi toutes les tâches bloquées"

"Résume l'activité récente du projet Salle de bain"
```

---

## Variables d'environnement

```env
DATABASE_URL=mysql://gerard:password@db:3306/gerard
SESSION_SECRET=<random-32-chars>
UPLOAD_DIR=/app/uploads
PORT=3000
NODE_ENV=development
```

---

## Déploiement local

```bash
docker compose up -d        # démarre MariaDB + app
# accessible sur http://homeserver.local:3000
```

Pour HTTPS sur le réseau local, ajouter un container **Caddy** avec un certificat auto-signé.
