# 📊 Analyse d'écart : Gérard vs Jira

Ce document identifie les fonctionnalités clés de Jira absentes de **Gérard** et analyse leur pertinence pour un usage de gestion de projet (notamment pour la rénovation).

---

## 1. Gestion Agile & Planification

### 📅 Sprints & Scrum
*   **Concept Jira :** Permet de découper le travail en cycles courts (ex: 2 semaines) avec un objectif précis.
*   **Intérêt pour Gérard :** Dans une rénovation, cela permettrait de se dire : "Ce sprint, on finit toute l'électricité de la cuisine".
*   **Piste technique :**
    *   Nouvelle table `sprints` (id, project_id, name, start_date, end_date, goal, status).
    *   Relation `tasks.sprint_id`.
    *   Vue "Backlog" pour faire glisser les tâches du backlog vers le sprint.

### 🗺️ Roadmaps (Timeline)
*   **Concept Jira :** Vue chronologique de type Gantt pour visualiser les Epics et leur durée.
*   **Intérêt pour Gérard :** Vital pour coordonner les interventions (ex: le plombier doit passer avant que le carreleur ne commence).
*   **Piste technique :**
    *   Ajout de `start_date` et `end_date` (ou `target_date`) sur les tickets de type Epic.
    *   Librairie React de type "Gantt chart" ou simple affichage CSS Grid pour la timeline.

### 📦 Versions (Releases)
*   **Concept Jira :** Groupement de tickets pour un "jalon" (milestone).
*   **Intérêt pour Gérard :** Définir des étapes clés (ex: "Étape 1 : Gros œuvre terminé", "Étape 2 : Finitions").
*   **Piste technique :**
    *   Table `versions` (name, release_date).
    *   Champ `fix_version` sur les tâches.

---

## 2. Workflows & Personnalisation

### ⚙️ Workflow Engine (Moteur de transitions)
*   **Concept Jira :** Les tickets ne passent pas juste d'un statut à l'autre ; ils suivent des "chemins" avec des conditions (ex: impossible de fermer si pas de commentaire).
*   **Intérêt pour Gérard :** Éviter d'oublier des étapes critiques (ex: "Vérifier l'étanchéité" avant de passer à "Poser le carrelage").
*   **Piste technique :**
    *   Remplacer l'Enum Prisma par une table `project_statuses`.
    *   Table `transitions` (from_status, to_status).
    *   Middleware Backend pour valider les changements de statut.

### 🏗️ Champs Personnalisés (Custom Fields)
*   **Concept Jira :** Ajouter des champs spécifiques par projet (Nombre, Texte, Date, Liste).
*   **Intérêt pour Gérard :** Ajouter des champs comme "Prix estimé", "Lien vers la fiche produit", "Numéro de commande".
*   **Piste technique :**
    *   Approche EAV (Entity-Attribute-Value) ou stockage d'un JSON `metadata` dans la table `tasks`.

---

## 3. Reporting & Recherche

### 📈 Tableaux de bord (Dashboards)
*   **Concept Jira :** Page d'accueil avec des widgets (statistiques, graphiques).
*   **Intérêt pour Gérard :** Voir d'un coup d'œil le budget dépensé vs prévu, ou le nombre de tâches "Bloquées".
*   **Piste technique :**
    *   Composants de graphiques (Recharts ou Chart.js).
    *   Requêtes d'agrégation SQL (COUNT, SUM) groupées par statut/utilisateur.

### 🔍 JQL (Jira Query Language)
*   **Concept Jira :** Langage de requête puissant (ex: `assignee = currentUser() AND status = "En cours"`).
*   **Intérêt pour Gérard :** Créer des filtres très précis et les sauvegarder.
*   **Piste technique :**
    *   Parseur de chaîne de caractères convertissant une pseudo-requête en objet Prisma `where`.
    *   Alternative simple : Un constructeur de requêtes visuel (Query Builder).

---

## 4. Automatisation & Notifications

### 🤖 Automatisation (Rules)
*   **Concept Jira :** "IF ticket created AND type = Bug THEN assign to Marie".
*   **Intérêt pour Gérard :** "Si une tâche devient 'Urgente', envoyer une notification".
*   **Piste technique :**
    *   Système de "Hooks" internes déclenchés lors des mutations Prisma.
    *   Moteur de règles simple (Trigger / Condition / Action).

### 🔔 Notifications
*   **Concept Jira :** Alertes par email ou internes.
*   **Intérêt pour Gérard :** Être prévenu quand l'autre personne a terminé une tâche ou ajouté un commentaire.
*   **Piste technique :**
    *   Table `notifications` pour le centre de notifications interne.
    *   WebSockets (Fastify-websocket) pour le temps réel.
    *   Intégration mail simple (Nodemailer).

---

## 5. Collaboration & Structure

### 🔐 Permissions Granulaires
*   **Concept Jira :** Rôles (Admin, Dev, Viewer) avec des droits précis par projet.
*   **Intérêt pour Gérard :** Permettre à un artisan de voir un projet sans pouvoir tout modifier.
*   **Piste technique :**
    *   Système RBAC (Role-Based Access Control) avec une table `project_members` (user_id, project_id, role).

### 🪜 Sous-tâches (Sub-tasks)
*   **Concept Jira :** Un niveau de hiérarchie sous la tâche pour découper de micro-étapes.
*   **Intérêt pour Gérard :** Dans la tâche "Peindre la chambre", avoir des sous-tâches : "Acheter peinture", "Protéger le sol", "Passer la 1ère couche".
*   **Piste technique :**
    *   Actuellement en Phase 6 (Epic -> Task). L'ajout d'un troisième niveau `parent_id` sur n'importe quel ticket permettrait une récursivité infinie.

---

## 🚀 Priorisation Suggérée pour Gérard

1.  **Phase 6 (En cours) :** Hiérarchie Epic/Task et Liens entre tickets.
2.  **Estimation & Budget :** Ajouter un champ numérique simple pour le suivi des coûts.
3.  **Timeline simple :** Visualiser les Epics sur un calendrier.
4.  **Notifications basiques :** Savoir quand l'autre a interagi.
