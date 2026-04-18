"""Affiche id, username, email, is_superuser pour la base courante (debug prod).

Usage avec la même DATABASE_URL que Render :
  export DATABASE_URL='...'
  python manage.py list_auth_users

Affiche aussi l’hôte / le nom de base réellement utilisés (sans mot de passe) pour
comparer avec le Web Service Render (Environment → DATABASE_URL).
"""

import os
from urllib.parse import urlparse

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = 'Liste les utilisateurs Django (sans mot de passe). Utile avec DATABASE_URL Render.'

    def handle(self, *args, **options):
        raw_url = os.environ.get('DATABASE_URL', '').strip()
        if raw_url:
            p = urlparse(raw_url)
            dbn = (p.path or '/').lstrip('/') or '(vide)'
            self.stdout.write(
                f'Cible DATABASE_URL : hôte={p.hostname!r} base={dbn!r} utilisateur={p.username!r}',
            )
        db = settings.DATABASES['default']
        eng = db.get('ENGINE', '')
        if 'sqlite' in eng:
            self.stdout.write(
                self.style.WARNING(
                    'Django utilise SQLite (pas de DATABASE_URL valide ou .env local). '
                    'Ce n’est pas la base Render.',
                ),
            )
        else:
            self.stdout.write(
                f'Django ENGINE={eng} HOST={db.get("HOST")!r} NAME={db.get("NAME")!r}',
            )

        rows = User.objects.order_by('id').values_list(
            'id', 'username', 'email', 'is_active', 'is_superuser'
        )
        n = 0
        for uid, username, email, active, su in rows:
            n += 1
            self.stdout.write(
                f'id={uid} username={username!r} email={email!r} '
                f'is_active={active} is_superuser={su}',
            )
        if n == 0:
            self.stdout.write(self.style.WARNING('Aucun utilisateur dans cette base.'))
        else:
            self.stdout.write(self.style.SUCCESS(f'{n} utilisateur(s).'))
