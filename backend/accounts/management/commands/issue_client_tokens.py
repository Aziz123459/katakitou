"""Attribue un jeton client aux utilisateurs qui n’en ont pas (comptes créés avant cette fonctionnalité)."""

import hashlib
import secrets

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from accounts.models import ClientAccessToken, UserProfile

User = get_user_model()


class Command(BaseCommand):
    help = 'Crée des ClientAccessToken manquants et affiche le jeton en clair (une fois).'

    def handle(self, *args, **options):
        created = 0
        for profile in UserProfile.objects.select_related('user').iterator():
            user = profile.user
            if ClientAccessToken.objects.filter(user=user).exists():
                continue
            raw = secrets.token_urlsafe(48)
            digest = hashlib.sha256(raw.encode()).hexdigest()
            ClientAccessToken.objects.create(user=user, token_hash=digest)
            self.stdout.write(
                self.style.SUCCESS(
                    f'user_id={user.id} phone={profile.phone!r} access_token={raw!r}',
                ),
            )
            created += 1
        if created == 0:
            self.stdout.write('Aucun jeton à créer.')
        else:
            self.stdout.write(self.style.WARNING('Conservez ces jetons : ils ne seront plus affichés.'))
