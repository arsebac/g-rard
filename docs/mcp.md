# 🤖 Intégration IA (MCP)

Gérard implémente le standard **Model Context Protocol (MCP)** pour permettre à des IA (comme Claude Code) de devenir des partenaires de votre chantier.

## Configuration pour Claude Desktop / Claude Code

Pour utiliser Gérard avec Claude, ajoutez la configuration suivante dans votre fichier de réglages (généralement `.claude/settings.json` ou `claude_desktop_config.json`) :

```json
{
  "mcpServers": {
    "gerard": {
      "command": "node",
      "args": ["C:/chemin/vers/gerard/mcp/dist/index.js"],
      "env": {
        "GERARD_API_KEY": "votre_cle_api_definie_dans_le_env",
        "GERARD_URL": "http://localhost:3000"
      }
    }
  }
}
```

## Outils Disponibles (Tools)

L'IA aura accès à une série de fonctions pour vous aider :
-   `list_tasks` : Voir l'état d'un projet.
-   `create_task` : "Gérard, crée une tâche pour acheter de la peinture".
-   `update_task` : "Gérard, passe la tâche CUI-5 en terminé".
-   `get_wiki_page` : "Gérard, rappelle-moi les dimensions du plan de travail".
-   `get_activity` : "Qu'est-ce que Marie a fait sur le projet aujourd'hui ?".

## Sécurité
Le serveur MCP ne permet que les opérations autorisées via la `GERARD_API_KEY`. Veillez à ce que cette clé reste privée.
