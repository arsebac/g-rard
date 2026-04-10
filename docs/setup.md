# ⚙️ Installation & Setup

Ce guide détaille les étapes pour mettre en place votre instance de Gérard.

## Pré-requis

- **Docker & Docker Compose** (recommandé pour la base de données).
- **Node.js 18+** (pour le développement local).
- **npm** (pour la gestion des dépendances).

## Configuration des Variables d'Environnement

Gérard utilise un fichier `.env` à la racine pour sa configuration.

1.  **Copiez l'exemple :**
    ```bash
    cp .env.example .env
    ```
2.  **Paramètres clés :**
    - `DATABASE_URL` : L'URL de connexion à MariaDB (ex: `mysql://gerard:password@localhost:3306/gerard`).
    - `SESSION_SECRET` : Une chaîne aléatoire longue pour sécuriser les sessions.
    - `GERARD_API_KEY` : Clé secrète pour autoriser les connexions via le serveur MCP (Phase 5).
    - `UPLOAD_DIR` : Chemin où seront stockées les pièces jointes (défaut: `/app/uploads`).

## Installation via Docker (Production / Usage standard)

C'est la méthode la plus simple pour avoir une instance stable.

1.  **Lancer les services :**
    ```bash
    docker compose up -d
    ```
2.  **Migrations de base de données :**
    Le conteneur est configuré pour appliquer les migrations automatiquement au démarrage via Prisma.
3.  **Accès :**
    L'application est exposée par défaut sur le port **3000**.

## Développement Local

Si vous souhaitez modifier le code, suivez ces étapes :

1.  **Installer les dépendances :**
    ```bash
    npm install
    ```
2.  **Lancer la base de données :**
    Vous pouvez lancer uniquement MariaDB via Docker :
    ```bash
    docker compose up -d db
    ```
3.  **Initialiser la base :**
    ```bash
    npx prisma migrate dev --schema ./server/prisma/schema.prisma
    npx ts-node ./server/prisma/seed.ts
    ```
4.  **Lancer le projet :**
    ```bash
    npm run dev
    ```
    - Le backend (Fastify) tourne sur `http://localhost:3000`.
    - Le frontend (Vite) tourne sur `http://localhost:5173` (proxied vers le backend).

## Troubleshooting

- **Problème de connexion DB :** Vérifiez que `DATABASE_URL` utilise `db` comme hôte dans Docker, mais `localhost` si vous lancez le serveur Node.js hors Docker.
- **Uploads :** Assurez-vous que le dossier spécifié dans `UPLOAD_DIR` possède les droits d'écriture pour l'utilisateur qui lance le serveur.
