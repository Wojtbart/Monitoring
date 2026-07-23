# Klikalne czujniki na wizualnym widoku szafy + strona szczegółów z historią

## Kontekst

Sub-project 1 ([2026-07-21-per-device-sensors-backend-design.md](2026-07-21-per-device-sensors-backend-design.md)) dodał backendowy model `DeviceSensor` i endpoint `GET /deviceSensors/<rack_id>/<unit>` zwracający bieżącą temperaturę/wilgotność dla konkretnego slotu w szafie.

Ten dokument (sub-project 2) opisuje:
1. Rozszerzenie backendu o historię odczytów (do wykresu trendu).
2. Rozszerzenie istniejącego `RackVisual` (prosty kolorowy pasek + numer U, [ServerRack.jsx](../../../front/src/ServerRack.jsx)) o klikalne ikony czujników temp/wilg na każdym niepustym slocie.
3. Nową stronę szczegółów pojedynczego czujnika (wartość, status wobec progów, wykres historii).

Poza zakresem: fire/gas/water/motion/door pozostają globalne i bez zmian; brak edycji progów per-urządzenie (nadal globalne `Settings`).

## Backend: historia odczytów

Nowa tabela w `back/models.py`:

```python
class DeviceSensorHistory(db.Model):
    __tablename__ = 'device_sensor_history'
    id = db.Column(db.Integer, primary_key=True)
    rack_id = db.Column(db.String(20), nullable=False)
    unit = db.Column(db.Integer, nullable=False)
    temperature = db.Column(db.Float, nullable=False)
    humidity = db.Column(db.Float, nullable=False)
    recorded_at = db.Column(db.DateTime, nullable=False)
```

`DeviceSensor.get_or_create_reading(rack_id, unit)` (istniejąca metoda z sub-project 1) po obliczeniu nowej wartości temperatury/wilgotności dodatkowo:
- wstawia wiersz do `DeviceSensorHistory` z tą samą wartością i `recorded_at=datetime.now()`,
- jeśli liczba wierszy dla danego `(rack_id, unit)` przekracza 50, usuwa najstarsze nadwyżkowe wiersze (zapytanie: pobierz wszystkie posortowane po `recorded_at` malejąco, usuń te poza pierwszymi 50).

Nowy endpoint:

```
GET /deviceSensors/<rack_id>/<int:unit>/history
```
- Publiczny (bez JWT).
- Zwraca `{"history": [{"temperature": float, "humidity": float, "recorded_at": "YYYY-MM-DD HH:MM:SS"}, ...]}`, posortowane rosnąco po czasie (najstarsze pierwsze — gotowe do wykresu).
- Jeśli brak historii dla danego slotu (nikt jeszcze nie odpytał `/deviceSensors/<rack_id>/<unit>`), zwraca `{"history": []}`.

## Frontend: ikony na wizualnym widoku szafy

W `RackVisual` (`front/src/ServerRack.jsx`), dla każdego niepustego slotu (`slot.type !== "empty"`), obok istniejącego numeru U dodajemy dwie małe klikalne ikony:
- 🌡️ → nawiguje do `/rack/<rackId>/unit/<unit>/sensor/temperature`
- 💧 → nawiguje do `/rack/<rackId>/unit/<unit>/sensor/humidity`

Ikony nie pokazują żywej wartości na liście (brak dodatkowego pollingu na stronie listy) — są czystym punktem wejścia do strony szczegółów. Puste sloty nie mają ikon (nie ma urządzenia, nie ma czujnika).

## Frontend: strona szczegółów czujnika

Nowy komponent `front/src/SensorDetail.jsx`, nowa trasa w `front/src/App.jsx`:

```
/rack/:rackId/unit/:unit/sensor/:type
```
gdzie `type` to `temperature` lub `humidity`.

Zawartość strony:
- Nagłówek: `Szafa <N> — Unit <U> — <Temperatura|Wilgotność>`, przycisk powrotu do `/rack/:rackId`.
- Duża aktualna wartość (odświeżana co 5s, jak inne strony w apce), pobierana z `GET /deviceSensors/<rackId>/<unit>`.
- Status OK/WARN wobec progów z `GET /settings` (`min_temperature`/`max_temperature` dla typu `temperature`, `min_humidity`/`max_humidity` dla `humidity`) — ten sam wzorzec kolorowania co istniejący `STATUS_CONFIG` w ServerRack.jsx.
- Wykres trendu (`recharts` `LineChart`) z danych `GET /deviceSensors/<rackId>/<unit>/history` — jedna linia (wybrany typ), oś X = `recorded_at`, oś Y = wartość. Wykres odświeża się przy każdym pollu (razem z aktualną wartością).

Zależność: `recharts` dodane do `front/package.json` (`npm install recharts`).

## Poza zakresem tego dokumentu

- Edycja progów alarmowych per-urządzenie.
- Eksport historii / trwałe przechowywanie dłużej niż 50 ostatnich odczytów.
- Wspólny wykres temp+wilgotność na jednej stronie (strona pokazuje jeden typ na raz, zgodnie z parametrem `:type` w URL).
