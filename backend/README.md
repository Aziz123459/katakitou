# Backend Django (kokozito)

API JSON prête à être étendue (modèles, authentification, endpoints métier). **Aucune intégration e-commerce tierce** : c’est votre backend.

## Prérequis

- Python 3.10+

## Installation

```bash
cd backend
python -m venv .venv
```

**Windows (cmd)** : `.venv\Scripts\activate`  
**Git Bash** : `source .venv/Scripts/activate`

```bash
pip install -r requirements.txt
copy .env.example .env
```

Éditez `.env` : au minimum `DJANGO_SECRET_KEY` en production.

**Déploiement (Gunicorn, Postgres `DATABASE_URL`, CORS, collectstatic)** : voir la section *Déploiement* du [README à la racine](../README.md) et `Procfile`.

### PostgreSQL (commandes / achats en base serveur)

1. Installez PostgreSQL et créez une base, par ex. `kokozito` (utilisateur avec droits sur cette base).
2. Dans `.env`, décommentez et renseignez `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` (et host/port si besoin).
3. `python manage.py migrate`
4. Les commandes créées via `POST /api/orders/` (boutique) sont stockées dans cette base — **pas** dans le fichier SQLite local.

Sans `POSTGRES_DB`, le projet continue d’utiliser **SQLite** (`db.sqlite3`) pour le développement rapide.

## Migrations et serveur

```bash
python manage.py migrate
python manage.py runserver
```

- Santé : [http://127.0.0.1:8000/api/health/](http://127.0.0.1:8000/api/health/)
- Commandes : `POST /api/orders/` — enregistrées en base ; le tableau de bord admin (`GET /api/admin/dashboard/`) les lit là.
- Compte client : `POST /api/register/` renvoie un **`access_token`**. Le front l’enregistre et l’envoie en `Authorization: ClientToken …` pour `GET/PUT /api/client/cart/`, `GET /api/client/orders/`, `GET /api/client/profile/`. **Mes achats** et le **panier** sont ainsi synchronisés avec la base (plus d’historique uniquement local).
- Sans jeton en local mais avec **`kokozito_profile`** (nom + téléphone) : `POST /api/client/claim-token/` — le front appelle automatiquement cette route pour récupérer un jeton (nom identique au compte, insensible à la casse).
- Comptes créés **avant** l’introduction des jetons : `python manage.py issue_client_tokens` — copier le jeton affiché dans le `localStorage` du navigateur (`kokozito_client_token`) ou se réinscrire avec un autre numéro (non recommandé en prod).
- Inscription : `POST /api/register/` — corps JSON : `name`, `phone`, `localization` (pas d’e-mail ni mot de passe : compte technique avec mot de passe inutilisable). Réponse : `id`, `name`, `phone`, `role` (`client`).
- Rôles : chaque utilisateur a un profil avec `role` = `client` ou `admin`. Les **superutilisateurs** Django (`createsuperuser`) sont **toujours** considérés comme administrateurs (connexion Angular + `GET /api/admin/dashboard/`). Pour les autres comptes : **Admin Django** → utilisateur → profil → champ **role** → _Administrateur_. Vues protégées : `permission_classes = [IsAuthenticated, IsAdminRole]` (`accounts.permissions`).

### Superuser sans Shell Render (offre gratuite)

Les Web Services **gratuits** n’ont pas de **Shell** sur Render. Pour créer un admin dans **la base de prod** depuis votre machine :

1. Sur Render → **PostgreSQL** → **Connect** → copier l’**External Database URL** complète (hôte `*.postgres.render.com`). Une URL tronquée ne fonctionne pas depuis votre machine.
2. En local, dans `backend/` (venv activé, **`pip install -r requirements.txt`**). Pour parler à Postgres depuis Windows avec des wheels précompilés : **`pip uninstall -y psycopg psycopg-binary`** puis **`pip install -r requirements-bootstrap.txt`** (Python **64 bits** obligatoire ; en 32 bits il n’existe pas de wheel — utilisez Python x64 ou WSL) :
   - Exporter **`DATABASE_URL`** (valeur copiée). Si la connexion échoue, essayez **`DATABASE_SSL_REQUIRE=1`** (variable d’environnement).
   - Exporter **`KOKOZITO_SUPERUSER_PASSWORD`** (mot de passe fort, temporaire le temps de la commande).
   - Optionnel : `KOKOZITO_SUPERUSER_USERNAME` (défaut `admin`). **`KOKOZITO_SUPERUSER_EMAIL`** : obligatoire à la **création** (connexion admin sur le site avec e-mail + mot de passe). Avec **`KOKOZITO_SUPERUSER_UPDATE=1`**, si vous renseignez aussi l’e-mail, il est enregistré sur le compte existant.
3. Pour **voir quels comptes existent** sur cette base (sans mot de passe) : `python manage.py list_auth_users`.
4. Lancer : `python manage.py bootstrap_superuser` (la commande applique d’abord **`migrate --noinput`** sur la base ciblée par `DATABASE_URL`, sauf si `KOKOZITO_SUPERUSER_SKIP_MIGRATE=1`).
5. Retirer le mot de passe du terminal / ne pas le committer.

Si le compte existe déjà : même commande avec **`KOKOZITO_SUPERUSER_UPDATE=1`** pour définir un nouveau mot de passe.

Sur un service **payant**, vous pouvez aussi utiliser `python manage.py createsuperuser` dans le **Shell** Render.

## CORS

Les origines `http://localhost:4200` et `http://127.0.0.1:4200` sont autorisées pour un front Angular en local. Pour la production, complétez `CORS_ALLOWED_ORIGINS` dans `config/settings.py` (ou via variables d’environnement si vous factorisez la config).

## Prochaines étapes possibles

- Modèles et endpoints (commandes, catalogue, utilisateurs).
- Authentification (JWT, sessions).
- `django-environ` ou équivalent pour toute la config via `.env`.
