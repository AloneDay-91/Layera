# FileCloud — Fondations + Auth (Sprints 1-2 du plan CLAUDE.md)

## Contexte

Le fichier `CLAUDE.md` à la racine décrit un plan complet en 12 étapes pour construire FileCloud,
un gestionnaire de fichiers self-hosted (workspace personnel, upload MinIO, previews, partage).
C'est trop large pour une seule spec/plan d'implémentation. Ce document couvre uniquement les
étapes 1 à 5 du plan : monorepo, design system Kumo, Docker local, modèle de données, et
authentification avec création automatique du workspace personnel. Les étapes 6 à 12 (shell
dashboard, CRUD fichiers, upload, previews, partage, sécurité, worker/déploiement) feront l'objet
de specs séparées, dans l'ordre du plan.

Nom du produit : **FileCloud**.

## Objectif

À la fin de ce sous-projet :
- `pnpm dev` démarre l'app web avec lint/format/typecheck fonctionnels.
- `docker compose up --build` démarre Next.js, Postgres et MinIO avec des volumes persistants.
- Un utilisateur peut s'inscrire, se connecter, se déconnecter, et arrive sur un dashboard vide
  protégé — un workspace personnel et un dossier racine sont créés automatiquement à l'inscription.
- Une page `/design-system` présente les composants Kumo retenus.

## Hors scope (sous-projets suivants)

Shell dashboard complet, navigation de dossiers, CRUD fichiers/dossiers, upload MinIO, previews,
recherche, partage public, corbeille, worker, déploiement production, vérification d'email,
équipes/partage avancé.

## Architecture — monorepo

```
filecloud-v2/
├── apps/
│   ├── web/                 # Next.js 15 (App Router)
│   └── worker/              # dossier posé, vide (structure conforme au plan, utilisé à l'étape 12)
├── packages/
│   ├── db/                  # Drizzle : schéma, client, migrations, seed
│   ├── storage/              # Client MinIO/S3 + helpers presigned URLs (posé, non utilisé avant l'étape 8)
│   ├── config/                # ESLint, config TypeScript partagée, validation env (zod)
│   └── types/                  # Types métier partagés
├── docker/postgres/
├── docker-compose.yml
├── pnpm-workspace.yaml
└── package.json
```

## Base de données (packages/db, Drizzle + PostgreSQL)

Schéma complet posé dès cette étape (même si seules `workspace`, `workspace_member`, `folder`
et les tables Better Auth sont réellement utilisées ici) pour éviter une migration de schéma
supplémentaire au sous-projet suivant :

| Table | Rôle |
|---|---|
| `workspace` | Espace personnel ou équipe |
| `workspace_member` | Membres, rôle et permissions |
| `folder` | Arborescence virtuelle via `parent_id` |
| `file` | Métadonnées, clé MinIO, type MIME, taille, parent |
| `share_link` | Token, expiration, mot de passe éventuel, cible fichier/dossier |
| `upload` | Upload temporaire, état, checksum, expiration |
| `trash_item` | Éléments supprimés avec date de purge |
| `audit_log` | Actions sensibles : suppression, partage, téléchargement |

- Contrainte unique `(workspace_id, parent_id, name)` sur `folder` et `file`.
- La base est la source de vérité pour l'arborescence, les droits et les métadonnées ; MinIO
  stocke uniquement les octets (pas utilisé avant l'étape 8, mais la décision structure le schéma).
- Tables Better Auth (user, session, account, verification) générées via son schéma standard,
  adaptateur Drizzle/Postgres.

**Livrable :** migration Drizzle appliquée, seed de développement (un compte de test), Drizzle
Studio utilisable pour explorer la base.

## Authentification (Better Auth)

- Email/password uniquement. **Pas de vérification d'email** pour ce sous-projet (pas de provider
  SMTP configuré) — connexion possible immédiatement après inscription. Ajoutable plus tard sans
  changement de schéma.
- Handler monté sous `/api/auth/[...all]`, client React séparé pour le navigateur.
- Hook Better Auth `after sign-up` (dans une transaction Drizzle) :
  1. Crée le user Better Auth (déjà fait par Better Auth lui-même).
  2. Crée un workspace personnel nommé à partir du profil (ex: "Workspace de {name}").
  3. Crée le dossier racine (`parent_id = NULL`).
  4. Crée le membre `workspace_member` avec le rôle `owner`.
- Toutes les routes sous `/dashboard/*` sont protégées côté serveur (vérification de session dans
  un layout serveur ou middleware) ; redirection vers `/login` si non authentifié.

**Livrable :** inscription, connexion, déconnexion, dashboard vide, redirection automatique des
utilisateurs non authentifiés.

## UI — Kumo & pages

- `@cloudflare/kumo` + `@phosphor-icons/react` comme design system unique, configuré avec
  Tailwind selon le plan (`@source`, `@import` dans `app/globals.css`).
- Page `/design-system` : vitrine des composants retenus (boutons, inputs, menu, modal, tooltip,
  table, skeleton, toast, dropdown, breadcrumbs, tabs, progress). Pas encore le shell dashboard
  complet (sidebar/header/panneau de détail) — ça, c'est l'étape 6, dans un sous-projet séparé.
- Pages minimales : `/login`, `/register`, `/dashboard` (page vide protégée, sert uniquement à
  valider que l'auth fonctionne de bout en bout).

## Docker local

- Trois services : **PostgreSQL**, **MinIO**, **Next.js** (dev), volumes nommés pour Postgres et
  MinIO (persistance entre redémarrages).
- Variables d'environnement (`.env`) :

```env
DATABASE_URL=postgresql://filecloud:filecloud@postgres:5432/filecloud
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000

S3_ENDPOINT=minio
S3_PORT=9000
S3_USE_SSL=false
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=filecloud
S3_PUBLIC_ENDPOINT=http://localhost:9000
```

**Livrable :** `docker compose up --build` démarre les trois services ; le bucket `filecloud` est
vérifiable depuis la console MinIO.

## Tests / vérification manuelle

- `pnpm dev` fonctionne (lint, format, typecheck sans erreur).
- `docker compose up --build` démarre les 3 services, données persistantes après un restart.
- Inscription → workspace personnel + dossier racine + membre `owner` créés en base (vérifiable
  via Drizzle Studio).
- Connexion / déconnexion fonctionnent, `/dashboard` inaccessible sans session.
- `/design-system` affiche les composants Kumo listés sans erreur console.

## Prérequis machine (vérifiés)

Node v26.5.0, pnpm 10.28.0, Docker 28.3.2 — tous présents.
