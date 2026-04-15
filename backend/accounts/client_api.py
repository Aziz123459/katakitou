import hashlib
import secrets

from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.auth_client import ClientTokenAuthentication
from accounts.models import ClientAccessToken, Order, SavedCart
from accounts.phone_utils import find_profile_by_phone, phones_match
from accounts.serializers import CartLinesSerializer, ClaimTokenSerializer


class ClaimClientTokenView(APIView):
    """Récupère un jeton si téléphone + nom correspondent au profil (appareils sans jeton en local)."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request):
        ser = ClaimTokenSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=400)
        phone = ser.validated_data['phone'].strip()
        name = (ser.validated_data.get('name') or '').strip()
        profile = find_profile_by_phone(phone)
        if profile is None:
            return Response({'detail': 'Profil introuvable pour ce numéro.'}, status=404)
        user = profile.user
        if name:
            expected = (user.first_name or '').strip().lower()
            if expected != name.lower():
                return Response({'detail': 'Le nom ne correspond pas au compte.'}, status=400)
        ClientAccessToken.objects.filter(user=user).delete()
        raw = secrets.token_urlsafe(48)
        digest = hashlib.sha256(raw.encode()).hexdigest()
        ClientAccessToken.objects.create(user=user, token_hash=digest)
        return Response({'access_token': raw})


class ClientProfileView(APIView):
    authentication_classes = [ClientTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        p = request.user.profile
        return Response(
            {
                'name': request.user.first_name or '',
                'phone': p.phone,
                'location': p.location,
                'role': p.role,
            },
        )


class ClientOrdersView(APIView):
    authentication_classes = [ClientTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = request.user.profile
        profile_phone = profile.phone
        # Même compte (user) OU même numéro (ex. commande créée avant liaison user, ou formats différents)
        seen: set[int] = set()
        out_rows: list[Order] = []
        for o in Order.objects.order_by('-created_at')[:250]:
            if o.id in seen:
                continue
            if o.user_id == request.user.id:
                out_rows.append(o)
                seen.add(o.id)
            elif phones_match(o.phone, profile_phone):
                out_rows.append(o)
                seen.add(o.id)
            if len(out_rows) >= 100:
                break
        out = []
        for o in out_rows:
            out.append(
                {
                    'id': str(o.id),
                    'confirmedAt': o.created_at.isoformat(),
                    'lines': o.lines_json,
                    'subtotal': float(o.subtotal),
                    'shipping': float(o.shipping),
                    'total': float(o.total),
                },
            )
        return Response(out)


class ClientCartView(APIView):
    authentication_classes = [ClientTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cart, _ = SavedCart.objects.get_or_create(
            user=request.user,
            defaults={'lines_json': []},
        )
        return Response({'lines': cart.lines_json})

    def put(self, request):
        ser = CartLinesSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=400)
        cart, _ = SavedCart.objects.get_or_create(
            user=request.user,
            defaults={'lines_json': []},
        )
        raw_lines = ser.validated_data['lines']
        lines_out = []
        for row in raw_lines:
            d = {
                'id': row['id'],
                'label': row['label'],
                'unitPrice': float(row['unitPrice']),
                'qty': row['qty'],
            }
            iu = (row.get('imageUrl') or '').strip()
            if iu:
                d['imageUrl'] = iu[:500]
            lines_out.append(d)
        cart.lines_json = lines_out
        cart.save(update_fields=['lines_json', 'updated_at'])
        return Response({'ok': True})
