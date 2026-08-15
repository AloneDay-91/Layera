Oui — voici un plan pragmatique, organisé pour obtenir vite un MVP utilisable sans partir trop tôt dans des fonctionnalités “Nextcloud”. On vise d’abord un flux complet : compte → espace personnel → dossier → upload MinIO → affichage → partage.

## État du MVP (août 2026)

Le cadrage ci-dessous est **implémenté et testable**. Les sprints 1–8 sont livrés :

| Sprint | Objectif | État |
| ------ | -------- | ---- |
| 1 | Monorepo, Kumo, Docker, Postgres, MinIO | Livré |
| 2 | Drizzle, Better Auth, workspace personnel | Livré |
| 3 | Shell dashboard | Livré |
| 4 | CRUD fichiers/dossiers + corbeille | Livré |
| 5 | Upload MinIO signé + download | Livré (`presign` → PUT, fallback `/api/uploads/[id]`) |
| 6 | Previews, recherche, partage public | Livré (GET signé 2 min si `S3_PUBLIC_ENDPOINT`) |
| 7 | Sécurité, tests, backup, déploiement | Livré (sniff MIME, denylist, audit, isolation, README restore) |
| 8 | Worker, thumbnails, quotas, équipes | Livré (`job` table, worker Compose, quotas, orgs) |

Hors cadrage, volontairement non faits : sync desktop, édition collaborative, chiffrement de bout en bout, plugins, historique de versions, antivirus.

Le reste de ce fichier est le plan d’origine, conservé comme spécification.

## Cadrage du MVP

Définis le produit comme un **gestionnaire de fichiers self-hosted orienté développeurs et petites équipes**, pas comme un clone complet de Nextcloud. Ton différenciateur sera l’interface Kumo soignée et fluide, avec stockage S3/MinIO performant.[1]

Le MVP doit contenir uniquement :

- Authentification email/mot de passe
- Un workspace personnel par utilisateur
- Création, renommage, déplacement et suppression de fichiers/dossiers
- Upload multi-fichiers avec progression
- Vues grille et liste
- Recherche par nom
- Prévisualisation image, PDF, Markdown et code
- Liens de partage publics avec expiration
- Corbeille avec restauration

Ne développe pas encore : synchronisation desktop, édition collaborative, stockage chiffré de bout en bout, système de plugins, historique de versions ni partage d’équipe avancé.

## Étape 1 — Initialiser le monorepo

Crée un monorepo pnpm avec une application `apps/web` Next.js et, plus tard, un worker `apps/worker` dédié aux thumbnails et aux tâches asynchrones. Au départ, tu peux conserver le worker dans le même repository sans le lancer : cela évite de bloquer ton MVP sur une infra trop complexe.

```txt
fileflow/
├── apps/
│   ├── web/                 # Next.js
│   └── worker/              # Ajouté lors des previews async
├── packages/
│   ├── db/                  # Drizzle : schéma, client, migrations
│   ├── storage/             # Client MinIO/S3 + helpers presigned URLs
│   ├── config/              # ESLint, TypeScript, env validation
│   └── types/               # Types métier partagés
├── docker/
│   └── postgres/
├── docker-compose.yml
├── pnpm-workspace.yaml
└── package.json
```

**Livrable :** `pnpm dev` démarre l’application web, avec lint, formatage et vérification TypeScript fonctionnels.

## Étape 2 — Installer Kumo

Utilise Kumo comme unique design system. Kumo est une bibliothèque React moderne construite avec Base UI et Tailwind, avec plus de 35 composants accessibles, dont les tables, dialogues, inputs et combobox nécessaires au file manager.[2][3]

Installe Kumo et configure sa source pour Tailwind, puis importe ses styles dans ton fichier global :

```bash
pnpm add @cloudflare/kumo @phosphor-icons/react
```

```css
/* app/globals.css */
@source "../node_modules/@cloudflare/kumo/dist/**/*.{js,jsx,ts,tsx}";
@import "tailwindcss";
@import "@cloudflare/kumo/styles/tailwind";
```

La bibliothèque peut être installée depuis npm, et Kumo fournit aussi un registre de composants et de tokens exploitable pour conserver une UI cohérente.[4][5]

**Livrable :** une page `/design-system` qui montre tes composants réellement retenus : boutons, inputs, menu, modal, tooltip, table, skeleton, toast, dropdown, breadcrumbs, tabs et progress.

## Étape 3 — Préparer Docker local

Démarre avec trois services Docker : **PostgreSQL**, **MinIO** et l’app Next.js. Utilise des volumes nommés pour Postgres et MinIO afin de ne jamais perdre les fichiers ou les données à chaque redémarrage.

Variables de départ :

```env
DATABASE_URL=postgresql://fileflow:fileflow@postgres:5432/fileflow
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000

S3_ENDPOINT=minio
S3_PORT=9000
S3_USE_SSL=false
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=fileflow
S3_PUBLIC_ENDPOINT=http://localhost:9000
```

**Livrable :** `docker compose up --build` démarre la web app, Postgres et MinIO ; tu peux vérifier le bucket depuis la console MinIO.

## Étape 4 — Modéliser la base

Utilise Drizzle + PostgreSQL : Better Auth s’intègre à Next.js en montant son handler sous `/api/auth/[...all]`, avec un client React distinct pour le navigateur.[6][7]

Crée ces tables métier dès le départ :

| Table              | Rôle                                                            |
| ------------------ | --------------------------------------------------------------- |
| `workspace`        | Espace personnel ou équipe                                      |
| `workspace_member` | Membres, rôle et permissions                                    |
| `folder`           | Arborescence virtuelle via `parent_id`                          |
| `file`             | Métadonnées, clé MinIO, type MIME, taille, parent               |
| `share_link`       | Token, expiration, mot de passe éventuel, cible fichier/dossier |
| `upload`           | Upload temporaire, état, checksum, expiration                   |
| `trash_item`       | Éléments supprimés avec date de purge                           |
| `audit_log`        | Actions sensibles : suppression, partage, téléchargement        |

Ajoute une contrainte d’unicité sur `(workspace_id, parent_id, name)` pour empêcher deux fichiers/dossiers portant le même nom dans le même dossier.

**Décision structurante :** la base est la source de vérité pour l’arborescence, les droits et les métadonnées ; MinIO stocke uniquement les octets. Cela rend un renommage ou déplacement de dossier instantané côté SQL.

**Livrable :** migration Drizzle appliquée, seed de développement et interface d’exploration de base utilisable.

## Étape 5 — Auth et workspaces

Configure Better Auth avec email/password, un adaptateur Drizzle/Postgres et le plugin Next.js pour synchroniser les cookies dans les Server Components et Server Actions. Better Auth documente le montage de son handler Next.js dans une route catch-all dédiée.[8][6]

À l’inscription, crée automatiquement :

- L’utilisateur Better Auth
- Un workspace personnel nommé à partir du profil
- Le dossier racine logique — ou considère `parent_id = NULL` comme la racine
- Un membre `owner` dans `workspace_member`

Protège toutes les routes dashboard côté serveur. Chaque action sur un fichier doit vérifier `workspace_member` avant de révéler une métadonnée ou de signer une URL S3.

**Livrable :** inscription, connexion, déconnexion, dashboard vide et redirection automatique des utilisateurs non authentifiés.

## Étape 6 — Construire le shell Kumo

Crée le layout global du dashboard avant les API de fichiers, pour cadrer immédiatement l’expérience :

- Sidebar : workspace, fichiers, partagés, favoris, corbeille, réglages
- Header : breadcrumbs, recherche, bouton upload, bouton nouveau dossier, avatar
- Zone centrale : table ou grille
- Panneau de détail à droite : aperçu, tags, type, poids, propriétaire, dates et partage

Utilise Kumo pour les primitives, mais mets tes composants métier dans `components/files` :

```txt
components/files/
├── file-browser.tsx
├── file-table.tsx
├── file-grid.tsx
├── file-row-menu.tsx
├── file-preview.tsx
├── file-details-panel.tsx
├── file-breadcrumbs.tsx
└── upload-dropzone.tsx
```

**Livrable :** navigation avec des données mockées, responsive desktop/tablette et utilisation clavier correcte.

## Étape 7 — Fichiers et dossiers

Implémente d’abord l’API métier, séparée des routes HTTP :

```txt
lib/services/
├── folders.ts
├── files.ts
├── uploads.ts
├── shares.ts
└── permissions.ts
```

Ordre conseillé :

1. Lister le contenu d’un dossier
2. Créer un dossier
3. Renommer
4. Déplacer
5. Mettre à la corbeille
6. Restaurer
7. Supprimer définitivement

Chaque fonction prend `actorId` et `workspaceId`, vérifie les permissions, puis exécute sa transaction Drizzle. Ne fais pas de requête SQL directement dans tes composants React ou tes route handlers.

**Livrable :** créer, parcourir, renommer et déplacer des dossiers depuis l’UI.

## Étape 8 — Upload direct MinIO

Les URLs pré-signées autorisent temporairement un navigateur à uploader ou télécharger un objet privé sans exposer les clés S3 permanentes. MinIO prend en charge ces URLs pour les opérations `PUT` et `GET`, avec une durée d’expiration configurable.[9][10]

Le flux d’upload recommandé :

1. L’utilisateur sélectionne un fichier
2. `POST /api/uploads/presign` : nom, taille, MIME, dossier cible
3. Ton serveur valide la session, les droits, la taille et le quota
4. Il crée une clé non devinable, par exemple `workspaces/{id}/{uuid}`
5. Il enregistre un upload `pending` et renvoie une URL PUT signée, valable 5 à 15 minutes
6. Le navigateur envoie directement le fichier à MinIO avec `PUT`
7. `POST /api/uploads/complete` confirme l’existence de l’objet, lit ses métadonnées et crée la ligne `file`
8. L’UI rafraîchit le dossier et affiche la progression

Le SDK JavaScript MinIO fournit notamment `presignedPutObject`, `presignedGetObject` et les opérations de gestion d’objets nécessaires pour ce flux.[11][9]

**Livrable :** upload d’images, PDF et fichiers de plusieurs centaines de Mo sans faire transiter le flux binaire par Next.js.

## Étape 9 — Consultation et previews

L’API de listing ne retourne jamais une URL MinIO permanente. Elle retourne les métadonnées et, seulement si nécessaire, une URL de lecture signée très courte. Les liens pré-signés donnent un accès temporaire à des objets privés, même si le client n’a pas de credentials S3.[9]

Commence par ces previews :

- Images : URL GET signée, affichée directement
- PDF : viewer dans une modale ou un panneau latéral
- Markdown : lecture avec sanitation HTML
- JSON/code : coloration syntaxique et bouton copier
- Vidéo/audio : lecture native avec URL signée et support HTTP Range à vérifier côté reverse proxy

Pour les fichiers non prévisualisables, affiche un panneau de métadonnées avec téléchargement.

**Livrable :** double-clic sur un fichier ouvre son aperçu ; bouton télécharger fonctionnel.

## Étape 10 — Liens de partage

Un lien public est une ressource applicative, pas une URL MinIO donnée telle quelle. Génère un token aléatoire, stocke son hash, applique les règles d’expiration et, en option, hash le mot de passe.

Une route publique `/s/{token}` doit :

1. Vérifier que le lien existe, n’est pas expiré et n’a pas été révoqué
2. Demander son mot de passe si nécessaire
3. Créer une URL MinIO GET à très courte durée
4. Afficher un aperçu ou déclencher le téléchargement

**Livrable :** partage d’un fichier avec une personne non connectée, expiration testée et révocation immédiate.

## Étape 11 — Fiabilité et sécurité

Avant de déployer, ajoute ces garde-fous :

- Liste blanche de types MIME et taille maximale configurable
- Validation du type réel côté serveur, pas uniquement l’extension fournie par le navigateur
- Noms affichés distincts des clés S3, donc aucune clé dérivée directement d’un nom utilisateur
- Contrôle systématique des permissions à chaque action et chaque URL signée
- URLs signées de courte durée : 5 à 15 minutes pour l’upload, 1 à 5 minutes pour les téléchargements privés
- Rate limiting sur auth, presign, complétion et partage public
- Journal d’audit, corbeille avec purge différée et confirmations pour les destructions irréversibles
- Sauvegardes séparées : dump PostgreSQL + réplication/sauvegarde du volume MinIO

**Livrable :** tests de permissions inter-workspaces, tentative d’accès direct à une clé S3, et procédure de restauration documentée.

## Étape 12 — Worker et déploiement

Ajoute ensuite `apps/worker` pour les tâches lourdes : génération de thumbnails, extraction de métadonnées, suppression différée et scan antivirus si le produit devient public. MinIO peut notifier les événements liés aux buckets, mais ton premier worker peut aussi consommer simplement une table `jobs` PostgreSQL.[9]

En production, construis Next.js en mode `standalone`, utilise un Dockerfile multi-stage, ne publie jamais les ports MinIO/Postgres vers Internet, et expose uniquement l’app via un reverse proxy HTTPS. Le bucket doit rester privé : l’accès passe par ton application et ses URLs temporaires signées.[10][9]

**Livrable :** déploiement reproductible sur ton VPS, domaine HTTPS, sauvegardes et monitoring minimal.

## Ordre de travail

| Sprint | Objectif concret                                 |
| ------ | ------------------------------------------------ |
| 1      | Monorepo, Kumo, Docker, Postgres, MinIO          |
| 2      | Drizzle, Better Auth, workspace personnel        |
| 3      | Shell dashboard et navigation de dossiers mockée |
| 4      | CRUD dossiers/fichiers + corbeille               |
| 5      | Upload MinIO signé + download                    |
| 6      | Previews, recherche et partage public            |
| 7      | Sécurité, tests, backup, déploiement             |
| 8      | Worker, thumbnails, quotas, équipes              |

Ne passe à un sprint que si le livrable précédent est manuellement testable. Ce fonctionnement te donne un vrai produit démontrable dès les sprints 4 et 5, plutôt qu’une infra impeccable sans expérience utilisateur.

Sources
[1] Kumo https://kumo-ui.com/
[2] Kumo: Cloudflare's Accessible Component Library for React https://www.youtube.com/watch?v=kLjGth6S-94
[3] cloudflare/kumo - GitHub https://github.com/cloudflare/kumo
[4] Cloudflare's Accessible Component Library for React & Tailwind https://next.jqueryscript.net/tailwind-css/cloudflares-component-library-kumo/
[5] Component Registry - Kumo https://kumo-ui.com/registry
[6] Next.js integration https://better-auth.com/docs/integrations/next
[7] Next.js Example - Better Auth https://better-auth.com/docs/examples/next-js
[8] Framework Examples & Integration Guides | better-auth/better ... https://deepwiki.com/better-auth/better-auth/9.2-framework-examples-and-integration-guides
[9] JavaScript Client API Reference - MinIO AIStor Documentation https://docs.min.io/aistor/developers/sdk/javascript/api/
[10] Presigned URLs | minio/minio-js | DeepWiki https://deepwiki.com/minio/minio-js/4.3-presigned-urls
[11] minio/minio-js: MinIO Client SDK for Javascript - GitHub https://github.com/minio/minio-js
[12] JavaScript 客戶端 API 參考 https://minio.dev.org.tw/docs/minio/linux/developers/javascript/API.html
[13] Upload Files Using Pre-signed URLs - MinIO Object Storage https://minio-docs.tf.fo/integrations/presigned-put-upload-via-browser
[14] settlemint/sdk-minio https://www.npmjs.com/package/@settlemint/sdk-minio
[15] Integrate Better Auth UI with Next.js https://better-auth-ui.com/docs/heroui/integrations/nextjs
[16] Better-Auth with Next.js — A Complete Guide for Modern ... - Medium https://medium.com/@amitupadhyay878/better-auth-with-next-js-a-complete-guide-for-modern-authentication-06eec09d6a64
[17] setup better-auth with nextjs in minutes | by Parth Parmar https://medium.com/@parthparmar4507/setup-better-auth-with-nextjs-in-minutes-ecf0e4327722
[18] Database Models https://better-auth.com/docs/guides/next-auth-migration-guide
