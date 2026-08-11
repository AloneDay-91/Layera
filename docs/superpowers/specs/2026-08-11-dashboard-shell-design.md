# FileCloud — Shell dashboard Kumo (Étape 6 du plan CLAUDE.md)

## Contexte

Le sous-projet précédent ("fondations+auth", étapes 1-5) est mergé dans `main` : monorepo, Drizzle/Postgres, Better Auth avec workspace personnel auto-provisionné, dashboard protégé (actuellement une page de bienvenue minimale), page `/design-system` montrant les composants Kumo retenus.

Ce sous-projet couvre l'Étape 6 du plan : construire le layout complet du dashboard (sidebar, header, zone centrale table/grille, panneau de détail) **avec des données mockées**, avant de brancher la vraie logique fichiers/dossiers (Étape 7, sous-projet séparé).

## Objectif

À la fin de ce sous-projet :
- `/dashboard` affiche le shell complet : sidebar, header, zone centrale (table ou grille, avec bascule), panneau de détail.
- La navigation dans une arborescence de dossiers mockée (2-3 niveaux) fonctionne : cliquer sur un dossier change le contenu affiché et met à jour le fil d'Ariane.
- Sélectionner un fichier/dossier ouvre le panneau de détail (masqué sinon).
- Les liens de sidebar non encore fonctionnels (Partagés, Favoris, Corbeille, Réglages) mènent à une page "bientôt disponible" dédiée, pas une 404.
- Les boutons d'action du header (Upload, Nouveau dossier) sont cliquables et affichent un toast Kumo "bientôt disponible" plutôt que d'agir réellement.
- Le layout est responsive desktop/tablette (sidebar repliable) et utilisable au clavier.

## Hors scope

CRUD réel de fichiers/dossiers (Étape 7), upload MinIO (Étape 8), previews (Étape 9), recherche fonctionnelle, partage, corbeille réelle, favoris réels — tout ce qui nécessite la vraie base de données au-delà de ce qui existe déjà (workspace/folder root).

## Architecture — état et données

- **Pas de nouvelle librairie d'état** (pas de Zustand/Context/Redux). `FileBrowser` (client component) est la source de vérité unique pour l'état de navigation : `currentFolderId`, `selectedItemId`, `viewMode: "table" | "grid"`, tous en `useState`, passés en props aux composants enfants. Cohérent avec le reste du code, qui n'utilise aucune lib d'état à ce stade.
- **Données mockées** dans `apps/web/lib/mock-files.ts` : un tableau statique d'items dont la forme est calquée sur le futur schéma DB (`packages/db/src/schema/{folder,file}.ts`) :
  ```ts
  type MockItem = {
    id: string;
    parentId: string | null; // null = racine
    type: "file" | "folder";
    name: string;
    mimeType: string | null; // null pour les dossiers
    size: number | null;     // null pour les dossiers
    updatedAt: string;       // ISO date
    owner: string;           // nom affiché
  };
  ```
  Cette forme proche du schéma réel minimise le travail de re-branchement à l'Étape 7 (remplacement de la source de données, pas de re-design des composants).
- **Navigation** : état local React (`currentFolderId`), pas de route par dossier (pas de `/dashboard/files/[...path]`). Compromis assumé : pas de deep-linking vers un sous-dossier pour l'instant — le vrai schéma d'URL sera défini à l'Étape 7 avec la vraie API, donc construire un routing dynamique maintenant risquerait d'être partiellement refait.
- Le fil d'Ariane (`file-breadcrumbs.tsx`) est dérivé de `currentFolderId` en remontant la chaîne `parentId` dans les données mockées.

## Composants (`apps/web/components/files/`)

```
components/files/
├── file-browser.tsx        # état (dossier courant, sélection, vue), compose tout le reste
├── file-table.tsx          # vue table (Kumo Table)
├── file-grid.tsx           # vue grille (cartes)
├── file-row-menu.tsx       # menu contextuel par ligne (renommer/déplacer/supprimer — actions désactivées, toast "bientôt disponible")
├── file-preview.tsx        # icône/vignette placeholder par type MIME (pas de vrai rendu de fichier — réservé à l'Étape 9)
├── file-details-panel.tsx  # panneau droit : aperçu (via file-preview), nom, type, poids, propriétaire, dates, bouton partage (désactivé)
├── file-breadcrumbs.tsx    # fil d'Ariane basé sur currentFolderId
└── upload-dropzone.tsx     # zone de drop visuelle + bouton, toast "bientôt disponible" au drop/clic — pas d'upload réel
```

## Layout du dashboard

- `apps/web/app/dashboard/layout.tsx` (garde de session serveur, `auth.api.getSession`) : **inchangé**, aucune modification.
- Nouveau composant `apps/web/components/shell/dashboard-shell.tsx` (client component) :
  - **Sidebar** : nom du workspace (issu de la session), puis liens Fichiers (`/dashboard`), Partagés (`/dashboard/shared`), Favoris (`/dashboard/favorites`), Corbeille (`/dashboard/trash`), Réglages (`/dashboard/settings`). Tous visibles et navigables. Repliable en icônes sur tablette via un bouton toggle dans le header.
  - **Header** : fil d'Ariane (`file-breadcrumbs`), champ de recherche (affiché, non fonctionnel — pas de filtrage), bouton "Nouveau dossier", bouton "Upload", avatar utilisateur avec menu déroulant (nom, email, déconnexion — réutilise `authClient.signOut()` de Task 10 du sous-projet précédent).
- `apps/web/app/dashboard/page.tsx` devient : rend `<DashboardShell>` contenant `<FileBrowser>` (remplace l'actuelle page de bienvenue minimale — le message "Welcome" et le bouton de déconnexion autonome sont supprimés, la déconnexion migre dans le menu avatar du header).
- Nouvelles pages "bientôt disponible" : `apps/web/app/dashboard/shared/page.tsx`, `favorites/page.tsx`, `trash/page.tsx`, `settings/page.tsx` — chacune rend un composant générique réutilisable `apps/web/components/shell/coming-soon.tsx` (icône + titre + message), paramétré par titre/description.
- **Panneau de détail** : masqué par défaut (`selectedItemId === null`), apparaît en colonne à droite dès qu'un item est sélectionné (clic sur une ligne de table ou une carte de grille).

## Comportements spécifiques

- **Boutons d'action du header** (Upload, Nouveau dossier) et **menu contextuel de ligne** (renommer/déplacer/supprimer) : cliquables, déclenchent un toast Kumo "Bientôt disponible" via `useKumoToastManager()` (déjà utilisé sur `/design-system`) — aucune action réelle.
- **Liens de sidebar** non fonctionnels : navigation réelle (Next.js `Link`) vers une page dédiée "bientôt disponible", pas de toast, pas de 404.
- **Sélection** : clic sur une ligne/carte sélectionne l'item (surbrillance) et ouvre le panneau de détail ; un second clic sur le même item ou sur une zone vide désélectionne.
- **Bascule table/grille** : contrôlée par `viewMode`, toggle Kumo `Tabs` placé dans le header, à droite du fil d'Ariane et avant les boutons d'action.

## Tests / vérification manuelle

- `/dashboard` affiche le shell complet, aucune erreur console.
- Navigation dans l'arborescence mockée : cliquer sur un dossier change le contenu ET le fil d'Ariane ; remonter via le fil d'Ariane fonctionne.
- Sélectionner un item ouvre le panneau de détail avec les bonnes informations ; désélectionner le masque.
- Bascule table/grille fonctionne sans perte de la sélection ou de la navigation en cours.
- Clic sur Upload / Nouveau dossier / une action du menu contextuel → toast "Bientôt disponible", pas d'erreur.
- Navigation vers Partagés/Favoris/Corbeille/Réglages → page dédiée, pas de 404.
- Déconnexion depuis le menu avatar fonctionne (redirection `/login`).
- Responsive : sidebar repliable testée en largeur tablette ; navigation clavier (Tab, Entrée) fonctionnelle sur les liens et boutons principaux.
- `pnpm lint && pnpm typecheck` passent sans erreur sur `apps/web`.
