# 📚 Le Wiki (Espace Documentaire)

Le wiki de Gérard est conçu pour stocker les plans, les guides techniques et les listes d'achats liés à vos chantiers.

## Fonctionnement de l'Édition

Gérard propose un éditeur hybride basé sur **Tiptap** :

1.  **Mode WYSIWYG :** Éditez votre texte, vos listes et vos titres visuellement.
2.  **Mentions de Tickets :** Tapez `@` suivi de la clé d'un ticket (ex: `@CUI-1`) pour créer un lien dynamique vers une tâche.

## Organisation des Pages

Les pages sont organisées de manière **récursive** (parent -> enfant) :
-   Une page peut être globale ou liée à un projet spécifique.
-   Le menu latéral affiche l'arborescence complète.
-   Un système de *Breadcrumb* permet de ne jamais se perdre.

## Import & Export Markdown

Pour assurer la pérennité de vos données :
-   **Import :** Vous pouvez importer des fichiers `.md` existants. Gérard convertira le Markdown en format riche pour l'édition.
-   **Export :** Téléchargez n'importe quelle page au format `.md` pour la sauvegarder localement ou l'ouvrir avec un autre éditeur.

## Prévisualisation
Un toggle permet de passer instantanément du mode "Édition" au mode "Aperçu", garantissant que le rendu final est conforme à vos attentes.
