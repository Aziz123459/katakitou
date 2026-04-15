import hashlib
import secrets

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import ClientAccessToken, UserProfile
from accounts.serializers import RegisterSerializer


class RegisterView(APIView):
    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        phone = data['phone'].strip()
        if UserProfile.objects.filter(phone=phone).exists():
            return Response(
                {'phone': ['Ce numéro est déjà enregistré.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        username = f'c_{secrets.token_hex(12)}'
        while User.objects.filter(username=username).exists():
            username = f'c_{secrets.token_hex(12)}'

        user = User(username=username, email='', first_name=data['name'][:150])
        user.set_unusable_password()
        user.save()
        UserProfile.objects.create(
            user=user,
            phone=phone,
            location=data['localization'].strip(),
            role=UserProfile.Role.CLIENT,
        )

        raw_token = secrets.token_urlsafe(48)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        ClientAccessToken.objects.create(user=user, token_hash=token_hash)

        return Response(
            {
                'id': user.id,
                'name': user.get_full_name() or user.first_name,
                'phone': phone,
                'role': UserProfile.Role.CLIENT,
                'access_token': raw_token,
            },
            status=status.HTTP_201_CREATED,
        )
