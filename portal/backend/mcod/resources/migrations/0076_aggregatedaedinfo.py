# Wykaz AED – AggregatedAEDInfo (wzór: 0068_aggregateddgainfo)

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0075_resource_contains_aed_list"),
    ]

    operations = [
        migrations.CreateModel(
            name="AggregatedAEDInfo",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "resource",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to="resources.Resource",
                    ),
                ),
            ],
        ),
    ]
