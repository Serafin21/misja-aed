"""Wykaz AED – nocne zadanie tworzące „Wykaz AED – wykaz zbiorczy” (wzór: resources/tasks/dga.py)."""
import logging

from django.apps import apps

from mcod.core.tasks import extended_shared_task
from mcod.resources.aed_utils import (
    clean_up_after_main_aed_resource_creation,
    create_main_aed_files,
    create_main_aed_resource_with_dataset,
    update_or_create_aggr_aed_info_and_delete_old_main_aed,
)
from mcod.resources.dga_utils import (
    FailedValidationException,
    PendingValidationException,
    check_all_resource_validations_status,
)

logger = logging.getLogger("mcod")


@extended_shared_task(
    max_retries=5,
    atomic=False,
    retry_countdown=20,
    retry_on_errors=(PendingValidationException,),
    bind=True,
    name="mcod.resources.tasks.create_main_aed_resource_task",
)
def create_main_aed_resource_task(self) -> None:
    """
    Kroki (jak create_main_dga_resource_task):

    1. Pliki CSV i XLSX z wierszami wszystkich opublikowanych wykazów AED (bez scalania; dostawca, typ instytucji,
       link do zasobu, data aktualizacji, 44 kolumny wzorca, „Możliwy duplikat”).
    2. Zasób „Wykaz AED – wykaz zbiorczy” (plik główny CSV + XLSX) w zbiorze Ministerstwa Cyfryzacji; zbiór jest
       tworzony, jeśli go nie ma.
    3. Sprawdzenie, czy walidacje nowego zasobu się zakończyły (ponowienie, gdy trwają).
    4. Aktualizacja AggregatedAEDInfo i usunięcie poprzedniego wykazu zbiorczego.

    Po błędzie albo braku walidacji w ostatniej próbie utworzone obiekty są usuwane; pliki tymczasowe – zawsze.
    """
    logger.info("Starting main AED resource creation.")
    Resource = apps.get_model("resources", "Resource")
    created = None
    paths = ()
    try:
        logger.info("Step 1/4: Creating main AED csv and xlsx files.")
        paths = create_main_aed_files()

        logger.info("Step 2/4: Creating main AED resource with files.")
        created = create_main_aed_resource_with_dataset(*paths)
        new_main = Resource.objects.get(pk=created[0])

        logger.info("Step 3/4: Checking resource validations.")
        check_all_resource_validations_status(new_main)

        logger.info("Step 4/4: Updating AggregatedAEDInfo and deleting old resource.")
        update_or_create_aggr_aed_info_and_delete_old_main_aed(new_main)
        logger.info("Main AED resource successfully created.")
        clean_up_after_main_aed_resource_creation(created, paths, exception_occurred=False)

    except PendingValidationException:
        if self.request.retries == self.max_retries:
            clean_up_after_main_aed_resource_creation(created, paths, exception_occurred=True)
        raise
    except FailedValidationException:
        clean_up_after_main_aed_resource_creation(created, paths, exception_occurred=True)
        raise
    except Exception as exc:
        logger.error(f"Cleaning after main AED resource creation task due to unexpected error: {exc}")
        clean_up_after_main_aed_resource_creation(created, paths, exception_occurred=True)
        raise
