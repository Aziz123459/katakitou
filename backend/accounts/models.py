from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    class Role(models.TextChoices):
        CLIENT = 'client', 'Client'
        ADMIN = 'admin', 'Administrateur'

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
    )
    phone = models.CharField(max_length=32)
    location = models.TextField(verbose_name='localisation')
    role = models.CharField(
        max_length=16,
        choices=Role.choices,
        default=Role.CLIENT,
    )

    class Meta:
        verbose_name = 'profil utilisateur'
        verbose_name_plural = 'profils utilisateur'

    def __str__(self) -> str:
        return f'Profil de {self.user.username}'


class ClientAccessToken(models.Model):
    """Jeton opaque pour l’API client (sans mot de passe) — hash SHA-256 stocké."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='client_access',
    )
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'jeton client'
        verbose_name_plural = 'jetons clients'


class SavedCart(models.Model):
    """Panier synchronisé pour les utilisateurs inscrits."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='saved_cart',
    )
    lines_json = models.JSONField(default=list)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'panier enregistré'
        verbose_name_plural = 'paniers enregistrés'


class Order(models.Model):
    """Commande enregistrée (synchronisée depuis le front)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='orders',
    )
    customer_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=32)
    location = models.TextField()
    lines_json = models.JSONField()
    subtotal = models.DecimalField(max_digits=12, decimal_places=3)
    shipping = models.DecimalField(max_digits=12, decimal_places=3)
    total = models.DecimalField(max_digits=12, decimal_places=3)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'commande'
        verbose_name_plural = 'commandes'

    def __str__(self) -> str:
        return f'Commande {self.id} — {self.phone}'


class SiteVisit(models.Model):
    """Une entrée par ping analytics (visite de page)."""

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'visite'
        verbose_name_plural = 'visites'


class ShopProduct(models.Model):
    """Produit ajouté depuis l’admin (affiché en boutique)."""

    name = models.CharField(max_length=200)
    description = models.TextField()
    highlights = models.TextField(
        blank=True,
        default='',
        verbose_name='puces (une ligne = une puce)',
        help_text='Optionnel : une ligne = une puce à côté de la galerie.',
    )
    price = models.DecimalField(max_digits=12, decimal_places=3)
    image = models.ImageField(upload_to='shop_products/%Y/%m/')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'produit boutique'
        verbose_name_plural = 'produits boutique'

    def __str__(self) -> str:
        return self.name


class ShopProductImage(models.Model):
    """Photos supplémentaires pour un produit boutique (en plus de l’image principale)."""

    product = models.ForeignKey(
        ShopProduct,
        related_name='gallery_images',
        on_delete=models.CASCADE,
    )
    image = models.ImageField(upload_to='shop_products/gallery/%Y/%m/')
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']
        verbose_name = 'image produit boutique'
        verbose_name_plural = 'images produit boutique'

    def __str__(self) -> str:
        return f'{self.product_id} #{self.pk}'


class ProductInventory(models.Model):
    """Quantités disponibles par produit (ids front : bag, towel, pack-duo-bain, ou sp-<id> pour ShopProduct)."""

    class ProductKey(models.TextChoices):
        BAG = 'bag', 'Sac de douche pour chats'
        TOWEL = 'towel', 'Serviette à capuche canard'
        PACK_DUO_BAIN = 'pack-duo-bain', 'Pack duo bain (cheveux + capuche canard)'

    product_key = models.CharField(max_length=64, unique=True, db_index=True)
    quantity = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'stock produit'
        verbose_name_plural = 'stocks produits'

    def __str__(self) -> str:
        return f'{self.product_key}: {self.quantity}'
