import hashlib

from django.contrib.auth.models import User
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from accounts.models import ClientAccessToken


class ClientTokenAuthentication(BaseAuthentication):
    """Authorization: ClientToken <jeton en clair>"""

    def authenticate(self, request):
        auth = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth.startswith('ClientToken '):
            return None
        raw = auth[12:].strip()
        if not raw:
            return None
        digest = hashlib.sha256(raw.encode()).hexdigest()
        try:
            row = ClientAccessToken.objects.select_related('user').get(token_hash=digest)
        except ClientAccessToken.DoesNotExist as exc:
            raise AuthenticationFailed('Jeton client invalide.') from exc
        user: User = row.user
        if not user.is_active:
            raise AuthenticationFailed('Compte inactif.')
        return (user, None)
