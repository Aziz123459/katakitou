from rest_framework.permissions import BasePermission

from accounts.models import UserProfile
from accounts.roles import effective_kokozito_role


class IsAdminRole(BasePermission):
    """Superutilisateurs Django ou profil avec rôle administrateur."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return effective_kokozito_role(user) == UserProfile.Role.ADMIN
