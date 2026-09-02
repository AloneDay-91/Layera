# Layera — Mises à jour liées aux GitHub Releases

## Contexte

Layera est self-hosted (`docker-compose.prod.yml`). La CI pousse déjà l’image **web** `ghcr.io/aloneday-91/filecloud-v2` (`latest` + SHA) après un CI vert sur `main`. Il n’y a pas de tags sémantiques, pas de GitHub Releases, et l’app n’affiche aucune version. `docker-compose.prod.yml` **build** encore `web` depuis les sources : `docker compose pull` ne mettrait rien à jour aujourd’hui. Le worker n’est pas publié sur GHCR (build local uniquement).

## Objectif

À la fin de ce sous-projet :

- Un tag git `vX.Y.Z` publie un GitHub Release **et** l’image `ghcr.io/aloneday-91/filecloud-v2:vX.Y.Z` (en plus de `latest`).
- L’image web embarque `APP_VERSION` (ex. `1.2.0`). En local / sans tag : `0.0.0-dev`.
- En prod, le service `web` **tire** cette image GHCR au lieu de builder sur l’hôte.
- Un admin connecté voit un `Banner` Kumo sous le header du dashboard si le dernier GitHub Release est plus récent que `APP_VERSION`.
- Le bandeau propose « Voir la release » (lien GitHub) et « Copier la commande » (`docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d`).
- Dismiss mémorisé jusqu’au **prochain** tag (localStorage). Les non-admins ne voient rien. Un push `main` sans tag ne déclenche pas d’alerte.

## Hors scope

- Déploiement lancé par l’app (pas d’accès au démon Docker).
- Auto-update / Watchtower.
- Notification sur login, register, ou pour les non-admins.
- Changelog complet dans le bandeau.
- Page Admin dédiée « Version ».
- Publier l’image worker sur GHCR (reste un `build:` local ; `pull` ne met à jour que `web`).

## Décisions

| Sujet | Choix |
| ----- | ----- |
| Action | Notification + lien GitHub + commande Docker à copier |
| Audience | Admins (`session.user.role === "admin"`) |
| Source de vérité | GitHub Releases sémantiques (`vX.Y.Z`) |
| UI | `Banner` info sous le header dashboard, dismissable |
| Détection | Route serveur, cache 1 h, pas d’appel GitHub depuis le navigateur |
| Image prod | `web` via GHCR ; worker inchangé (build local) |

## Architecture

### Version installée

Injectée au **build** de l’image web, jamais lue depuis `.git` au runtime.

- Dockerfile web : `ARG APP_VERSION=0.0.0-dev` → `ENV APP_VERSION=...`
- Le workflow de publish passe `--build-arg APP_VERSION=X.Y.Z` sur un tag `vX.Y.Z`.
- `apps/web/lib/app-version.ts` : `getAppVersion()` lit `process.env.APP_VERSION`, fallback `0.0.0-dev`.
- En `pnpm dev` (`0.0.0-dev`) : **pas d’alerte**.

### Comparaison

Module pur `apps/web/lib/updates.ts` (testable sans réseau) :

- Normalise `v1.2.0` → `1.2.0`.
- Compare en semver (`1.2.0` < `1.3.0`).
- Un tag prerelease (`1.3.0-rc.1`) n’est pas une mise à jour par rapport à un stable. GitHub `releases/latest` ignore déjà drafts/prereleases ; le parseur refuse aussi un tag prerelease s’il arrive.

`isUpdateAvailable(current, latest) → boolean`

### Route `GET /api/admin/updates`

1. `getAdminSession()` — si null, **404** (même convention que `/dashboard/admin`).
2. Si `getAppVersion()` est `0.0.0-dev` → `{ upToDate: true, current }`.
3. Sinon `GET https://api.github.com/repos/{owner}/{repo}/releases/latest` avec `Accept: application/vnd.github+json`, `User-Agent: layera`, et `Authorization: Bearer $GITHUB_TOKEN` si défini.
4. Cache mémoire **1 heure** (clé = repo). Erreur réseau, 403, 404, JSON invalide : **pas d’alerte** (`upToDate: true`), log serveur. Le dashboard ne casse pas.
5. Corps JSON, jamais de token :

```ts
type UpdatesResponse =
  | { upToDate: true; current: string }
  | {
      upToDate: false;
      current: string;
      latest: string;       // "1.3.0"
      tag: string;          // "v1.3.0"
      htmlUrl: string;
      composeCommand: string;
    };
```

Repo par défaut `AloneDay-91/filecloud-v2`, surcharge `GITHUB_REPO`.

### UI

`apps/web/components/shell/update-banner.tsx` (client) :

- Monté dans `dashboard-shell.tsx` seulement si `initialUser.role === "admin"` (déjà fourni par le layout shell).
- Fetch `/api/admin/updates` après mount. Pas de fetch pour les non-admins.
- Si `upToDate`, erreur fetch, ou `localStorage["filecloud-dismissed-update"] === tag` → rien.
- Sinon `Banner` Kumo `variant="info"` sous le header, au-dessus de `<main>`.
- Titre sentence case : « Layera {latest} is available » / « Layera {latest} est disponible ».
- Description : version installée.
- `Banner.Action` primaire : lien `htmlUrl` (`target="_blank"`, `rel="noopener noreferrer"`).
- `Banner.Action` secondaire : copie `composeCommand`, toast succès.
- Close du Banner → écrit le `tag` dans localStorage.

i18n dans `en.json` / `fr.json`.

### Compose prod

Le service `web` passe de `build:` à :

```yaml
image: ghcr.io/aloneday-91/filecloud-v2:${LAYERA_VERSION:-latest}
```

`LAYERA_VERSION` optionnel dans `.env.production` (ex. `v1.2.0` pour pinner). Par défaut `latest`, donc la commande copiée dans le bandeau suffit.

Documenter `docker login ghcr.io` si le package est privé. Worker : `build:` inchangé.

## CI / Releases

`docker-publish.yml` continue de publier `latest` + SHA après CI vert sur `main` (sans notification in-app).

À ajouter :

- Trigger `push.tags: ["v*.*.*"]` (en plus du `workflow_run` actuel).
- Sur un tag `vX.Y.Z` : checkout du tag, `--build-arg APP_VERSION=X.Y.Z`, tags Docker `vX.Y.Z` + `latest`.
- Créer le GitHub Release s’il n’existe pas (`softprops/action-gh-release` ou équivalent) à partir des notes du tag. Sans Release, `releases/latest` ne nourrit pas le bandeau.

Un merge `main` sans tag met à jour `latest` mais **ne change pas** le dernier Release : pas de bandeau.

README : comment tagger (`git tag v1.2.0 && git push origin v1.2.0`) et la commande de mise à jour.

## Fichiers concernés (prévision)

| Fichier | Rôle |
| ------- | ---- |
| `apps/web/lib/app-version.ts` | Lit `APP_VERSION` |
| `apps/web/lib/updates.ts` | Semver + forme de réponse |
| `apps/web/lib/updates.test.ts` | Comparaison, prereleases, normalisation |
| `apps/web/app/api/admin/updates/route.ts` | GitHub + cache + garde admin |
| `apps/web/components/shell/update-banner.tsx` | Banner |
| `apps/web/components/shell/dashboard-shell.tsx` | Monte le bandeau si admin |
| `apps/web/Dockerfile` | `ARG`/`ENV APP_VERSION` |
| `docker-compose.prod.yml` | `web` → image GHCR |
| `.github/workflows/docker-publish.yml` | Tags `v*` + build-arg + GitHub Release |
| `apps/web/messages/{en,fr}.json` | Copy du bandeau |
| `README.md` | Versioning + commande de maj |
| `.env.example` / `.env.production.example` | `GITHUB_REPO`, `GITHUB_TOKEN`, `LAYERA_VERSION` optionnels |

## Tests / vérification

- Unit : `1.2.0` vs `v1.3.0` → update ; égalité → non ; `0.0.0-dev` → pas d’alerte ; prerelease ignorée.
- Route : non-admin → 404 ; admin + GitHub mocké plus récent → `upToDate: false`.
- Manuel : admin + release plus récent → bandeau ; dismiss → disparait au reload ; non-admin → pas de bandeau ; GitHub down → dashboard intact.
