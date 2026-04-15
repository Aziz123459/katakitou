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

## Déploiement (Render + front statique)

Le dépôt inclut une base prête pour la prod : **Gunicorn**, **WhiteNoise** (fichiers statiques Django), **CORS** configurable, **`DATABASE_URL`** (Postgres Render / Heroku).

### Variables d’environnement (API)

| Variable | Exemple / rôle |
|----------|----------------|
| `DJANGO_DEBUG` | `0` en production |
| `DJANGO_SECRET_KEY` | Chaîne longue aléatoire (obligatoire) |
| `DJANGO_ALLOWED_HOSTS` | `mon-api.onrender.com` (sans `https://`, plusieurs séparés par des virgules) |
| `DJANGO_CORS_ALLOWED_ORIGINS` | `https://mon-front.pages.dev` (URLs complètes avec `https://`, plusieurs = virgules) |
| `DATABASE_URL` | Fourni automatiquement si Postgres **lié** sur Render (`postgres://…`) |
| `DJANGO_SERVE_MEDIA` | `1` pour servir `/media/` via Django (démo ; en vrai prod prévoir S3 / R2) |

Fichiers utiles : `backend/Procfile`, `render.yaml` (blueprint optionnel à la racine), `backend/.env.example`.

### Commandes Render (service web, **root directory** = `backend`)

- **Build** : `pip install -r requirements.txt && python manage.py collectstatic --noinput`
- **Start** : `python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`

Tester : `https://<votre-service>/api/health/`

### Front (Angular)

1. Dans `frontend/src/environments/environment.prod.ts`, remplacez **`apiBaseUrl`** par l’URL HTTPS de l’API (même valeur que côté CORS).
2. Build : `cd frontend && npm ci && npm run build`
3. Déployez le contenu du dossier **`frontend/dist/cat-bag-shop/browser`** sur Cloudflare Pages, Netlify, etc.

## Documentation

- [frontend/README.md](frontend/README.md)
- [backend/README.md](backend/README.md)
- Plan pas à pas : [README-PLAN.md](README-PLAN.md)

Les tâches VS Code **npm: start** / **npm: test** ciblent le dossier `frontend/`.
