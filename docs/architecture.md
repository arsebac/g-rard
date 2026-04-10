# 🏗️ Architecture & Stack Technique

Gérard est conçu comme un **Monorepo** utilisant les `workspaces` npm pour faciliter la gestion du backend, du frontend et des outils tiers (MCP).

## Structure du Monorepo

-   **`root/`** : Configuration globale, Docker Compose et dépendances partagées.
-   **`server/`** : Le cœur de l'application (Backend Fastify).
-   **`client/`** : L'interface utilisateur (SPA React).
-   **`mcp/`** : Le serveur Model Context Protocol pour l'intégration IA.

---

## Backend (`server/`)

-   **Framework :** [Fastify](https://www.fastify.io/) - Choisi pour sa performance et sa légèreté.
-   **Langage :** TypeScript.
-   **ORM :** [Prisma](https://www.prisma.io/) - Pour un typage fort de la base de données et des migrations simples.
-   **Authentification :** `fastify-session` avec stockage en mémoire (suffisant pour un usage local).
-   **Validation :** Schémas JSON via Fastify pour valider les entrées API.

## Frontend (`client/`)

-   **Framework UI :** [React](https://reactjs.org/) + [Vite](https://vitejs.dev/) pour une compilation ultra-rapide.
-   **Gestion d'état :** [TanStack Query](https://tanstack.com/query/latest) (React Query) pour le cache et les requêtes serveur.
-   **Routage :** [TanStack Router](https://tanstack.com/router/latest) pour un routage type-safe basé sur les fichiers.
-   **Styling :** [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) pour des composants modernes et accessibles sans CSS custom.
-   **Kanban :** [dnd-kit](https://dndkit.com/) pour la gestion fluide du drag & drop.

## Serveur MCP (`mcp/`)

Le package `mcp/` permet à des agents IA (comme Claude Code) d'interagir directement avec Gérard.

-   Utilise le SDK `@modelcontextprotocol/sdk`.
-   Expose des outils (tools) pour manipuler les tâches et le wiki.
-   Communique avec le serveur principal via les API REST protégées par une clé API.

---

## Flux de Données Typique

1.  L'utilisateur interagit avec l'UI (ex: déplace une carte).
2.  `TanStack Query` déclenche une mutation optimistic (MAJ immédiate dans l'UI).
3.  Une requête `PATCH` est envoyée à l'API Fastify.
4.  Le serveur valide la session, effectue l'opération via Prisma.
5.  Prisma met à jour MariaDB.
6.  Le serveur renvoie la confirmation, l'UI se synchronise si nécessaire.
