# 🛠️ Ops & Maintenance

Gérard est conçu pour être "zéro maintenance", mais voici quelques conseils pour garder votre instance en bonne santé.

## Sauvegardes (Backups)

Vos données résident dans deux endroits stratégiques :

1.  **La Base de Données (MariaDB) :**
    Faites un dump régulier de la base :
    ```bash
    docker compose exec db mariadb-dump -u gerard -ppassword gerard > backup.sql
    ```
2.  **Les Pièces Jointes (Uploads) :**
    Sauvegarder le dossier spécifié par `UPLOAD_DIR`. Si vous utilisez Docker, c'est le volume monté sur `/app/uploads`.

## Mises à jour

Pour mettre à jour Gérard vers la dernière version :
1.  Récupérez les derniers changements (`git pull`).
2.  Relancez le build Docker :
    ```bash
    docker compose up -d --build
    ```
    *Les migrations Prisma s'appliqueront automatiquement.*

## Sécurisation HTTPS

Gérard tourne par défaut en HTTP (port 3000). Si vous souhaitez y accéder via Internet ou sur un réseau Wi-Fi non sécurisé, nous recommandons d'utiliser un **Reverse Proxy** comme **Caddy** ou **Nginx Proxy Manager** avec un certificat Let's Encrypt.

## Monitoring
Le backend Fastify fournit des logs via `pino`. En cas de problème, consultez les logs Docker :
```bash
docker compose logs -f app
```
