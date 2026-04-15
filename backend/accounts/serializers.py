import re

from rest_framework import serializers

from accounts.models import ShopProduct


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150, label='nom')
    phone = serializers.CharField(max_length=32, label='téléphone')
    localization = serializers.CharField(max_length=2000, label='localisation')


_LINE_ID_SP = re.compile(r'^sp-\d+$')


class OrderLineSerializer(serializers.Serializer):
    id = serializers.CharField(max_length=64)
    label = serializers.CharField(max_length=300)
    unitPrice = serializers.DecimalField(max_digits=12, decimal_places=3)
    qty = serializers.IntegerField(min_value=1)
    imageUrl = serializers.CharField(max_length=500, required=False, allow_blank=True, default='')

    def validate_id(self, value: str) -> str:
        if value in ('bag', 'towel', 'pack-duo-bain'):
            return value
        if _LINE_ID_SP.match(value):
            pk = int(value.removeprefix('sp-'))
            if ShopProduct.objects.filter(pk=pk).exists():
                return value
            raise serializers.ValidationError('Produit inconnu.')
        raise serializers.ValidationError('Identifiant de ligne invalide.')


class OrderCreateSerializer(serializers.Serializer):
    customer_name = serializers.CharField(max_length=150)
    phone = serializers.CharField(max_length=32)
    location = serializers.CharField()
    lines = OrderLineSerializer(many=True)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=3)
    shipping = serializers.DecimalField(max_digits=12, decimal_places=3)
    total = serializers.DecimalField(max_digits=12, decimal_places=3)


class CartLinesSerializer(serializers.Serializer):
    lines = OrderLineSerializer(many=True)


class ClaimTokenSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=32)
    name = serializers.CharField(max_length=150, required=False, allow_blank=True)
