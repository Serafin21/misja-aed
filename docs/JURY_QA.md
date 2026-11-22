# Pytania jury – odpowiedzi do 30 sekund (v0)

> Przed finałem zweryfikować z `docs/HANDOFF_A.md` (P10). Odpowiedzi oznaczone [A] zależą od backendu.

**1. Czym różnicie się od istniejących map AED?**
Nie budujemy kolejnej mapy, tylko zbiór danych w dane.gov.pl, z którego może korzystać każda mapa, aplikacja i dyspozytor. Do tego wzorcowy zakres danych, żeby wszyscy dysponenci udostępniali dane tak samo, i akcja, która ich do tego zachęca. Nasza aplikacja pokazuje, co da się z tymi danymi zrobić.

**2. Skąd weźmiecie dane, skoro nie ma rejestru?**
Z trzech dróg naraz: pliki dysponentów (urzędy, szkoły, uczelnie, PSP i OSP) przez kreator importu, dane OpenStreetMap jako osobna warstwa na licencji ODbL oraz zbiory już opublikowane w dane.gov.pl. Do tego zgłoszenia obywateli, które przechodzą moderację.

**3. Jak zapewniacie aktualność?**
Każdy rekord ma datę i metodę weryfikacji. Paszport AED – kod QR na szafce – pozwala każdemu potwierdzić, że urządzenie jest na miejscu, a dysponent aktualizuje dane, wgrywając plik ponownie. [A] Zbiór pokazuje odsetek rekordów zweryfikowanych w ostatnich 12 miesiącach.

**4. Co jeśli szafka jest zamknięta?**
To jest pole w zakresie danych: „szafka zamknięta” i „instrukcja dostępu”, np. „kod u pracownika wypożyczalni”. Pokazujemy to na samej górze karty AED i w liście najbliższych.

**5. Jak działa „dostępne teraz”?**
Godziny zapisujemy w składni opening_hours z OpenStreetMap, np. `Mo-Fr 08:00-16:00`. Serwer sprawdza je według czasu polskiego. Zapis, którego nie rozumiemy, daje komunikat „Sprawdź godziny na miejscu”, a nie fałszywe „tak”.

**6. Dlaczego dane OSM osobno?**
Licencja ODbL wymaga uznania autorstwa i tej samej licencji dla baz pochodnych. Żeby nie „zarazić” nią danych dysponentów na CC0, publikujemy OSM jako osobny zasób, a na mapie pokazujemy go z atrybucją i przerywaną obwódką pinezki.

**7. Co z duplikatami między źródłami?**
Nie łączymy rekordów różnych dostawców – za każdy wiersz odpowiada jego dostawca i tylko on może go poprawić. Gdy dwa AED różnych dostawców są bliżej niż 25 m, wykaz zbiorczy oznacza je jako „możliwy duplikat”, oba zostają widoczne, a dostawcy dostają sygnał, żeby to wyjaśnić u siebie.

**8. Jak to trafia do dane.gov.pl?**
Każdy dostawca publikuje swój wykaz AED na własnym koncie w dane.gov.pl – w panelu albo plikiem XML harvestera; nasza aplikacja przygotowuje mu gotowe pliki (CSV wg Standardu technicznego, XML, słownik). Portal co noc łączy wykazy we „Wykaz AED – wykaz zbiorczy”.

**9. Czy to spełnia WCAG?**
Celujemy w WCAG 2.2 AA. Lista ma te same informacje co mapa, stan nie zależy od koloru, wszystko działa z klawiatury, cele dotykowe mają co najmniej 44 px, układ działa od 320 px. Wyniki testów są w `docs/a11y/raport.md`.

**10. Czy dysponent bez wiedzy technicznej sobie poradzi?**
Tak – wgrywa swój plik w swoim formacie. Kolumny dopasowujemy automatycznie, zapisy typu „TAK/NIE” czy „pn-pt 8-16” poprawiamy sami, a raport mówi prostym językiem, w którym wierszu i polu jest problem i co proponujemy.

**11. Dlaczego „AED w danych” i takie logo?**
Logo to serce złożone z kwadratów jak komórki tabeli – każdy wiersz danych to jedno AED. Jedna bursztynowa komórka to „Twoje AED”. Hasło „Dane prosto z serca” łączy dwa sensy: AED ratuje serce, a dysponent dzieli się danymi bez wahania, bo jeden wiersz może uratować życie. Znacznik na mapie należy do tej samej rodziny.

**12. Jakie dane osobowe zbieracie?**
Żadnych od obywateli – formularze zgłoszenia i potwierdzenia mają tylko punkt na mapie i opis, z podpowiedzią, by nie wpisywać nazwisk ani telefonów. Kontakt dysponenta to kontakt instytucji.

**13. Jak to wdrożyć w ministerstwie?**
Zakres danych i szablony mogą trafić do bazy wiedzy dane.gov.pl od razu. Agregator i API to standardowy kontener Docker. Akcję prowadzi się materiałami z księgi znaku: odznaka dla dysponentów i naklejka z kodem QR.

**14. Jakie są ograniczenia?**
Kompletność zależy od dysponentów; prototyp działa na danych przykładowych; nie geokodujemy adresów; „dostępne teraz” rozumie podzbiór zapisu godzin; XSD importu do potwierdzenia z portalem.

**15. Jak używaliście AI?**
Zgodnie z regulaminem opisujemy to w `docs/AI_USAGE.md`. Asystenci AI pomagali pisać kod i teksty, a decyzje – zakres danych, nazwa, hasło, logo i architektura – podjął i sprawdził zespół.

**16. Jak działa „Wykaz AED” i dlaczego wzorem DGA?**
Portal dane.gov.pl już dziś robi to samo dla wykazu chronionych danych (DGA): instytucja zaznacza przy zasobie, że to wykaz, portal sprawdza plik i co noc łączy wszystkie wykazy w jeden plik Ministerstwa Cyfryzacji. Dodaliśmy do kodu portalu ten sam mechanizm dla AED: znacznik „Zasób zawiera wykaz AED”, sprawdzenie z wzorcem (44 pola), nocny „Wykaz AED – wykaz zbiorczy” w CSV i XLSX z dostawcą i linkiem do źródła przy każdym wierszu oraz adres API `/aed-aggregated`. Wzór DGA, bo jest sprawdzony, zespół portalu go zna i nie trzeba budować niczego od zera – szczegóły i tabela „DGA → AED” w `portal/README.md`.
