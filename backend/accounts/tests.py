from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import UserProfile


class RegisterRoleTests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()

    def test_register_sets_client_role(self) -> None:
        response = self.client.post(
            '/api/register/',
            {
                'name': 'Test User',
                'phone': '+21600000000',
                'localization': 'Tunis',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['role'], UserProfile.Role.CLIENT)
        self.assertEqual(response.data['phone'], '+21600000000')
        user = User.objects.get(id=response.data['id'])
        self.assertEqual(user.profile.role, UserProfile.Role.CLIENT)
        self.assertEqual(user.profile.phone, '+21600000000')
