# Wykaz AED – pole wzorem 0067_resource_contains_protected_data

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0074_auto_20260618_0956"),
    ]

    operations = [
        migrations.AddField(
            model_name="resource",
            name="contains_aed_list",
            field=models.BooleanField(default=False, verbose_name="Contains AED list"),
        ),
    ]
