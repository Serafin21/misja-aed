"""python manage.py create_main_aed_resource [--async]

Wykaz AED: tworzy „Wykaz AED – wykaz zbiorczy” na żądanie (to samo co nocne zadanie create_main_aed_resource_task).
Bez --async zadanie wykonuje się od razu w tym procesie (bez kolejki Celery).
"""
from django.core.management.base import BaseCommand

from mcod.resources.tasks.aed import create_main_aed_resource_task


class Command(BaseCommand):
    help = "Tworzy „Wykaz AED – wykaz zbiorczy” z wykazów AED wszystkich dostawców."

    def add_arguments(self, parser):
        parser.add_argument("--async", action="store_true", dest="run_async", help="wyślij zadanie do kolejki Celery")

    def handle(self, *args, **options):
        if options["run_async"]:
            result = create_main_aed_resource_task.delay()
            self.stdout.write(f"Zadanie wysłane do kolejki: {result.id}")
            return
        create_main_aed_resource_task.apply(throw=True)
        self.stdout.write(self.style.SUCCESS("Wykaz zbiorczy AED utworzony."))
