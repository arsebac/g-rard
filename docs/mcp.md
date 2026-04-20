# 🤖 Intégration IA (Model Context Protocol)

Gérard implémente le standard **Model Context Protocol (MCP)** via HTTP (SSE). Cela permet à des IA comme Claude Desktop ou Claude Code d'interagir avec vos projets, vos tâches et votre wiki en utilisant directement votre compte utilisateur.

## Authentification

Contrairement aux versions précédentes, l'authentification MCP est désormais liée à votre compte utilisateur personnel. Chaque utilisateur possède son propre jeton (token) MCP.

### Comment obtenir votre token :
1. Connectez-vous à l'interface web de Gérard.
2. Accédez à la page `/mcp-auth` (cliquez sur l'URL d'authentification ou naviguez directement vers `http://votre-instance/mcp-auth`).
3. Copiez le token affiché ou l'URL de connexion complète.

## Configuration des clients MCP

### 1. Claude Code
Pour utiliser Gérard avec Claude Code, ajoutez le serveur via son URL :

```bash
claude mcp add gerard http://localhost:3000/mcp?token=VOTRE_TOKEN_PERSONNEL
```

### 2. Claude Desktop
Modifiez votre fichier de configuration `claude_desktop_config.json` pour ajouter Gérard en tant que serveur SSE :

```json
{
  "mcpServers": {
    "gerard": {
      "url": "http://localhost:3000/mcp?token=VOTRE_TOKEN_PERSONNEL"
    }
  }
}
```

## Outils Disponibles (Tools)

L'IA a accès à tous les outils de Gérard avec **vos propres droits d'accès** :
- `list_projects` : Liste les projets auxquels vous avez accès.
- `list_tasks` : Liste les tâches d'un projet.
- `search_tasks` : Recherche dans toutes les tâches.
- `create_task` / `update_task` : Crée ou modifie des tâches en votre nom.
- `list_wiki_pages` / `get_wiki_page` : Accède à la documentation.
- `add_comment` : Ajoute des commentaires à votre nom.
- `list_sprints`, `list_labels`, `list_attachments`, etc.

## Sécurité et Confidentialité

- **Droits Identiques** : L'IA ne peut voir ou modifier que ce que vous êtes autorisé à voir ou modifier dans l'interface web.
- **Isolation** : Chaque session MCP est isolée et liée à un jeton unique.
- **Révocation** : Si vous pensez que votre token est compromis, vous pouvez en générer un nouveau (bientôt disponible via l'interface) ou demander à un administrateur de réinitialiser votre champ `mcp_token` dans la base de données.

## Installation technique (pour les administrateurs)

Le serveur MCP est intégré au serveur Fastify principal. Pour qu'il fonctionne :
1. La variable `GERARD_API_KEY` doit être configurée dans le fichier `.env` du serveur. Elle sert de clé partagée interne entre le bridge MCP et l'API.
2. Le serveur doit être accessible via HTTP/HTTPS par le client MCP.
