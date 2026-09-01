# Monitoring — system monitoringu serwerowni

Aplikacja webowa do monitorowania serwerowni: podgląd czujników (temperatura, wilgotność, ruch, pożar, gaz/dym, drzwi, zalanie), wizualizacja szaf rack i pomieszczenia, nagrywanie z kamery przy wykryciu ruchu, historia zdarzeń (logi) i zarządzanie użytkownikami.

## Stack technologiczny

- **Backend:** Python / Flask, Flask-SQLAlchemy (SQLite), Flask-JWT-Extended (autoryzacja), OpenCV (kamera — domyślny backend na Windows/dev; na Raspberry Pi z modułem CSI opcjonalnie `picamera2`, patrz `CAMERA_BACKEND` niżej)
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
├── RealTimeDataContext.jsx  wspólny poller /real-time-data (co 5s) — jedno źródło dla wszystkich stron, żeby nie dublować requestów
├── api.js                API_BASE (adres backendu, z .env)
├── LoginPage.jsx          logowanie
├── RegisterPage.jsx       rejestracja użytkownika (tylko admin)
├── Home.jsx / .css        test urządzenia
├── FloorPlan.jsx          rzut serwerowni (react-konva), strona główna ("/") — czujniki pożaru/gazu/ruchu z regulacją wysokości montażu
├── RackVisual3D.jsx       wizualny podgląd szafy (panel boczny w widoku rack)
├── ServerRack.jsx         widok pojedynczej szafy rack
├── SensorDetail.jsx       szczegóły + historia czujnika temperatury/wilgotności szafy (recharts, progi Non-Critical/Critical, opóźnienie alarmu)
├── RoomSensorDetail.jsx   szczegóły czujnika pomieszczenia (pożar/gaz/drzwi/zalanie) — symulacja i potwierdzanie alarmu
├── VoltageDetail.jsx      strona napięcia zasilania — progi, alarm, przełącznik "czujnik podłączony"
├── Camera.jsx             podgląd kamery (MJPEG) + sterowanie nagrywaniem
├── SavedVideos.jsx        lista zapisanych nagrań
├── Settings.jsx           ustawienia systemowe, SMTP, grupy/reguły powiadomień, kopia zapasowa konfiguracji
├── Logs.jsx / .css        logi systemowe
├── Help.jsx               strona pomocy ("/help")
└── assets/monitor.png     ikona urządzenia w widoku rack
```

Routing (`App.jsx`), jednolicie angielski kebab-case: `/login`, `/register-user`, `/test-device`, `/camera`, `/saved-videos`, `/settings`, `/logs`, `/rack/:rackId`, `/rack/:rackId/sensor/:type`, `/room-sensor/:type`, `/voltage`, `/help`, `/floor-plan` i `/` (oba renderują `FloorPlan`).

## Funkcje

- **Widok rzutu serwerowni** — graficzna wizualizacja pomieszczenia z szafami rack i czujnikami (pożar, gaz, drzwi, ruch, zalanie), strona główna aplikacji. Czujniki przesuwa się przeciąganiem (X i głębokość naraz); pożar/gaz/ruch mają warianty montażu sufit/ściana, zalanie zawsze na podłodze. Prawy klik na czujniku otwiera menu "Konfiguruj"/"Usuń"; prawy klik na szafie otwiera menu "Zmień nazwę"/"Usuń" — usunięcie tylko chowa szafę z rzutu (lista 6 szaf jest stała w kodzie, nic nie kasuje na trwałe), przywracalne przyciskiem "Przywróć usunięte szafy" w pasku.
- **Alarmy (wszystkie typy)** — nigdy nie kasuje się ich ręcznie. Przycisk "Potwierdź alarm" tylko wycisza kolejne powiadomienia (e-mail/SMS/log); sam alarm dezaktywuje się automatycznie dopiero, gdy odczyt faktycznie wróci do normy — wtedy też, opcjonalnie, wychodzi jednorazowe powiadomienie o powrocie.
- **Widok szafy (rack)** — konfigurowalne sloty U z urządzeniami (typ, nazwa, wysokość co 0,5U, adres management + ping), wizualny podgląd szafy z etykietą typu urządzenia na każdym bloczku (od 1U w górę), klikalna nazwa szafy w nagłówku (ta sama nazwa co w menu kontekstowym na rzucie, zmiana w jednym miejscu widoczna wszędzie).
- **Czujnik temperatury/wilgotności na szafę** — jeden czujnik środowiskowy na całą szafę (fizycznie w szafie stoi jedno urządzenie pomiarowe, nie jedno na serwer), dwa niezależne poziomy progu (Non-Critical/Critical), opóźnienie alarmu (debounce), powiadomienie o powrocie do normy, najniższy/najwyższy zanotowany odczyt i historię (wykres, zakres na żywo/24h/tydzień/miesiąc, retencja 35 dni). Na rzucie serwerowni każda szafa ma dwie klikalne ikonki 🌡️/💧 z bieżącym odczytem, prowadzące bezpośrednio do historii tego czujnika; strona samej szafy (`/rack/:rackId`) pokazuje ten sam odczyt i baner alarmu, niezależny od czujnika pomieszczenia. Ponieważ nie ma jeszcze realnego czujnika (tylko mock), globalny przełącznik "Czujnik podłączony" pozwala go wyłączyć, żeby nie generował fałszywych alarmów.
- **Napięcie zasilania** — osobna strona (`/voltage`) z odczytem, progami min/max, alarmem i tym samym przełącznikiem "Czujnik podłączony" (mock, dopóki nie podłączony realny czujnik/ADC).
- **Kamera** — podgląd na żywo (MJPEG stream, OpenCV lub picamera2 na Raspberry Pi), ręczne i automatyczne nagrywanie (przy wykryciu ruchu), transkodowanie do H.264 (ffmpeg) dla kompatybilności z przeglądarką, lista zapisanych nagrań pogrupowana po dniach z możliwością odtworzenia/pobrania/usunięcia.
- **Logi systemowe** — jedna wspólna historia zdarzeń (alarmy, logowania/wylogowania, start systemu) z filtrowaniem po sensorze, sortowaniem, zaznaczaniem i eksportem do CSV.
- **Zarządzanie użytkownikami** — rejestracja (tylko admin), lista kont z uprawnieniami, usuwanie (z ochroną przed samousunięciem).
- **Ustawienia** — czas do zatrzymania nagrywania, konfiguracja SMTP (host/port/login/hasło/nadawca, test wysyłki), grupy i reguły powiadomień, kopia zapasowa konfiguracji (eksport/import JSON).
- **Powiadomienia** — jedna grupa odbiorców na oba kanały naraz (każdy odbiorca może mieć e-mail i/lub numer telefonu), z własnym harmonogramem wysyłki (dzień×godzina, domyślnie rozwinięty w UI); reguły per zdarzenie (pożar/gaz/zalanie/drzwi/próg temp.-wilg. szafy/napięcie) osobno włączają e-mail i SMS, z opcjonalnym własnym tematem e-maila, załącznikiem zdjęcia z kamery i własną treścią SMS. Grupy odróżnione kolorami, tooltips i podpowiedzi w UI tłumaczą zasady działania reguł/harmonogramu. E-mail wysyłany realnie przez SMTP (test i alarmy używają wspólnego szablonu z powitaniem/stopką, żeby rzadziej trafiać do SPAM-u); SMS domyślnie zamockowany (log w konsoli), z gotowym backendem na moduł GSM SIM800L (`SMS_BACKEND=sim800`).

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

SQLite, plik lokalny w `back/instance/monitoring.db` (nieśledzony w gicie — zawiera lokalne dane, w tym hashe haseł). Tabele: `users`, `layouts`, `settings`, `logs`, `device_sensors`, `device_sensor_history`, `device_sensor_settings`, `notification_groups`, `notification_recipients`, `notification_rules`, `alarm_states`, `device_alarm_states`, `voltage_thresholds`, `smtp_settings`.

Uwaga: `db.create_all()` (wywoływane przy starcie) tworzy tylko brakujące tabele, nie dodaje kolumn do istniejących — dodanie pola do modelu na już działającej instalacji (np. produkcyjnej na Raspberry Pi) wymaga ręcznego `ALTER TABLE`, a usunięcie pola (jak przy przejściu na jeden `DeviceSensor` per szafa) wymaga dropu i odtworzenia tabeli. Patrz `docs/raspberry-pi-deployment.md`, sekcje 7j–7n, dla przykładów. Jednorazowe skrypty migracji danych (nie schematu) są w `back/migrations/` (np. `merge_notification_groups.py`).

## Zmienne środowiskowe

Zobacz `back/.env.example` i `front/.env.example`. Pliki `.env` (z prawdziwymi wartościami) nie są śledzone w gicie. Konfiguracja SMTP nie jest już w `.env` — ustawia się ją w UI (Ustawienia → SMTP, zapisywana w tabeli `smtp_settings`); bez niej wysyłka e-mail jest pomijana z logiem `SMTP nieskonfigurowany`.

Każdy czujnik (poza kamerą) ma w `.env` przełącznik `<NAZWA>_BACKEND` (domyślnie `mock` — bez zmian na Windows/dev) i `<NAZWA>_PIN` dla realnego GPIO na Raspberry Pi: `DHT_BACKEND`/`DHT_PIN`, `DOOR_BACKEND`/`DOOR_PIN`, `WATER_BACKEND`/`WATER_PIN`, `MOTION_BACKEND`/`MOTION_PIN`, `GAS_BACKEND`/`GAS_PIN`, `FIRE_BACKEND`/`FIRE_PIN`, `CAMERA_BACKEND` (`opencv`/`picamera2`), `SMS_BACKEND` (`mock`/`sim800` + `SIM800_PORT`/`SIM800_BAUDRATE`). Szczegóły podłączenia realnego sprzętu: `docs/raspberry-pi-deployment.md`.

## Wdrożenie na Raspberry Pi

Pełny, sprawdzony w praktyce przewodnik (gunicorn+nginx, picamera2, podłączenie realnych czujników GPIO/DHT22/SIM800L, typowe błędy i ich rozwiązania) jest w [`docs/raspberry-pi-deployment.md`](docs/raspberry-pi-deployment.md).

## Znane ograniczenia

- Czujniki pomieszczenia (temperatura/wilgotność, drzwi, woda, ruch, gaz, pożar) domyślnie mockowane losowo (Windows/dev); na wdrożonym Raspberry Pi podłączone do realnego GPIO/DHT22 przez `<NAZWA>_BACKEND` w `.env` (patrz wyżej). Napięcie zasilania i temperatura/wilgotność szafy (`DeviceSensor`, jeden czujnik na całą szafę) pozostają czystym mockiem (nie ma tam realnego czujnika) — mają globalny przełącznik "Czujnik podłączony" do wyłączenia fałszywych alarmów, gdyby to przeszkadzało.
- Nazwy tras backendu mieszają konwencje RPC/REST w kilku miejscach (np. historyczne endpointy sprzed refaktoryzacji) — do ujednolicenia przy kolejnej refaktoryzacji API.
- `npm audit` we `front/` zgłasza 8 podatności (wszystkie high), w zależnościach pośrednich:
  - `brace-expansion` przez `eslint`/`minimatch` (tylko devDependency, nie trafia do builda produkcyjnego) — wymaga `npm audit fix --force` (breaking change: eslint 10).
  - `react-router` 7.12.0–8.2.0 (RSC Mode CSRF Bypass) — dotyczy trybu RSC/data-router (loadery, akcje, server components), którego ten projekt nie używa (tylko deklaratywny routing: `BrowserRouter`/`Routes`/`Route`). Najnowsza wydana wersja (7.18.2, aktualnie zainstalowana) wciąż mieści się w podatnym zakresie — patch jeszcze nie wyszedł; `npm audit fix --force` proponuje downgrade do 7.11.0, co przywróciłoby starszą, już załataną lukę (open redirect / SSR deserialize), więc świadomie tego nie robimy.
- Wysyłka SMS domyślnie zamockowana (`back/notifications.py:send_sms` loguje do konsoli); na Raspberry Pi z podłączonym modułem GSM SIM800L działa realnie przez `SMS_BACKEND=sim800` (`back/sim800.py`, komendy AT przez UART).
- Stara tabela `phone_numbers` (zastąpiona grupami SMS) może zostać osierocona w już istniejących bazach `instance/monitoring.db` — dane nie są usuwane automatycznie, tylko kod przestaje ich używać.
