# Monitoring — system monitoringu serwerowni

Aplikacja webowa do monitorowania serwerowni: podgląd czujników (temperatura, wilgotność, ruch, pożar, gaz/dym, drzwi, zalanie), wizualizacja szaf rack i pomieszczenia, nagrywanie z kamery przy wykryciu ruchu, historia zdarzeń (logi) i zarządzanie użytkownikami.

## Stack technologiczny

- **Backend:** Python / Flask, Flask-SQLAlchemy (SQLite), Flask-JWT-Extended (autoryzacja), OpenCV (kamera)
- **Frontend:** React (Vite), Material UI, react-router-dom v7 (routing), react-konva (wizualizacja rzutu serwerowni), recharts (wykresy)

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
├── FloorPlan.jsx          rzut serwerowni (react-konva), strona główna ("/") — czujniki pożaru/gazu/ruchu z regulacją wysokości montażu
├── RackVisual3D.jsx       wizualny podgląd szafy (panel boczny w widoku rack)
├── ServerRack.jsx         widok pojedynczej szafy rack
├── SensorDetail.jsx       szczegóły + historia czujnika per-urządzenie w szafie (recharts, progi Non-Critical/Critical, opóźnienie alarmu)
├── RoomSensorDetail.jsx   szczegóły czujnika pomieszczenia (pożar/gaz/drzwi/zalanie) — symulacja i kasowanie alarmu
├── VoltageDetail.jsx      strona napięcia zasilania — progi, alarm, przełącznik "czujnik podłączony"
├── Camera.jsx             podgląd kamery (MJPEG) + sterowanie nagrywaniem
├── SavedVideos.jsx        lista zapisanych nagrań
├── Settings.jsx           ustawienia systemowe, SMTP, grupy/reguły powiadomień, kopia zapasowa konfiguracji
├── Logs.jsx / .css        logi systemowe
├── Help.jsx               strona pomocy ("/pomoc")
└── assets/monitor.png     ikona urządzenia w widoku rack
```

Routing (`App.jsx`): `/loginPage`, `/registerUser`, `/testDevice`, `/camera`, `/savedVideos`, `/settings`, `/logs`, `/rack/:rackId`, `/rack/:rackId/unit/:unit/sensor/:type`, `/room-sensor/:type`, `/napiecie`, `/pomoc`, `/rzut` i `/` (oba renderują `FloorPlan`).

## Funkcje

- **Widok rzutu serwerowni** — graficzna wizualizacja pomieszczenia z szafami rack i czujnikami (pożar, gaz, drzwi, ruch, zalanie), strona główna aplikacji. Czujniki pożaru/gazu/ruchu można kliknięciem zaznaczyć i regulować wysokość montażu strzałkami ▲/▼, niezależnie od przesuwania w poziomie; czujnik zalania stoi zawsze na podłodze.
- **Widok szafy (rack)** — konfigurowalne sloty U z urządzeniami, wizualny podgląd szafy, ping adresu management.
- **Czujniki per-urządzenie** — każdy serwer w szafie ma własny odczyt temperatury/wilgotności, dwa niezależne poziomy progu (Non-Critical/Critical), opóźnienie alarmu (debounce), powiadomienie o powrocie do normy, najniższy/najwyższy zanotowany odczyt i historię (wykres, zakres na żywo/24h/tydzień/miesiąc, retencja 35 dni). Ponieważ nie ma realnego czujnika per-slot (tylko mock), globalny przełącznik "Czujnik podłączony" pozwala go wyłączyć, żeby nie generował fałszywych alarmów.
- **Napięcie zasilania** — osobna strona (`/napiecie`) z odczytem, progami min/max, alarmem i tym samym przełącznikiem "Czujnik podłączony" (mock, dopóki nie podłączony realny czujnik/ADC).
- **Kamera** — podgląd na żywo (MJPEG stream, OpenCV lub picamera2 na Raspberry Pi), ręczne i automatyczne nagrywanie (przy wykryciu ruchu), transkodowanie do H.264 (ffmpeg) dla kompatybilności z przeglądarką, lista zapisanych nagrań pogrupowana po dniach z możliwością odtworzenia/pobrania/usunięcia.
- **Logi systemowe** — jedna wspólna historia zdarzeń (alarmy, logowania/wylogowania, start systemu) z filtrowaniem po sensorze, sortowaniem, zaznaczaniem i eksportem do CSV.
- **Zarządzanie użytkownikami** — rejestracja (tylko admin), lista kont z uprawnieniami, usuwanie (z ochroną przed samousunięciem).
- **Ustawienia** — czas do zatrzymania nagrywania, konfiguracja SMTP (host/port/login/hasło/nadawca, test wysyłki), grupy i reguły powiadomień, kopia zapasowa konfiguracji (eksport/import JSON).
- **Powiadomienia** — grupy odbiorców mailowych i SMS z własnym harmonogramem wysyłki (dzień×godzina), reguły per zdarzenie (pożar/gaz/zalanie/drzwi/próg temp.-wilg. szafy/napięcie) z opcjonalnym własnym tematem e-maila, załącznikiem zdjęcia z kamery i własną treścią SMS. E-mail wysyłany realnie przez SMTP; SMS domyślnie zamockowany (log w konsoli), z gotowym backendem na moduł GSM SIM800L (`SMS_BACKEND=sim800`).

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

SQLite, plik lokalny w `back/instance/monitoring.db` (nieśledzony w gicie — zawiera lokalne dane, w tym hashe haseł). Tabele: `users`, `layouts`, `settings`, `logs`, `device_sensors`, `device_sensor_history`, `device_sensor_settings`, `email_groups`, `email_recipients`, `sms_groups`, `sms_recipients`, `notification_rules`, `alarm_states`, `device_alarm_states`, `voltage_thresholds`, `smtp_settings`.

Uwaga: `db.create_all()` (wywoływane przy starcie) tworzy tylko brakujące tabele, nie dodaje kolumn do istniejących — dodanie pola do modelu na już działającej instalacji (np. produkcyjnej na Raspberry Pi) wymaga ręcznego `ALTER TABLE`. Patrz `docs/raspberry-pi-deployment.md`, sekcja 7j, dla przykładu.

## Zmienne środowiskowe

Zobacz `back/.env.example` i `front/.env.example`. Pliki `.env` (z prawdziwymi wartościami) nie są śledzone w gicie. Konfiguracja SMTP nie jest już w `.env` — ustawia się ją w UI (Ustawienia → SMTP, zapisywana w tabeli `smtp_settings`); bez niej wysyłka e-mail jest pomijana z logiem `SMTP nieskonfigurowany`.

Każdy czujnik (poza kamerą) ma w `.env` przełącznik `<NAZWA>_BACKEND` (domyślnie `mock` — bez zmian na Windows/dev) i `<NAZWA>_PIN` dla realnego GPIO na Raspberry Pi: `DHT_BACKEND`/`DHT_PIN`, `DOOR_BACKEND`/`DOOR_PIN`, `WATER_BACKEND`/`WATER_PIN`, `MOTION_BACKEND`/`MOTION_PIN`, `GAS_BACKEND`/`GAS_PIN`, `FIRE_BACKEND`/`FIRE_PIN`, `CAMERA_BACKEND` (`opencv`/`picamera2`), `SMS_BACKEND` (`mock`/`sim800` + `SIM800_PORT`/`SIM800_BAUDRATE`). Szczegóły podłączenia realnego sprzętu: `docs/raspberry-pi-deployment.md`.

## Wdrożenie na Raspberry Pi

Pełny, sprawdzony w praktyce przewodnik (gunicorn+nginx, picamera2, podłączenie realnych czujników GPIO/DHT22/SIM800L, typowe błędy i ich rozwiązania) jest w [`docs/raspberry-pi-deployment.md`](docs/raspberry-pi-deployment.md).

## Znane ograniczenia

- Czujniki pomieszczenia (temperatura/wilgotność, drzwi, woda, ruch, gaz, pożar) domyślnie mockowane losowo (Windows/dev); na wdrożonym Raspberry Pi podłączone do realnego GPIO/DHT22 przez `<NAZWA>_BACKEND` w `.env` (patrz wyżej). Napięcie zasilania i temperatura/wilgotność per-slot w szafie (`DeviceSensor`) pozostają czystym mockiem (nie ma tam realnego czujnika) — mają globalny przełącznik "Czujnik podłączony" do wyłączenia fałszywych alarmów, gdyby to przeszkadzało.
- Nazwy tras backendu mieszają konwencje RPC/REST w kilku miejscach (np. historyczne endpointy sprzed refaktoryzacji) — do ujednolicenia przy kolejnej refaktoryzacji API.
- `npm audit` we `front/` zgłasza 8 podatności (wszystkie high), w zależnościach pośrednich:
  - `brace-expansion` przez `eslint`/`minimatch` (tylko devDependency, nie trafia do builda produkcyjnego) — wymaga `npm audit fix --force` (breaking change: eslint 10).
  - `react-router` 7.12.0–8.2.0 (RSC Mode CSRF Bypass) — dotyczy trybu RSC/data-router (loadery, akcje, server components), którego ten projekt nie używa (tylko deklaratywny routing: `BrowserRouter`/`Routes`/`Route`). Najnowsza wydana wersja (7.18.2, aktualnie zainstalowana) wciąż mieści się w podatnym zakresie — patch jeszcze nie wyszedł; `npm audit fix --force` proponuje downgrade do 7.11.0, co przywróciłoby starszą, już załataną lukę (open redirect / SSR deserialize), więc świadomie tego nie robimy.
- Wysyłka SMS domyślnie zamockowana (`back/notifications.py:send_sms` loguje do konsoli); na Raspberry Pi z podłączonym modułem GSM SIM800L działa realnie przez `SMS_BACKEND=sim800` (`back/sim800.py`, komendy AT przez UART).
- Stara tabela `phone_numbers` (zastąpiona grupami SMS) może zostać osierocona w już istniejących bazach `instance/monitoring.db` — dane nie są usuwane automatycznie, tylko kod przestaje ich używać.
