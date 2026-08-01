# Monitoring — kontekst projektu dla Claude

System monitoringu serwerowni: czujniki (temperatura, wilgotność, ruch, pożar, gaz/dym, drzwi, zalanie), wizualizacja szaf rack i rzutu pomieszczenia, kamera z nagrywaniem przy wykryciu ruchu, logi zdarzeń, zarządzanie użytkownikami. Pełny opis funkcji i instrukcja uruchomienia: [README.md](README.md).

## Stack

- **Backend:** Python / Flask, Flask-SQLAlchemy (SQLite), Flask-JWT-Extended, Flask-CORS, OpenCV (kamera)
- **Frontend:** React 18 (Vite 6), Material UI v6, react-router-dom v7 (routing deklaratywny, bez data router API), react-konva (rzut/rack), recharts (wykresy historii czujników), axios, dayjs

## Struktura

```
Monitoring/
├── back/
│   ├── app.py            wszystkie route'y API
│   ├── models.py         modele SQLAlchemy (User, Layout, PhoneNumber, Setting, Log, DeviceSensor, DeviceSensorHistory)
│   ├── sensors.py         logika mockowanych czujników + progi alarmowe
│   ├── camera.py           obsługa kamery (MJPEG stream, nagrywanie)
│   ├── init_db.py         seeduje bazę (Setting + konto admin)
│   └── tests/              pytest, konfiguracja w tests/conftest.py i tests/pytest.ini
└── front/src/
    ├── App.jsx              routing
    ├── Layout.jsx            wspólny layout (pasek górny, drawer menu)
    ├── api.js                 API_BASE z .env
    ├── FloorPlan.jsx           rzut serwerowni (react-konva), strona główna "/"
    ├── ServerRack.jsx          widok szafy rack
    ├── SensorDetail.jsx        historia czujnika per-urządzenie (recharts)
    ├── Camera.jsx, SavedVideos.jsx, Settings.jsx, Logs.jsx, LoginPage.jsx, RegisterPage.jsx, Home.jsx
    └── assets/monitor.png
```

## Konwencje backendu

- Nazwy tabel/klas: snake_case tabele, PascalCase klasy pojedyncze (`User`, nie `Users`; tabela `users`). Kolumny snake_case.
- Trasy API: w większości REST (resource + metoda HTTP, kebab-case dla wieloczłonowych segmentów), ale **kilka starszych endpointów zostało w stylu RPC** (znane, opisane w README jako known issue — nie ujednolicaj bez pytania, to świadomie odłożone).
- Komunikaty dla użytkownika (błędy API, alerty) zawsze po polsku.
- Progi alarmowe temperatury/wilgotności są **per-urządzenie** (`DeviceSensor.min/max_temperature/humidity`), nie globalne — globalne progi w `Setting` zostały usunięte.

## Gotchas SQLAlchemy (ważne, już raz spowodowały utratę danych produkcyjnych)

1. **`db.init_app(app)` cache'uje silnik w momencie wywołania.** Zmiana `app.config['SQLALCHEMY_DATABASE_URI']` już PO imporcie `app`/`models` nic nie da — działa dalej na starym URI. Dlatego w `back/tests/conftest.py` `os.environ['DATABASE_URL']` musi być ustawiony na `sqlite:///:memory:` na samej górze pliku, przed jakimkolwiek innym importem. Naruszenie tej kolejności kiedyś wyzerowało prawdziwą bazę produkcyjną przez pytest.
2. **`db.create_all()` nie dodaje kolumn do istniejących tabel**, tylko tworzy brakujące tabele. Dodanie kolumny do modelu wymaga ręcznego `ALTER TABLE` na istniejącej `instance/monitoring.db` (przynajmniej dopóki nie ma Alembica/migracji).
3. **`db.Time` / `db.DateTime` kolumny wymagają prawdziwych obiektów `datetime.time`/`datetime.datetime`**, nie stringów — przypisanie stringa przechodzi tworzenie obiektu, ale wybucha przy zapisie do SQLite.

## Testy

- `back/tests/`, uruchamianie: `cd back && python -m pytest -v`.
- Baza testowa zawsze `sqlite:///:memory:` (patrz gotcha #1 wyżej) — testy nigdy nie dotykają `instance/monitoring.db`.
- Globalny `sensor` (z `back/app.py`) jest `None` pod pytestem (inicjalizowany tylko w `if __name__ == '__main__'`) — testy endpointów które go używają podstawiają fake'a, np. `app_module.sensor = _FakeSensor()` (patrz `test_settings_endpoint.py`).

## Znane ograniczenia / świadomie odłożone

- Czujniki (poza kamerą) są mockowane losowo — prawdziwy sprzęt (RPi GPIO, DHT22) zakomentowany w `back/sensors.py`, gotowy do podłączenia.
- Kilka endpointów backendu w stylu RPC zamiast REST (patrz wyżej) — do ujednolicenia przy kolejnej refaktoryzacji API, nie teraz.
- `npm audit` we `front/` pokazuje kilka podatności w zależnościach pośrednich (`eslint`/`minimatch`/`brace-expansion` — tylko dev, nie trafia do builda; `react-router` RSC-mode CVE — nieaplikowalne, projekt nie używa RSC/data routera). Szczegóły w README. Nie "naprawiać" na siłę przez `npm audit fix --force` — proponowane fixy to breaking changes albo downgrade'y przywracające starsze, już załatane luki.
- Bundle JS frontendu >1.3 MB po minifikacji (vite ostrzega o chunk size) — code-splitting nie zrobiony, świadomie, projekt mały.

## Jak ten użytkownik chce pracować (ważne, przeczytaj przed działaniem)

- **Nigdy nie uruchamiaj poleceń `git`/`gh` w tym projekcie.** Użytkownik commituje/pushuje sam. Jeśli coś wymaga akcji git, opisz co ma zrobić — nie proponuj że to zrobisz, nie pytaj o zgodę na to.
- **Pytaj o zgodę przed KAŻDYM pojedynczym wywołaniem Bash**, nawet rutynowym/read-only (np. `npm audit`, `ls`, syntax-check) — nie łącz kilku komend bez potwierdzenia w międzyczasie.
- Przed jakąkolwiek zmianą wizualną/UX frontendu — brainstorming z użytkownikiem (pytania jedna na raz), nie zgadywanie designu.
- Przed każdym bugiem — najpierw root cause (systematic debugging), dopiero potem fix. W tym projekcie symptomatyczne łatanie już raz doprowadziło do poważnych, ukrytych błędów (patrz gotchas wyżej).
- Przy większych porządkach/batch-fixach: użytkownik często prosi o działanie bezpośrednie, bez zbędnej ceremonii planistycznej (markdown plany) — chyba że sam o plan poprosi.
- Odpowiadaj po polsku, komunikaty w UI/kodzie też po polsku.
