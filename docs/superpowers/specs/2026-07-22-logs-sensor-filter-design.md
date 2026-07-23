# Filtr logów po nazwie sensora

## Kontekst

`/logs` ([Logs.jsx](../../../front/src/Logs.jsx)) pokazuje tabelę logów (data, nazwa sensora, typ, opis) z sortowaniem (najnowsze/najstarsze/tylko ostrzeżenia/tylko raporty) i paginacją. Logi są globalne dla całej serwerowni — pole `sensor_name` (`back/models.py` `Logs`) przyjmuje wartości typu "Czujnik temperatury", "Czujnik pożaru", "Czujnik wilgotności", "Czujnik gazu", "Czujnik wody", "Czujnik drzwi", "System". Backend bez zmian — to czysto frontendowy filtr po już dostępnych danych.

## Zmiana

W `Logs.jsx`:
- Nowy stan `sensorFilter` (domyślnie `"all"`).
- Lista unikalnych wartości `sensor_name` wyliczana z `logs` (`useMemo`, posortowana alfabetycznie).
- Nowy `<Select>` "Sensor" obok istniejącego dropdownu "Sortowanie", z opcją "Wszystkie" + jedną opcją na każdą unikalną wartość.
- `sortedLogs` (obecna logika sortowania/filtrowania wg `sortType`) dodatkowo filtruje po `sensorFilter` przed sortowaniem, jeśli `sensorFilter !== "all"`.
- Zmiana filtra resetuje `page` do 1 (tak jak dziś robi zmiana sortowania).

## Poza zakresem

- Jakiekolwiek zmiany backendu/modelu danych.
- Filtrowanie po konkretnym serwerze/urządzeniu w szafie (logi nie mają takiej informacji — potwierdzone z użytkownikiem, że to nie jest częścią tej zmiany).
