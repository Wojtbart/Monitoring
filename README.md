# Monitoring — system monitoringu serwerowni

Aplikacja webowa do monitorowania serwerowni: podgląd czujników (temperatura, wilgotność, ruch, pożar, gaz/dym, drzwi, zalanie), wizualizacja szaf rack i pomieszczenia, nagrywanie z kamery przy wykryciu ruchu, historia zdarzeń (logi) i zarządzanie użytkownikami.

## Stack technologiczny

- **Backend:** Python / Flask, Flask-SQLAlchemy (SQLite), Flask-JWT-Extended (autoryzacja), OpenCV (kamera)
- **Frontend:** React (Vite), Material UI, react-konva (wizualizacja rzutu serwerowni), recharts (wykresy)

## Struktura repo

```
Monitoring/
├── back/       backend Flask (API, baza danych, obsługa kamery i czujników)
└── front/      frontend React (interfejs użytkownika)
```

### Struktura frontendu

```
front/src/
├── main.jsx            punkt wejścia (ReactDOM.render)
├── App.jsx              routing (react-router-dom)
├── Layout.jsx / .css     wspólny layout (pasek górny, menu boczne, wylogowanie)
├── api.js                API_BASE (adres backendu, z .env)
├── LoginPage.jsx          logowanie
├── RegisterPage.jsx       rejestracja użytkownika (tylko admin)
├── Home.jsx / .css        test urządzenia
├── FloorPlan.jsx          rzut serwerowni (react-konva), strona główna ("/")
├── ServerRack.jsx         widok pojedynczej szafy rack
├── SensorDetail.jsx       szczegóły + historia czujnika per-urządzenie (recharts)
├── Camera.jsx             podgląd kamery (MJPEG) + sterowanie nagrywaniem
├── SavedVideos.jsx        lista zapisanych nagrań
├── Settings.jsx           ustawienia systemowe
├── Logs.jsx / .css        logi systemowe
└── assets/monitor.png     ikona urządzenia w widoku rack
```

Routing (`App.jsx`): `/loginPage`, `/registerUser`, `/testDevice`, `/camera`, `/savedVideos`, `/settings`, `/logs`, `/rack/:rackId`, `/rack/:rackId/unit/:unit/sensor/:type`, `/rzut` i `/` (oba renderują `FloorPlan`).

## Funkcje

- **Widok rzutu serwerowni** — graficzna wizualizacja pomieszczenia z szafami rack i czujnikami (pożar, gaz, drzwi, ruch, zalanie), strona główna aplikacji.
- **Widok szafy (rack)** — konfigurowalne sloty U z urządzeniami, wizualny podgląd szafy.
- **Czujniki per-urządzenie** — każdy serwer w szafie ma własny odczyt temperatury/wilgotności, własne progi alarmowe (edytowalne) i historię odczytów (wykres trendu z ostatnich 10 minut).
- **Kamera** — podgląd na żywo (MJPEG stream), ręczne i automatyczne nagrywanie (przy wykryciu ruchu), lista zapisanych nagrań pogrupowana po dniach z możliwością usuwania.
- **Logi systemowe** — historia zdarzeń i alarmów z filtrowaniem po sensorze i sortowaniem.
- **Zarządzanie użytkownikami** — rejestracja (tylko admin), lista kont z uprawnieniami, usuwanie (z ochroną przed samousunięciem).
- **Ustawienia** — czas nagrywania, godziny testów systemowych, numery telefonów do powiadomień, podgląd czujników globalnych pomieszczenia.

## Uruchomienie

### Backend

```bash
cd back
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
copy .env.example .env       # i uzupełnij wartości
python init_db.py            # tworzy bazę + konto admin (login: admin, hasło: admin123 — zmień po pierwszym logowaniu!)
python app.py                # start na porcie 5000
```

### Frontend

```bash
cd front
npm install
npm run dev                  # start na porcie 5173
```

### Testy backendu

```bash
cd back
python -m pytest -v
```

Testy znajdują się w `back/tests/` (konfiguracja w `back/tests/pytest.ini`).

## Baza danych

SQLite, plik lokalny w `back/instance/monitoring.db` (nieśledzony w gicie — zawiera lokalne dane, w tym hashe haseł). Tabele: `users`, `layouts`, `phone_numbers`, `settings`, `logs`, `device_sensors`, `device_sensor_history`.

## Zmienne środowiskowe

Zobacz `back/.env.example` i `front/.env.example`. Pliki `.env` (z prawdziwymi wartościami) nie są śledzone w gicie.

## Znane ograniczenia

- Czujniki (poza kamerą) są aktualnie mockowane losowo — obsługa prawdziwego sprzętu (RPi GPIO, DHT22) jest zakomentowana w `back/sensors.py`, gotowa do podłączenia.
- Nazwy tras backendu mieszają konwencje RPC/REST w kilku miejscach (np. historyczne endpointy sprzed refaktoryzacji) — do ujednolicenia przy kolejnej refaktoryzacji API.
- `npm audit` we `front/` zgłasza 8 podatności (2 moderate, 6 high), wszystkie w zależnościach pośrednich:
  - `react-router`/`react-router-dom` (moderate) — open redirect i podatność deserializacji błędów SSR; projekt nie używa SSR. Fix istnieje dopiero w wersji 7.x (aktualny 6.30.4 to najnowszy patch gałęzi 6) — wymaga `npm audit fix --force` i migracji API v6→v7, breaking change.
  - `brace-expansion` przez `eslint`/`minimatch` (high, tylko devDependency, nie trafia do builda produkcyjnego) — wymaga `npm audit fix --force` (breaking change: eslint 10).
