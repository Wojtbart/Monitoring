# Backend: czujniki temperatury/wilgotności per-urządzenie

## Kontekst

Obecnie `Sensor` (back/sensors.py) trzyma jeden globalny zestaw odczytów (temperatura, wilgotność, ogień, gaz, woda, ruch, drzwi) dla całej serwerowni, wystawiany przez `GET /realTimeData`. Front (ServerRack.jsx) wyświetla te same globalne wartości w każdym wierszu tabeli slotów.

Cel: docelowo widok szafy ma pokazywać wizualny rysunek szafy (w stylu FloorPlan.jsx) z klikalnymi ikonami czujników, które prowadzą do strony ze szczegółami czujnika **konkretnego serwera** (bo w jednej szafie może być wiele serwerów, każdy z inną temperaturą/wilgotnością). To wymaga danych per-urządzenie w backendzie — ten dokument opisuje tylko tę część (sub-project 1 z większego planu). Widok graficzny szafy i strona szczegółów czujnika to osobne sub-projekty, planowane później.

Czujniki fire/gas/water/motion/door zostają globalne (fizycznie dotyczą pomieszczenia, nie pojedynczego urządzenia) — bez zmian w `/realTimeData`.

## Model danych

Nowa tabela w `back/models.py`:

```python
class DeviceSensor(db.Model):
    __tablename__ = 'device_sensors'
    id = db.Column(db.Integer, primary_key=True)
    rack_id = db.Column(db.String(20), nullable=False)
    unit = db.Column(db.Integer, nullable=False)
    temperature = db.Column(db.Float, nullable=False)
    humidity = db.Column(db.Float, nullable=False)
    updated_at = db.Column(db.DateTime, nullable=False)

    __table_args__ = (db.UniqueConstraint('rack_id', 'unit', name='uq_device_sensor_rack_unit'),)
```

Jeden wiersz na slot (rack_id + unit). `rack_id` odpowiada wartości z URL frontendu (np. `"A0"`), `unit` to numer U w tabelce slotów.

## Generowanie odczytów (mock)

Backend nie zna z góry, które sloty istnieją — ta informacja żyje wyłącznie w JSON-ie `Layout` po stronie frontu. Zamiast osobnego wątku synchronizującego stan slotów, dane generowane są leniwie przy odczycie:

- Pierwsze zapytanie o dany `(rack_id, unit)` → tworzy rekord z losową wartością startową w normalnym zakresie (temperatura 20–32°C, wilgotność 35–75%, tak jak mock w `_read_sensors`).
- Kolejne zapytania → mały "random walk" względem poprzedniej wartości (np. ±1.5°C, ±3% wilgotności), z twardym clampem do sensownego zakresu (np. 10–45°C, 10–95%), żeby wartości nie uciekały w nieskończoność. Symuluje to realistyczne, powoli zmieniające się odczyty zamiast czystego szumu.
- Każde zapytanie aktualizuje `updated_at`.

To celowo prosta symulacja (YAGNI) — wystarcza do pokazania działającego UI; podpięcie prawdziwego hardware per-urządzenie to oddzielna, przyszła zmiana (komentarz w kodzie jak istniejący wzorzec w `_read_sensors`).

## Endpoint API

```
GET /deviceSensors/<rack_id>/<int:unit>
```

- Publiczny, bez JWT (spójnie z `/realTimeData`).
- Zwraca: `{"temperature": float, "humidity": float, "updated_at": "YYYY-MM-DD HH:MM:SS"}`.
- Przy pierwszym wywołaniu dla danej pary tworzy rekord (patrz wyżej), przy kolejnych aktualizuje i zwraca.

Walidacja: `unit` musi być dodatnią liczbą całkowitą (wymuszone przez konwerter trasy `<int:unit>`); `rack_id` — dowolny niepusty string, bez dodatkowej walidacji (frontend kontroluje format `A0`, `A1`, itd.).

## Progi alarmowe

Bez nowej tabeli ustawień per-urządzenie. Frontend porównuje odczyt z istniejącymi globalnymi `Settings.min_temperature/max_temperature/min_humidity/max_humidity` (już pobieranymi przez `/settings`), tak jak dziś robi to dla czujnika globalnego.

## Logi

Bez zmian w `Logs` / `_log`. Przekroczenia progów per-urządzenie nie są na razie logowane do tabeli `Logs` — to celowe cięcie zakresu; można dodać później, gdyby była potrzeba audytu per-urządzenie.

## Poza zakresem tego dokumentu (przyszłe sub-projekty)

- Wizualny rysunek szafy w stylu FloorPlan.jsx (canvas/SVG) z LED-ami i klikalnymi ikonami czujników.
- Strona szczegółów czujnika per-serwer (np. trasa `/rack/:rackId/unit/:unit/sensor/:type`).
- Podłączenie kliknięć na rysunku do nawigacji.
