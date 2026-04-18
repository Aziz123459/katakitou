"""Crée ou met à jour un superutilisateur à partir d'environnement (sans prompt).

Utile sur Render **gratuit** (pas de Shell) : lancer en local avec DATABASE_URL
pointant vers la base Render (URL *externe* depuis la fiche Postgres).

Variables :
  KOKOZITO_SUPERUSER_USERNAME (défaut : admin)
  KOKOZITO_SUPERUSER_EMAIL (obligatoire à la création — connexion admin sur le site par e-mail)
  KOKOZITO_SUPERUSER_PASSWORD (obligatoire)
  KOKOZITO_SUPERUSER_UPDATE=1 — si l'utilisateur existe déjà, réinitialise le mot de passe
  KOKOZITO_SUPERUSER_SKIP_MIGRATE=1 — ne pas lancer migrate (défaut : migrate --noinput avant création)
"""

import os

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

User = get_user_model()


class Command(BaseCommand):
    help = 'Crée un superuser depuis KOKOZITO_SUPERUSER_* (voir docstring).'

    def handle(self, *args, **options):
        username = os.environ.get('KOKOZITO_SUPERUSER_USERNAME', 'admin').strip()
        email = os.environ.get('KOKOZITO_SUPERUSER_EMAIL', '').strip()
        password = os.environ.get('KOKOZITO_SUPERUSER_PASSWORD', '').strip()
        allow_update = os.environ.get('KOKOZITO_SUPERUSER_UPDATE', '').strip() == '1'

        if not password:
            raise CommandError(
                'Définissez KOKOZITO_SUPERUSER_PASSWORD (et DATABASE_URL si base distante).',
            )

        if os.environ.get('KOKOZITO_SUPERUSER_SKIP_MIGRATE', '').strip() != '1':
            self.stdout.write('Migrations (migrate --noinput)…')
            call_command('migrate', interactive=False, verbosity=1)

        if User.objects.filter(username=username).exists():
            user = User.objects.get(username=username)
            if not allow_update:
                raise CommandError(
                    f'Utilisateur {username!r} existe déjà. '
                    'Utilisez KOKOZITO_SUPERUSER_UPDATE=1 pour réinitialiser le mot de passe.',
                )
            user.set_password(password)
            user.is_staff = True
            user.is_superuser = True
            if email:
                user.email = email
            user.save()
            self.stdout.write(self.style.SUCCESS(f'Superuser {username!r} : mot de passe mis à jour.'))
            return

        if not email:
            raise CommandError(
                'Définissez KOKOZITO_SUPERUSER_EMAIL (adresse réelle) : la page admin du front '
                'se connecte avec l’e-mail et le mot de passe.',
            )

        User.objects.create_superuser(username, email, password)
        self.stdout.write(self.style.SUCCESS(f'Superuser {username!r} créé.'))
