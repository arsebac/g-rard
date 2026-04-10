# Gérard — Serveur MCP

Pilotez votre gestionnaire de projets Gérard directement depuis Claude Code.

---

## Prérequis

- Node.js 20+
- L'application Gérard doit tourner (`npm run dev` ou Docker Compose)
- Une `GERARD_API_KEY` configurée des deux côtés (serveur + MCP)

---

## Installation

### 1. Générer une clé API

Choisissez une clé aléatoire (ex : `openssl rand -hex 32`) et ajoutez-la dans `.env` à la racine du projet :

```env
GERARD_API_KEY=votre-clé-secrète
```

### 2. Compiler le serveur MCP

```bash
# Depuis la racine du monorepo
npm run build -w mcp
```

Le binaire compilé se retrouve dans `mcp/dist/index.js`.

### 3. Configurer Claude Code

Éditez `.claude/settings.json` à la racine du projet (créé automatiquement lors de l'intégration) :

```json
{
  "mcpServers": {
    "gerard": {
      "command": "node",
      "args": ["mcp/dist/index.js"],
      "env": {
        "GERARD_URL": "http://localhost:3000",
        "GERARD_API_KEY": "votre-clé-secrète"
      }
    }
  }
}
```

Redémarrez Claude Code — le serveur MCP `gerard` apparaît alors dans la liste des outils disponibles.

### Variables d'environnement

| Variable         | Défaut                    | Description                          |
|------------------|---------------------------|--------------------------------------|
| `GERARD_URL`     | `http://localhost:3000`   | URL de base de l'API Gérard          |
| `GERARD_API_KEY` | *(requis)*                | Clé API partagée avec le serveur     |

---

## Développement

Pour itérer sans recompiler à chaque fois :

```bash
npm run dev -w mcp
```

Puis dans `.claude/settings.json`, remplacez `"node"` par `"npx"` et les args par `["tsx", "mcp/src/index.ts"]`.

---

## Outils disponibles

### Projets

#### `list_projects`
Liste tous les projets actifs.

```
Quels sont mes projets en cours ?
```

Retourne : id, name, key, description, color, taskCount.

---

### Tâches

#### `list_tasks`
Liste les tâches d'un projet avec filtres optionnels.

| Paramètre    | Type   | Requis | Description                                      |
|--------------|--------|--------|--------------------------------------------------|
| `projectId`  | number | oui    | ID du projet                                     |
| `status`     | string | non    | `a_faire` · `en_cours` · `termine` · `bloque`    |
| `assigneeId` | number | non    | Filtrer par utilisateur assigné                  |

```
Montre-moi toutes les tâches bloquées du projet Cuisine
```

---

#### `search_tasks`
Recherche fulltext dans les titres et descriptions de tâches.

| Paramètre   | Type   | Requis | Description                          |
|-------------|--------|--------|--------------------------------------|
| `q`         | string | oui    | Termes recherchés (min 2 caractères) |
| `projectId` | number | non    | Restreindre à un projet              |

```
Cherche toutes les tâches qui mentionnent "carrelage"
```

---

#### `get_task`
Récupère le détail d'une tâche.

| Paramètre | Type   | Requis | Description                        |
|-----------|--------|--------|------------------------------------|
| `id`      | number | non    | ID numérique de la tâche           |
| `ref`     | string | non    | Référence style `CUI-4` (ou `id`)  |

```
Donne-moi le détail de CUI-7
```

---

#### `create_task`
Crée une nouvelle tâche dans un projet.

| Paramètre     | Type   | Requis | Description                                   |
|---------------|--------|--------|-----------------------------------------------|
| `projectId`   | number | oui    | ID du projet                                  |
| `title`       | string | oui    | Titre de la tâche                             |
| `description` | string | non    | Description libre                             |
| `status`      | string | non    | Défaut : `a_faire`                            |
| `priority`    | string | non    | `basse` · `normale` · `haute` · `urgente`     |
| `assigneeId`  | number | non    | ID de l'utilisateur assigné                   |
| `dueDate`     | string | non    | Date au format `YYYY-MM-DD`                   |

```
Crée une tâche urgente dans le projet Cuisine :
"Commander le carrelage avant le 15 mai", assigne-la à Marie
```

---

#### `update_task`
Modifie les champs d'une tâche existante.

| Paramètre     | Type          | Requis | Description                     |
|---------------|---------------|--------|---------------------------------|
| `id`          | number        | oui    | ID de la tâche                  |
| `title`       | string        | non    | Nouveau titre                   |
| `description` | string        | non    | Nouvelle description            |
| `status`      | string        | non    | Nouveau statut                  |
| `priority`    | string        | non    | Nouvelle priorité               |
| `assigneeId`  | number\|null  | non    | Réassigner (null = désassigner) |
| `dueDate`     | string\|null  | non    | null = effacer l'échéance       |

```
Passe CUI-3 en statut "terminé" et supprime la date d'échéance
```

---

#### `move_task`
Déplace une tâche dans le kanban (change la colonne).

| Paramètre | Type   | Requis | Description               |
|-----------|--------|--------|---------------------------|
| `id`      | number | oui    | ID de la tâche            |
| `status`  | string | oui    | Colonne cible             |

```
Déplace la tâche 42 vers "en cours"
```

---

### Wiki

#### `list_wiki_pages`
Liste les pages wiki d'un projet ou du wiki global.

| Paramètre   | Type   | Requis | Description                              |
|-------------|--------|--------|------------------------------------------|
| `projectId` | number | non    | Omis = wiki global, sinon wiki du projet |

```
Liste les pages wiki du projet Salle de bain
```

---

#### `get_wiki_page`
Récupère le contenu complet d'une page wiki.

| Paramètre | Type   | Requis | Description        |
|-----------|--------|--------|--------------------|
| `id`      | number | oui    | ID de la page wiki |

```
Lis la page wiki 12
```

---

#### `create_wiki_page`
Crée une nouvelle page wiki en markdown.

| Paramètre     | Type   | Requis | Description                              |
|---------------|--------|--------|------------------------------------------|
| `title`       | string | oui    | Titre de la page                         |
| `body`        | string | oui    | Contenu en markdown                      |
| `projectId`   | number | non    | Projet associé (null = wiki global)      |
| `parentId`    | number | non    | Page parente pour l'arborescence         |
| `contentType` | string | non    | `markdown` (défaut) ou `tiptap`          |

```
Crée une page wiki "Notes fournisseurs" dans le projet Cuisine
avec le contenu suivant : ...
```

---

### Activité

#### `get_activity`
Récupère l'historique d'activité d'une tâche ou d'un projet.

| Paramètre    | Type   | Requis | Description                    |
|--------------|--------|--------|--------------------------------|
| `entityType` | string | oui    | `task` ou `project`            |
| `entityId`   | number | oui    | ID de l'entité                 |
| `limit`      | number | non    | Nombre d'entrées (défaut : 20) |

```
Résume l'activité récente du projet Salle de bain
Qu'est-ce qui a changé sur CUI-5 cette semaine ?
```

---

## Exemples de conversation

```
"Gérard, montre-moi toutes les tâches bloquées"

"Crée une tâche urgente dans le projet Cuisine :
 commander le carrelage avant le 15 mai, assigne-la à Marie"

"Passe SDB-3 en terminé"

"Résume l'activité récente du projet Salle de bain"

"Cherche toutes les tâches qui mentionnent 'électricité'"

"Crée une page wiki 'Contacts artisans' dans le projet Cuisine"
```
