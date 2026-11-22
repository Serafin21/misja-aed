# Zrzuty do prezentacji (CR-TL-9)

| Plik | Slajd | Stan |
|---|---|---|
| `07_mapa.png` | 9 | Mapa danych AED – „Znajdź AED”, gmina Krosno (nowy nagłówek, 22.11 rano, od człowieka B) |
| `08_karta.png` | 9 | karta AED – „Skąd są te dane i kto za nie odpowiada”, Urząd Miasta Krosna (zbiór przejściowy) |
| `10_telefon.png` | 9 | karta AED na telefonie (390 px) |
| `11_paszport.png` | – | naklejka „Paszport AED” z kodem QR (zapas) |
| `09_dla_instytucji.png` | 8 | „Dla instytucji” – publikacja wykazu AED w panelu dane.gov.pl w krokach |
| `01_portal_git_log.png` | 3 | `git log -- portal/`: pierwszy commit = kod dane.gov.pl bez zmian, kolejne = przyrost „Wykaz AED” |
| `02_portal_panel_zawiera_wykaz_aed.png` | 4 | **uruchomiony portal** (panel admin.mcod.local): zasób z „Contains AED list: Tak” i znakiem umownym „-” |
| `03_portal_walidacja_bledy.png` | 5 | **uruchomiony portal**: plik z błędami odrzucony – lista błędów wiersz po wierszu (współrzędne zamienione, TERYT, kontakt, słownik dostępu) |
| `04_portal_wykazy_aed_w_panelu.png` | 6 | **uruchomiony portal**: wykazy dwóch instytucji i „Wykaz AED – wykaz zbiorczy” (CSV, XLSX) – wszystkie walidacje portalu zielone |
| `05_portal_wykaz_zbiorczy_csv.png` | 6 | plik CSV wykazu zbiorczego pobrany z portalu (wybrane kolumny): dostawca, typ, link, „Możliwy duplikat” bez scalania |
| `06_portal_api_aed_aggregated.png` | 6 | odpowiedź `GET /aed-aggregated` uruchomionego API portalu |
| `12_mapa_karta_z_wykazu_portalu.png` | 7 | karta AED w Mapie danych AED, która czyta wykaz z portalu (`PORTAL_API`): dostawca i link do jego zasobu |

Zrzuty 01–06 i 12: portal uruchomiony w sesji zespołu 22.11 rano (`portal/README.md`, „Uruchomienie w sesji”); dane pokazowe – dwie instytucje testowe w lokalnej bazie portalu. Etykiety pól po angielsku („Contains AED list”) – lokalna instalacja bez skompilowanych tłumaczeń, tak samo dla pól oryginalnych portalu.
