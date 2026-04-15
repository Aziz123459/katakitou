from django.db import migrations


def seed_pack_duo(apps, schema_editor):
    ProductInventory = apps.get_model('accounts', 'ProductInventory')
    ProductInventory.objects.get_or_create(
        product_key='pack-duo-bain',
        defaults={'quantity': 0},
    )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_shopproduct_inventory_keys'),
    ]

    operations = [
        migrations.RunPython(seed_pack_duo, noop),
    ]
