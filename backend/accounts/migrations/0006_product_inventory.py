from django.db import migrations, models


def seed_inventory(apps, schema_editor):
    ProductInventory = apps.get_model('accounts', 'ProductInventory')
    for key in ('bag', 'towel'):
        ProductInventory.objects.get_or_create(product_key=key, defaults={'quantity': 0})


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_client_token_and_saved_cart'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProductInventory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                (
                    'product_key',
                    models.CharField(
                        choices=[('bag', 'Sac de douche pour chats'), ('towel', 'Serviette à capuche canard')],
                        db_index=True,
                        max_length=32,
                        unique=True,
                    ),
                ),
                ('quantity', models.PositiveIntegerField(default=0)),
            ],
            options={
                'verbose_name': 'stock produit',
                'verbose_name_plural': 'stocks produits',
            },
        ),
        migrations.RunPython(seed_inventory, noop),
    ]
