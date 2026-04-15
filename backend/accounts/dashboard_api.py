import calendar
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Order, ProductInventory, ShopProduct, SiteVisit, UserProfile
from accounts.permissions import IsAdminRole
from accounts.phone_utils import find_profile_by_phone
from accounts.serializers import OrderCreateSerializer


def _ensure_inventory_rows() -> None:
    for key, _label in ProductInventory.ProductKey.choices:
        ProductInventory.objects.get_or_create(product_key=key, defaults={'quantity': 0})


def _pct_delta(curr: int | float | Decimal, prev: int | float | Decimal) -> float | None:
    c = float(curr)
    p = float(prev)
    if p <= 0:
        return None if c <= 0 else 100.0
    return round((c - p) / p * 100, 1)


def _product_mix() -> list:
    tallies: dict = {}
    for o in Order.objects.all().only('lines_json'):
        for line in o.lines_json:
            pid = line['id']
            label = line.get('label') or str(pid)
            if pid not in tallies:
                tallies[pid] = {'qty': 0, 'label': label}
            tallies[pid]['qty'] += int(line['qty'])
            if not tallies[pid]['label']:
                tallies[pid]['label'] = label
    total = sum(t['qty'] for t in tallies.values())
    if total <= 0:
        return []
    out = []
    for pid, data in tallies.items():
        q = data['qty']
        out.append(
            {
                'product_key': pid,
                'label': data['label'],
                'qty': q,
                'pct': round(q / total * 100, 1),
            },
        )
    out.sort(key=lambda x: -x['qty'])
    return out


_FR_MONTHS = (
    'janv.',
    'févr.',
    'mars',
    'avr.',
    'mai',
    'juin',
    'juil.',
    'août',
    'sep.',
    'oct.',
    'nov.',
    'déc.',
)


def _analytics_series(granularity: str) -> dict:
    """Séries alignées pour visites, commandes et CA (même nombre de points)."""
    today = timezone.localdate()
    visits: list = []
    orders: list = []
    revenue: list = []

    if granularity == 'day':
        for i in range(29, -1, -1):
            d = today - timedelta(days=i)
            label = d.strftime('%d/%m')
            v = SiteVisit.objects.filter(created_at__date=d).count()
            oc = Order.objects.filter(created_at__date=d).count()
            r = Order.objects.filter(created_at__date=d).aggregate(s=Sum('total'))['s'] or Decimal('0')
            visits.append({'label': label, 'value': v})
            orders.append({'label': label, 'value': oc})
            revenue.append({'label': label, 'value': float(r)})

    elif granularity == 'month':
        y, m = today.year, today.month
        keys = []
        for _ in range(12):
            keys.append((y, m))
            m -= 1
            if m == 0:
                m = 12
                y -= 1
        keys.reverse()
        for yy, mm in keys:
            start = date(yy, mm, 1)
            ld = calendar.monthrange(yy, mm)[1]
            end = date(yy, mm, ld)
            label = f'{_FR_MONTHS[mm - 1]} {str(yy)[-2:]}'
            v = SiteVisit.objects.filter(created_at__date__gte=start, created_at__date__lte=end).count()
            oc = Order.objects.filter(created_at__date__gte=start, created_at__date__lte=end).count()
            r = (
                Order.objects.filter(created_at__date__gte=start, created_at__date__lte=end).aggregate(
                    s=Sum('total'),
                )['s']
                or Decimal('0')
            )
            visits.append({'label': label, 'value': v})
            orders.append({'label': label, 'value': oc})
            revenue.append({'label': label, 'value': float(r)})

    else:
        for yi in range(today.year - 4, today.year + 1):
            start = date(yi, 1, 1)
            end = date(yi, 12, 31)
            label = str(yi)
            v = SiteVisit.objects.filter(created_at__date__gte=start, created_at__date__lte=end).count()
            oc = Order.objects.filter(created_at__date__gte=start, created_at__date__lte=end).count()
            r = (
                Order.objects.filter(created_at__date__gte=start, created_at__date__lte=end).aggregate(
                    s=Sum('total'),
                )['s']
                or Decimal('0')
            )
            visits.append({'label': label, 'value': v})
            orders.append({'label': label, 'value': oc})
            revenue.append({'label': label, 'value': float(r)})

    return {'visits': visits, 'orders': orders, 'revenue': revenue}


def _inventory_label(product_key: str) -> str:
    if product_key == ProductInventory.ProductKey.BAG:
        return str(ProductInventory.ProductKey.BAG.label)
    if product_key == ProductInventory.ProductKey.TOWEL:
        return str(ProductInventory.ProductKey.TOWEL.label)
    if product_key == ProductInventory.ProductKey.PACK_DUO_BAIN:
        return str(ProductInventory.ProductKey.PACK_DUO_BAIN.label)
    if product_key.startswith('sp-'):
        tail = product_key.removeprefix('sp-')
        if tail.isdigit():
            name = ShopProduct.objects.filter(pk=int(tail)).values_list('name', flat=True).first()
            if name:
                return str(name)
    return product_key


def _inventory_payload() -> list:
    _ensure_inventory_rows()
    rows = ProductInventory.objects.order_by('product_key')
    return [
        {
            'product_key': r.product_key,
            'label': _inventory_label(r.product_key),
            'quantity': r.quantity,
        }
        for r in rows
    ]


def _shop_products_admin_payload(request) -> list:
    from accounts.shop_api import _shop_product_row

    return [
        _shop_product_row(request, p)
        for p in ShopProduct.objects.prefetch_related('gallery_images').order_by('-created_at')
    ]


def _order_lines_json_safe(lines: list) -> list:
    """JSONField n’accepte pas Decimal dans les dicts (sérialisation json standard)."""
    out = []
    for row in lines:
        up = row['unitPrice']
        item = {
            'id': row['id'],
            'label': row['label'],
            'unitPrice': float(up),
            'qty': int(row['qty']),
        }
        iu = row.get('imageUrl') or row.get('image_url')
        if iu:
            item['imageUrl'] = str(iu)[:500]
        out.append(item)
    return out


class OrderCreateView(APIView):
    """Enregistre une commande (appelée depuis le front après confirmation)."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = OrderCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        phone = data['phone'].strip()
        user = None
        profile = find_profile_by_phone(phone)
        if profile is not None:
            user = profile.user

        order = Order.objects.create(
            user=user,
            customer_name=data['customer_name'].strip(),
            phone=phone,
            location=data['location'].strip(),
            lines_json=_order_lines_json_safe(data['lines']),
            subtotal=data['subtotal'],
            shipping=data['shipping'],
            total=data['total'],
        )
        return Response(
            {'ok': True, 'id': order.id},
            status=status.HTTP_201_CREATED,
        )


class AnalyticsPingView(APIView):
    """Comptabilise une visite (une requête = une entrée, côté front limitée par session)."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request):
        SiteVisit.objects.create()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        now = timezone.now()
        today = now.date()
        month_start = today.replace(day=1)
        year_start = today.replace(month=1, day=1)

        orders_qs = Order.objects.all().order_by('-created_at')[:200]

        def orders_in_range(start_d, end_d=None):
            qs = Order.objects.filter(created_at__date__gte=start_d)
            if end_d is not None:
                qs = qs.filter(created_at__date__lte=end_d)
            return qs

        def visits_in_range(start_d, end_d=None):
            qs = SiteVisit.objects.filter(created_at__date__gte=start_d)
            if end_d is not None:
                qs = qs.filter(created_at__date__lte=end_d)
            return qs

        o_day = orders_in_range(today, today)
        o_month = orders_in_range(month_start, today)
        o_year = orders_in_range(year_start, today)

        v_day = visits_in_range(today, today).count()
        v_month = visits_in_range(month_start, today).count()
        v_year = visits_in_range(year_start, today).count()
        v_total = SiteVisit.objects.count()

        def revenue(qs):
            agg = qs.aggregate(s=Sum('total'))
            return agg['s'] or Decimal('0')

        prev_month_end = month_start - timedelta(days=1)
        prev_month_start = prev_month_end.replace(day=1)
        o_prev_q = orders_in_range(prev_month_start, prev_month_end)
        v_prev = visits_in_range(prev_month_start, prev_month_end).count()
        o_prev_c = o_prev_q.count()
        rev_prev = revenue(o_prev_q)
        rev_month = revenue(o_month)

        conv_m = round(o_month.count() / v_month * 100, 1) if v_month else 0.0
        conv_prev = round(o_prev_c / v_prev * 100, 1) if v_prev else 0.0

        orders_payload = [
            {
                'id': o.id,
                'customer_name': o.customer_name,
                'phone': o.phone,
                'location': o.location,
                'lines': o.lines_json,
                'subtotal': str(o.subtotal),
                'shipping': str(o.shipping),
                'total': str(o.total),
                'created_at': o.created_at.isoformat(),
            }
            for o in orders_qs
        ]

        profile_rows = (
            UserProfile.objects.select_related('user')
            .order_by('-user__date_joined')[:500]
        )
        accounts_payload = []
        for p in profile_rows:
            u = p.user
            display_name = (u.get_full_name() or u.first_name or '').strip() or u.username
            accounts_payload.append(
                {
                    'id': u.id,
                    'name': display_name,
                    'email': u.email or '',
                    'phone': p.phone,
                    'location': p.location,
                    'role': p.role,
                    'is_superuser': u.is_superuser,
                    'created_at': timezone.localtime(u.date_joined).isoformat(),
                }
            )

        return Response(
            {
                'orders': orders_payload,
                'accounts': accounts_payload,
                'inventory': _inventory_payload(),
                'shop_products': _shop_products_admin_payload(request),
                'product_mix': _product_mix(),
                'stats': {
                    'visitors_today': v_day,
                    'visitors_month': v_month,
                    'visitors_year': v_year,
                    'visitors_total': v_total,
                    'orders_today': o_day.count(),
                    'orders_month': o_month.count(),
                    'orders_year': o_year.count(),
                    'orders_total': Order.objects.count(),
                    'revenue_today': str(revenue(o_day)),
                    'revenue_month': str(rev_month),
                    'revenue_year': str(revenue(o_year)),
                    'revenue_total': str(revenue(Order.objects.all())),
                    'visitors_month_delta_pct': _pct_delta(v_month, v_prev),
                    'orders_month_delta_pct': _pct_delta(o_month.count(), o_prev_c),
                    'revenue_month_delta_pct': _pct_delta(rev_month, rev_prev),
                    'conversion_month_pct': conv_m,
                    'conversion_month_delta_pp': round(conv_m - conv_prev, 1),
                },
            }
        )


def _account_payload_from_user(user, profile: UserProfile) -> dict:
    display_name = (user.get_full_name() or user.first_name or '').strip() or user.username
    return {
        'id': user.id,
        'name': display_name,
        'email': user.email or '',
        'phone': profile.phone,
        'location': profile.location,
        'role': profile.role,
        'is_superuser': user.is_superuser,
        'created_at': timezone.localtime(user.date_joined).isoformat(),
    }


class AdminAccountDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def patch(self, request, user_id: int):
        User = get_user_model()
        role = request.data.get('role')
        if role not in (UserProfile.Role.ADMIN, UserProfile.Role.CLIENT):
            return Response(
                {'detail': 'Rôle invalide (attendu : admin ou client).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        profile = UserProfile.objects.select_related('user').filter(user_id=user_id).first()
        if profile is None:
            return Response(
                {'detail': 'Aucun profil pour cet utilisateur.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        user = profile.user
        if user.is_superuser:
            return Response(
                {'detail': 'Le rôle des superutilisateurs ne peut pas être modifié ici.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user.id == request.user.id:
            return Response(
                {'detail': 'Vous ne pouvez pas modifier votre propre rôle.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        profile.role = role
        profile.save(update_fields=['role'])
        return Response(
            {
                'ok': True,
                'account': _account_payload_from_user(user, profile),
            },
        )

    def delete(self, request, user_id: int):
        User = get_user_model()
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response(
                {'detail': 'Utilisateur introuvable.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        if user.id == request.user.id:
            return Response(
                {'detail': 'Vous ne pouvez pas supprimer votre propre compte.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if user.is_superuser:
            return Response(
                {'detail': 'Impossible de supprimer un compte superutilisateur.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminAnalyticsSeriesView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        g = request.query_params.get('granularity', 'month')
        if g not in ('day', 'month', 'year'):
            g = 'month'
        data = _analytics_series(g)
        return Response({'granularity': g, **data})


class AdminInventoryView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def patch(self, request):
        items = request.data.get('items')
        if not isinstance(items, list) or not items:
            return Response(
                {'detail': 'Liste « items » requise (tableau non vide).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        existing_keys = set(ProductInventory.objects.values_list('product_key', flat=True))
        for row in items:
            if not isinstance(row, dict):
                return Response({'detail': 'Chaque élément doit être un objet.'}, status=status.HTTP_400_BAD_REQUEST)
            pk = row.get('product_key')
            qty = row.get('quantity')
            if pk not in existing_keys:
                return Response(
                    {'detail': f'Clé produit inconnue : {pk!r}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not isinstance(qty, int) or qty < 0:
                return Response(
                    {'detail': 'La quantité doit être un entier positif ou nul.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            ProductInventory.objects.update_or_create(
                product_key=pk,
                defaults={'quantity': qty},
            )
        return Response({'ok': True, 'inventory': _inventory_payload()})
