from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_product_inventory'),
    ]

    operations = [
        migrations.CreateModel(
            name='ShopProduct',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('description', models.TextField()),
                ('price', models.DecimalField(decimal_places=3, max_digits=12)),
                ('image', models.ImageField(upload_to='shop_products/%Y/%m/')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'produit boutique',
                'verbose_name_plural': 'produits boutique',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AlterField(
            model_name='productinventory',
            name='product_key',
            field=models.CharField(db_index=True, max_length=64, unique=True),
        ),
    ]
