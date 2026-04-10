# 🏗️ Gérard

> **Gérard** est un clone local de Jira + Confluence conçu spécifiquement pour gérer des projets de rénovation maison à deux (ou en petit comité). 

Fini les notes éparpillées et les photos perdues dans les fils de discussion. Gérard centralise vos tâches, vos plans et votre documentation technique.

---

## 🚀 Fonctionnalités Clés

- **Tableau Kanban :** Gérez vos travaux avec un système de Drag & Drop fluide.
- **Wiki Intégré :** Un espace "Confluence-like" avec éditeur WYSIWYG et support Markdown pour vos plans et guides.
- **Clés de Projets :** Système de tickets pro (`CUI-1`, `SDB-42`) pour une référence facile.
- **Gestion de Contenu :** Upload de photos, commentaires, labels et historique d'activité.
- **Recherche Fulltext :** Retrouvez n'importe quelle note ou tâche instantanément.
- **Pilotage par IA (MCP) :** Un serveur Model Context Protocol pour discuter avec vos projets depuis Claude.

## 🛠️ Stack Technique

- **Backend :** Node.js, Fastify, TypeScript, Prisma (MariaDB).
- **Frontend :** React, Vite, TanStack (Query, Router), Tailwind CSS + shadcn/ui.
- **Éditeur :** Tiptap (Rich Text) & React-Markdown.
- **Ops :** Docker Compose.

## 🏁 Démarrage Rapide

### Avec Docker (Recommandé)

1. Clonez le dépôt.
2. Copiez le fichier d'exemple : `cp .env.example .env`.
3. Lancez l'infrastructure :
   ```bash
   docker compose up -d
   ```
4. Accédez à l'interface sur `http://localhost:3000`.

### Mode Développement

1. Installez les dépendances à la racine : `npm install`.
2. Configurez votre base MariaDB locale dans `.env`.
3. Lancez le serveur et le client en parallèle :
   ```bash
   npm run dev
   ```

## 📖 Documentation complète

La documentation détaillée est disponible dans le dossier [`/docs`](./docs) :

- [Installation & Setup](./docs/setup.md)
- [Architecture & Stack](./docs/architecture.md)
- [Modèle de Données](./docs/database.md)
- [Guide de l'API](./docs/api.md)
- [Le Wiki (Confluence-like)](./docs/wiki.md)
- [Intégration MCP (IA)](./docs/mcp.md)

---
*Gérard — Parce qu'un chantier sans plan, c'est juste un tas de gravats.*
