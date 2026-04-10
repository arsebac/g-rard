# 🗄️ Modèle de Données

Gérard utilise MariaDB pour stocker ses données. Le schéma est géré par Prisma (`server/prisma/schema.prisma`).

## Schéma Global

### Utilisateurs (`users`)
Gère l'accès à l'application. Pas de rôles complexes, chaque utilisateur a accès à tout (usage familial).

### Projets (`projects`)
L'unité de base. Chaque projet possède une **clé courte** (ex: `CUI`) qui sert de préfixe aux tickets.

### Tâches & Tickets (`tasks`)
Le cœur du système.
-   **Numérotation :** Chaque ticket a un numéro séquentiel unique *par projet* (ex: `CUI-1`).
-   **Hiérarchie :** Un ticket peut avoir un `parent_id` (Epic -> Story -> Task).
-   **Statuts :** `à_faire`, `en_cours`, `terminé`, `bloqué`.
-   **Priorité :** `basse`, `normale`, `haute`, `urgente`.

### Labels (`labels`)
Système de tags par projet pour catégoriser les travaux (ex: "Électricité", "Achat", "Plomberie").

### Wiki (`wiki_pages`)
Stocke les pages de documentation.
-   Structure hiérarchique (parent/enfant).
-   Supporte les types `tiptap` (JSON riche) et `markdown` (Texte brut).

### Historique d'activité (`activity_log`)
Enregistre automatiquement chaque modification importante (changement de statut, assignation, nouveau commentaire).

---

## Logiques Métier Clés

### Clés de Projet & Numéros
À la création d'une tâche, le serveur calcule le prochain numéro disponible pour le projet donné. Cela permet d'avoir des références stables et mémorisables.

### Recherche Fulltext
Une recherche optimisée est implémentée sur les titres et descriptions des tâches en utilisant les capacités d'indexation FULLTEXT de MariaDB, avec un fallback pour les recherches plus simples.

### Liens entre tickets (Phase 6)
Le système permet de créer des relations typées entre les tickets :
-   `blocks` / `is_blocked_by`
-   `relates_to` (symétrique)
-   `duplicates` / `is_duplicated_by`
-   `causes` / `is_caused_by`
