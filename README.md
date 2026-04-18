# kokozito

- **Front** : landing Angular dans **`frontend/`**
- **API** : Django dans **`backend/`** (JSON, CORS pour le front en local)

## Démarrage — API

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate
pip install -r requirements.txt
copy .env.example .env
python manage.py migrate
python manage.py runserver
```

Santé : `http://127.0.0.1:8000/api/health/`

## Démarrage — front

```bash
cd frontend
npm install
npm start
```

## Publier le projet sur GitHub

### 1. Créer le dépôt sur GitHub

1. Ouvrir [github.com/new](https://github.com/new).
2. Choisir un **nom** (ex. `kokozito`) et **Public** ou **Private**.
3. **Ne pas** cocher « Add a README » si le code existe déjà en local (évite un premier commit sur GitHub qui complique le premier `push`).
4. Cliquer sur **Create repository**.

### 2. Premier commit en local

À la racine du dossier `kokozito` (là où se trouve ce `README.md`) :

```bash
git init
git add .
git status
git commit -m "Initial commit: boutique Kokozito"
```

Si Git demande ton identité :

```bash
git config user.name "Votre nom"
git config user.email "vous@exemple.com"
```

Le fichier **`.gitignore`** à la racine exclut déjà `node_modules`, `.venv`, `frontend/dist`, `backend/.env`, `db.sqlite3`, etc. Vérifie qu’aucun secret n’est versionné avant le `push`.

### 3. Lier le dépôt distant et pousser le code

Remplace `VOTRE_USER` et `NOM_DU_REPO` par les valeurs affichées sur GitHub après la création du dépôt :

```bash
git branch -M main
git remote add origin https://github.com/VOTRE_USER/NOM_DU_REPO.git
git push -u origin main
```

- **HTTPS** : GitHub demande souvent un **Personal Access Token** à la place du mot de passe du compte. Création : GitHub → **Settings** → **Developer settings** → **Personal access tokens**.
- **SSH** (si vous utilisez une clé) : utiliser l’URL `git@github.com:VOTRE_USER/NOM_DU_REPO.git` à la place de `https://…`.

### 4. Mises à jour suivantes

Après des modifications :

```bash
git add .
git commit -m "Description courte des changements"
git push
```

## Déploiement — pas à pas (Render + front statique)

Le dépôt est prêt côté prod : **Gunicorn**, **WhiteNoise**, **CORS** via variables d’environnement, **`DATABASE_URL`** pour Postgres (Render, etc.). Fichiers utiles : `backend/Procfile`, `render.yaml` (blueprint optionnel), `backend/.env.example`.

### Étape 1 — Pousser le code sur GitHub

Après vos modifications locales :

```bash
git add .
git commit -m "Message décrivant les changements"
git push
```

### Étape 2 — Créer l’API sur Render

1. Créez un compte sur [Render](https://render.com) et un **Web Service** lié à votre dépôt GitHub.
2. **Root directory** : `backend`.
3. **Build command** :

   ```text
   pip install -r requirements.txt && python manage.py collectstatic --noinput
   ```

4. **Start command** :

   ```text
   python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
   ```

5. Créez une base **PostgreSQL** sur Render et **associez-la** au service (Render fournit souvent `DATABASE_URL` automatiquement).
6. Dans **Environment** du service, définissez au minimum :

| Variable | Rôle |
|----------|------|
| `DJANGO_DEBUG` | `0` en production |
| `DJANGO_SECRET_KEY` | Chaîne longue aléatoire (obligatoire) |
| `DJANGO_ALLOWED_HOSTS` | Hôte de l’API, ex. `mon-api.onrender.com` (**sans** `https://`, plusieurs = virgules) |
| `DJANGO_CORS_ALLOWED_ORIGINS` | URL(s) **HTTPS** du front, ex. `https://mon-front.pages.dev` (plusieurs = virgules). À mettre à jour à l’étape 6 une fois l’URL du front connue. |
| `DATABASE_URL` | Souvent injecté automatiquement quand Postgres est lié |
| `DJANGO_SERVE_MEDIA` | Optionnel : `1` pour servir `/media/` via Django (**démo** ; disque Render peut être réinitialisé — en prod sérieuse prévoir S3 / R2) |

7. Déployez le service et notez l’**URL HTTPS** de l’API (ex. `https://mon-api.onrender.com`).
8. Testez : `https://<votre-service>/api/health/`

*(Vous pouvez aussi utiliser `render.yaml` à la racine ; vérifiez les offres Render actuelles.)*

### Étape 3 — Pointer le front vers l’API

1. Ouvrez `frontend/src/environments/environment.prod.ts`.
2. Remplacez **`apiBaseUrl`** par l’URL HTTPS exacte de l’API (étape 2.7).

### Étape 4 — Build du front

```bash
cd frontend
npm ci
npm run build
```

Dossier à publier : **`frontend/dist/cat-bag-shop/browser`**.

### Étape 5 — Héberger le site statique

Sur **Cloudflare Pages** ou **Netlify** : connectez le dépôt ou uploadez le dossier `browser`. Si le build se fait sur la plateforme : racine **`frontend`**, commande `npm ci && npm run build`, répertoire de sortie **`dist/cat-bag-shop/browser`**. Notez l’URL HTTPS du site.

### Étape 6 — Aligner le CORS

Sur Render, mettez **`DJANGO_CORS_ALLOWED_ORIGINS`** à l’URL exacte du front (`https://…`), puis redéployez l’API si besoin.

### Étape 7 — Tester

Testez inscription, catalogue, panier. En cas d’erreur : F12 → **Console** / **Network** (souvent CORS ou `apiBaseUrl`).

### Étape 8 — (Optionnel) Committer la config prod

Après avoir fixé `environment.prod.ts`, `git add` / `commit` / `push` (l’URL sera visible sur GitHub ; acceptable si le dépôt est privé).

### Compte administrateur (superuser) en production

L’**espace administrateur** du front et l’admin Django (`/admin/`) utilisent un **superutilisateur Django** (identifiant + mot de passe).

**Render gratuit : pas de Shell** sur le Web Service, donc pas de `createsuperuser` interactif dans le tableau de bord. Utilisez la commande **`bootstrap_superuser`** depuis **votre machine**, connectée à la **base Postgres Render** :

1. **Render** → votre instance **PostgreSQL** → bouton **Connect** → copiez l’URL **External Database URL** en entier. Elle doit contenir un hôte du type **`…postgres.render.com`** (avec région). Si l’hôte ressemble seulement à `dpg-xxxxx-a` sans domaine, la copie est **incomplète** et la connexion depuis votre PC échouera (`could not translate host name`).
2. **En local** : `cd backend`, activez le venv, `pip install -r requirements.txt` si besoin. **Windows** : si vous voyez une erreur du type *no pq wrapper* / *psycopg2*, c’est en général du **Python 32 bits** — installez **Python 64 bits**, recréez le `.venv`, puis installez le pilote binaire : `pip uninstall -y psycopg psycopg-binary` puis `pip install -r requirements-bootstrap.txt` (fichier dans `backend/`). Alternative : lancer la commande depuis **WSL**.
3. Définissez les variables d’environnement (exemples ci-dessous), puis lancez la commande.

**Git Bash** (Windows) :

```bash
export DATABASE_URL='postgresql://...'   # URL copiée depuis Render
export KOKOZITO_SUPERUSER_PASSWORD='votre_mot_de_passe_fort'
export KOKOZITO_SUPERUSER_EMAIL='vous@exemple.com'
# optionnel : export KOKOZITO_SUPERUSER_USERNAME=admin
# si erreur SSL à la connexion : export DATABASE_SSL_REQUIRE=1
python manage.py bootstrap_superuser
```

*(Cette commande exécute d’abord `migrate --noinput` sur la base pointée par `DATABASE_URL` pour créer les tables si besoin.)*

**PowerShell** (Windows) :

```powershell
$env:DATABASE_URL = "postgresql://..."
$env:KOKOZITO_SUPERUSER_EMAIL = "vous@exemple.com"
$env:KOKOZITO_SUPERUSER_PASSWORD = "votre_mot_de_passe_fort"
python manage.py bootstrap_superuser
Remove-Item Env:KOKOZITO_SUPERUSER_PASSWORD
```

4. Ne **commitez** jamais `DATABASE_URL` ni le mot de passe. Retirez les variables du terminal une fois la commande réussie.

**Si l’utilisateur existe déjà** (ex. `admin`) : exportez **`KOKOZITO_SUPERUSER_UPDATE=1`** (et **`KOKOZITO_SUPERUSER_EMAIL`** si vous voulez enregistrer l’e-mail sur le compte), puis relancez `python manage.py bootstrap_superuser` pour **mettre à jour mot de passe** (et e-mail si fourni).

**Instance Render payante** : vous pouvez à la place ouvrir **Shell** sur le Web Service et exécuter `python manage.py createsuperuser`.

Détails et contexte : [backend/README.md](backend/README.md) (section *Superuser sans Shell Render*).

## Documentation

- [frontend/README.md](frontend/README.md)
- [backend/README.md](backend/README.md)
- Plan pas à pas : [README-PLAN.md](README-PLAN.md)

Les tâches VS Code **npm: start** / **npm: test** ciblent le dossier `frontend/`.
