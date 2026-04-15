import re
from decimal import Decimal, InvalidOperation

from django.core.files.uploadedfile import UploadedFile
from django.db import transaction
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import ProductInventory, ShopProduct, ShopProductImage
from accounts.permissions import IsAdminRole


def _absolute_media_url(request, relative: str) -> str:
    if not relative:
        return ''
    return request.build_absolute_uri(relative)


def _shop_product_image_urls(request, product: ShopProduct) -> list[str]:
    urls: list[str] = []
    if product.image:
        urls.append(_absolute_media_url(request, product.image.url))
    for gi in product.gallery_images.all():
        if gi.image:
            urls.append(_absolute_media_url(request, gi.image.url))
    return urls


def _shop_product_row(request, product: ShopProduct) -> dict:
    primary = product.image.url if product.image else ''
    return {
        'id': f'sp-{product.pk}',
        'name': product.name,
        'description': product.description,
        'highlights': product.highlights or '',
        'price': str(product.price),
        'image_url': _absolute_media_url(request, primary),
        'image_urls': _shop_product_image_urls(request, product),
    }


class ShopProductPublicListView(APIView):
    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get(self, request):
        rows = []
        for p in ShopProduct.objects.prefetch_related('gallery_images').order_by('-created_at'):
            rows.append(_shop_product_row(request, p))
        return Response({'products': rows})


class AdminShopProductView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        rows = []
        for p in ShopProduct.objects.prefetch_related('gallery_images').order_by('-created_at'):
            rows.append(_shop_product_row(request, p))
        return Response({'products': rows})

    @transaction.atomic
    def post(self, request):
        name = (request.data.get('name') or '').strip()
        description = (request.data.get('description') or '').strip()
        highlights = (request.data.get('highlights') or '').strip()
        price_raw = (request.data.get('price') or '').strip()
        image = request.FILES.get('image')
        extra_files = [
            f for f in request.FILES.getlist('gallery') if isinstance(f, UploadedFile)
        ]

        if not name or len(name) > 200:
            return Response(
                {'detail': 'Le nom est requis (200 caractères max).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not description:
            return Response({'detail': 'La description est requise.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(highlights) > 8000:
            return Response(
                {'detail': 'Le champ puces est trop long (8000 caractères max).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            price = Decimal(price_raw.replace(',', '.'))
        except (InvalidOperation, AttributeError):
            return Response({'detail': 'Prix invalide.'}, status=status.HTTP_400_BAD_REQUEST)
        if price <= 0 or price.as_tuple().exponent < -3:
            return Response(
                {'detail': 'Le prix doit être positif avec au plus 3 décimales.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(image, UploadedFile):
            return Response({'detail': 'Une image est requise.'}, status=status.HTTP_400_BAD_REQUEST)

        product = ShopProduct.objects.create(
            name=name,
            description=description,
            highlights=highlights,
            price=price,
            image=image,
        )
        for i, up in enumerate(extra_files):
            ShopProductImage.objects.create(product=product, image=up, sort_order=i)

        inv_key = f'sp-{product.pk}'
        ProductInventory.objects.get_or_create(product_key=inv_key, defaults={'quantity': 0})

        return Response(
            {
                'ok': True,
                'product': _shop_product_row(request, product),
            },
            status=status.HTTP_201_CREATED,
        )


_SP_ID = re.compile(r'^sp-\d+$')


class AdminShopProductDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    @transaction.atomic
    def delete(self, request, product_id: str):
        if not _SP_ID.match(product_id):
            return Response(
                {'detail': 'Identifiant de produit invalide.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        pk = int(product_id.removeprefix('sp-'))
        try:
            product = ShopProduct.objects.prefetch_related('gallery_images').get(pk=pk)
        except ShopProduct.DoesNotExist:
            return Response({'detail': 'Produit introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        inv_key = f'sp-{pk}'
        ProductInventory.objects.filter(product_key=inv_key).delete()
        for gi in list(product.gallery_images.all()):
            if gi.image:
                gi.image.delete(save=False)
        if product.image:
            product.image.delete(save=False)
        product.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
