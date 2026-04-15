from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from accounts.roles import effective_kokozito_role


class KokozitoTokenSerializer(TokenObtainPairSerializer):
    """Accepte `email` + `password`, ou `username` + `password` (rétrocompatibilité)."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['email'] = serializers.EmailField(
            required=False,
            allow_blank=True,
            write_only=True,
        )
        self.fields[self.username_field].required = False
        self.fields[self.username_field].allow_blank = True

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = effective_kokozito_role(user)
        return token

    def validate(self, attrs):
        email = (attrs.get('email') or '').strip()
        username = (attrs.get(self.username_field) or '').strip()
        attrs.pop('email', None)

        if email:
            User = get_user_model()
            try:
                user_obj = User.objects.get(email__iexact=email)
            except (User.DoesNotExist, User.MultipleObjectsReturned):
                raise AuthenticationFailed(
                    self.error_messages['no_active_account'],
                    'no_active_account',
                )
            attrs[self.username_field] = user_obj.get_username()
        elif username:
            attrs[self.username_field] = username
        else:
            raise serializers.ValidationError(
                {'email': 'Indiquez une adresse e-mail ou un nom d’utilisateur.'},
            )

        data = super().validate(attrs)
        user = self.user
        data['role'] = effective_kokozito_role(user)
        data['username'] = user.username
        data['user_id'] = user.id
        return data


class KokozitoTokenView(TokenObtainPairView):
    serializer_class = KokozitoTokenSerializer
