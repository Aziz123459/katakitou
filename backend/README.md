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

## CORS

Les origines `http://localhost:4200` et `http://127.0.0.1:4200` sont autorisées pour un front Angular en local. Pour la production, complétez `CORS_ALLOWED_ORIGINS` dans `config/settings.py` (ou via variables d’environnement si vous factorisez la config).

## Prochaines étapes possibles

- Modèles et endpoints (commandes, catalogue, utilisateurs).
- Authentification (JWT, sessions).
- `django-environ` ou équivalent pour toute la config via `.env`.
