"""Rôle applicatif Kokozito (JWT, permissions)."""

from accounts.models import UserProfile


def effective_kokozito_role(user) -> str:
    """Les superutilisateurs Django sont toujours traités comme administrateurs."""
    if user is not None and getattr(user, 'is_superuser', False):
        return UserProfile.Role.ADMIN
    profile = getattr(user, 'profile', None)
    if profile is not None:
        return profile.role
    return UserProfile.Role.CLIENT
