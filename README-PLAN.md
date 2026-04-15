# Plan pas à pas — kokozito (Angular + Django)

Ce dépôt contient un **front** Angular (`frontend/`) et une **API** Django (`backend/`). Ce document résume **l’ordre des étapes** et **qui fait quoi**.

---

## Vue d’ensemble

| Qui | Rôle |
|-----|------|
| **Vous** | Configurer les environnements, lancer les serveurs, héberger le front et l’API, définir la logique métier (modèles Django, endpoints, sécurité). |
| **Assistant (Agent)** | Modifier le code dans le dépôt selon vos demandes. |

---

## Étape 1 — API Django en local (vous)

**Pourquoi** : disposer d’un serveur JSON pour la suite (formulaires, auth, données).

1. `cd backend`
2. Créer le venv, `pip install -r requirements.txt`, copier `.env.example` → `.env`
3. `python manage.py migrate`
4. `python manage.py runserver`
5. Vérifier [http://127.0.0.1:8000/api/health/](http://127.0.0.1:8000/api/health/)

Détails : [backend/README.md](backend/README.md).

---

## Étape 2 — Front Angular en local (vous)

**Pourquoi** : prévisualiser la landing et préparer les appels vers votre API.

1. `cd frontend`
2. `npm install` puis `npm start`
3. Ouvrir `http://localhost:4200`

Le CORS du backend autorise déjà `localhost:4200`. Détails : [frontend/README.md](frontend/README.md).

---

## Étape 3 — Relier front et back (vous + évolutions Agent)

**Pourquoi** : la landing affiche encore des prix statiques ; les commandes iront vers des **endpoints Django** que vous ajouterez.

1. Créer dans Django les vues / serializers / modèles nécessaires (ex. `POST /api/commandes/`).
2. Dans Angular, utiliser `HttpClient` vers `http://127.0.0.1:8000/api/...` en dev (ou une URL d’environnement).
3. En production : même domaine (reverse proxy) ou domaine API dédié + CORS mis à jour.

**Assistant (Agent)** : peut ajouter les endpoints Django et le formulaire Angular sur demande.

---

## Étape 4 — Mise en production (vous)

1. **Backend** : `DEBUG=0`, `SECRET_KEY` fort, `ALLOWED_HOSTS`, base de données adaptée (PostgreSQL, etc.), HTTPS.
2. **Frontend** : `ng build` puis déploiement des fichiers statiques.
3. Mettre à jour `CORS_ALLOWED_ORIGINS` dans `backend/config/settings.py` pour l’URL du front en prod.

---

## Ordre logique résumé

1. **Vous** : Django qui tourne + health OK.  
2. **Vous** : Angular qui tourne.  
3. **Vous / Agent** : endpoints + appels HTTP.  
4. **Vous** : durcissement et déploiement.

---

## Fichiers utiles

- [frontend/README.md](frontend/README.md)  
- [backend/README.md](backend/README.md)  
- `frontend/src/environments/environment.ts` — prix démo TND.  
- `backend/.env.example` — variables Django.
