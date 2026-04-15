import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0008_pack_duo_inventory'),
    ]

    operations = [
        migrations.AddField(
            model_name='shopproduct',
            name='highlights',
            field=models.TextField(blank=True, default='', verbose_name='puces (une ligne = une puce)'),
        ),
        migrations.CreateModel(
            name='ShopProductImage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('image', models.ImageField(upload_to='shop_products/gallery/%Y/%m/')),
                ('sort_order', models.PositiveSmallIntegerField(default=0)),
                (
                    'product',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='gallery_images',
                        to='accounts.shopproduct',
                    ),
                ),
            ],
            options={
                'verbose_name': 'image produit boutique',
                'verbose_name_plural': 'images produit boutique',
                'ordering': ['sort_order', 'id'],
            },
        ),
    ]
