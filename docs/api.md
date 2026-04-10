# 🔌 Guide de l'API

L'API de Gérard est une API REST standard, sécurisée par session (cookies) pour l'interface web, et par clé API pour les clients externes (comme le serveur MCP).

## Authentification

-   **Session :** Utilisée par le frontend. Route : `POST /api/auth/login`.
-   **Clé API :** Utilisée par le serveur MCP. Header : `x-api-key: <VOTRE_CLÉ>`.

## Endpoints Principaux

### 🏗️ Projets
-   `GET /api/projects` : Liste tous les projets.
-   `POST /api/projects` : Créer un nouveau projet.
-   `GET /api/projects/:id` : Détails d'un projet spécifique.

### ✅ Tâches
-   `GET /api/projects/:id/tasks` : Toutes les tâches d'un projet.
-   `POST /api/projects/:id/tasks` : Créer une tâche.
-   `GET /api/tasks/:id` : Détails d'une tâche.
-   `PATCH /api/tasks/:id` : Mettre à jour (statut, assignation, etc.).
-   `PATCH /api/tasks/:id/move` : Modifier l'ordre (position) dans la colonne kanban.

### 📚 Wiki
-   `GET /api/projects/:id/wiki` : Arborescence des pages wiki d'un projet.
-   `POST /api/wiki/pages` : Créer une page.
-   `GET /api/wiki/pages/:id` : Lire le contenu (JSON ou Markdown).

### 🔍 Recherche & Divers
-   `GET /api/search?q=...` : Recherche fulltext.
-   `GET /api/attachments/:id/download` : Télécharger un fichier.
-   `GET /api/projects/:id/export/csv` : Télécharger l'export CSV.

## Formats de Données
Toutes les requêtes et réponses utilisent le format **JSON**. Les erreurs renvoient un objet standard avec un message explicite.
