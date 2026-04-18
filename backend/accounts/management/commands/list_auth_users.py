"""Affiche id, username, email, is_superuser pour la base courante (debug prod).

Usage avec la même DATABASE_URL que Render :
  export DATABASE_URL='...'
  python manage.py list_auth_users
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = 'Liste les utilisateurs Django (sans mot de passe). Utile avec DATABASE_URL Render.'

    def handle(self, *args, **options):
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
