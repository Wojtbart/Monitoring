# Deployment na Raspberry Pi (Faza A) — spec

**Data:** 2026-08-29
**Zakres:** przeniesienie istniejącego systemu (backend Flask + frontend React) na Raspberry Pi 4 (Debian 12 Bookworm, aarch64), dostęp tylko z sieci lokalnej. Kamera podłączona do Pi to dedykowany moduł CSI (sensor ov5647, Raspberry Pi Camera Module v1), obsługiwany przez `picamera2`/libcamera — nie przez zwykły `cv2.VideoCapture` jak na Windows.

**Poza zakresem tej fazy:** podłączenie realnych czujników GPIO/DHT22 (fire/gas/door/water/motion/temperatura/wilgotność) — to osobna faza B, robiona po zakończeniu deploymentu, z własnym brainstormingiem (mapowanie pinów, typy modułów czujników).

## Kontekst

Kod trafia na Pi ręcznym kopiowaniem (USB/scp/VS Code Remote), nie przez `git clone`. Baza danych startuje od zera na Pi (`init_db.py`), bez przenoszenia dzisiejszej `instance/monitoring.db`.

Nie mam dostępu do terminala Pi — każdy krok wymagający uruchomienia czegoś na Pi wykonuje użytkownik i wkleja wynik z powrotem, iteracyjnie (analogicznie do sprawdzenia modelu kamery przez `rpicam-hello` w tej rozmowie).

## Architektura

- **nginx** serwuje zbudowany frontend (`front/dist` po `npm run build`) jako pliki statyczne na porcie 80. Frontend woła backend bezpośrednio pod jego adresem z `.env` (`VITE_API_BASE=http://<ip-pi>:5000`) — bez reverse-proxy do backendu, żeby nie dublować konfiguracji CORS/proxy.
- **gunicorn** uruchamia backend Flask (WSGI) zamiast wbudowanego dev-servera — dev server nie ma auto-restartu przy crashu i ostrzega przed użyciem produkcyjnym.
- Oba jako usługi **systemd** (`monitoring-backend.service` dla gunicorna; nginx już jest usługą systemową) — wstają automatycznie po restarcie zasilania, co jest wymagane dla urządzenia monitorującego pracującego bez nadzoru.
- **Kamera:** `back/camera.py` dostaje drugi backend wybierany zmienną środowiskową `CAMERA_BACKEND` (`opencv` — obecne zachowanie, domyślne; `picamera2` — nowy, dla Pi). Import `picamera2` jest leniwy (wewnątrz metody, nie na górze pliku), żeby moduł dało się zaimportować na Windows, gdzie `picamera2` nie istnieje.
- **GPIO (przygotowanie pod fazę B, nieużywane jeszcze w tej fazie):** `RPi.GPIO` i `adafruit-circuitpython-dht` instalowane systemowo (apt), nie w pełni izolowanym venv — obie biblioteki (jak `picamera2`) potrzebują dowiązań do systemowych bibliotek C (`libcamera`, `libgpiod`), których czysty `pip install` w odizolowanym venv nie dostarczy. Venv na Pi trzeba tworzyć z flagą `--system-site-packages`.

## Zmiany w kodzie

### `back/camera.py` — refaktor na dwa backendy

Publiczne API (`capture_jpeg`, `start_recording`, `stop_recording`, `stream`) zostaje bez zmian — żadne wywołanie w `app.py`/`sensors.py` się nie zmienia. Wewnętrznie: wydzielenie `_open_opencv`/`_open_picamera2`/`_is_opened`/`_read_frame`/`_release`, wybieranych na podstawie `CAMERA_BACKEND` odczytanego raz przy imporcie modułu (`os.getenv('CAMERA_BACKEND', 'opencv')`).

Picamera2 zwraca klatki w formacie RGB (numpy array) — przed `cv2.imencode`/zapisem do `VideoWriter` (oba oczekują BGR) trzeba je skonwertować przez `cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)`.

Jeśli `CAMERA_BACKEND=picamera2` a moduł `picamera2` nie jest zainstalowany — `_open_picamera2()` rzuca `RuntimeError` z czytelnym komunikatem po polsku wskazującym komendę instalacyjną (`sudo apt install -y python3-picamera2`), zamiast surowego `ImportError` wypływającego z głębi requesta.

### `back/.env.example`

Dopisanie `CAMERA_BACKEND=opencv` (wartość domyślna, zero zmiany zachowania na dev/Windows).

### `back/requirements.txt`

Doprecyzowanie komentarza przy zakomentowanych liniach `RPi.GPIO`/`picamera2`/`adafruit-circuitpython-dht` — te pakiety **nie** instalują się przez zwykły `pip install` w izolowanym venv na Bookworm (brakuje im systemowych bindingów C); instrukcja instalacji systemowej (apt) trafia do nowego runbooka, nie do samego requirements.txt.

### Nowy plik: `docs/raspberry-pi-deployment.md`

Runbook krok po kroku do wykonania przez użytkownika na Pi:
1. Pakiety systemowe (apt): `python3-picamera2`, `python3-opencv` (opcjonalnie, jeśli `opencv-python-headless` z pip sprawia problem na ARM), `nginx`, `python3-venv`, `libgpiod2`.
2. Utworzenie venv z `--system-site-packages`, instalacja `requirements.txt` przez pip wewnątrz venv.
3. Konfiguracja `.env` na Pi: `CAMERA_BACKEND=picamera2`, `DATABASE_URL`, `FLASK_SECRET_KEY`.
4. `python init_db.py` — świeża baza.
5. Build frontendu (`npm run build` — na Pi albo lokalnie i skopiowanie `dist/`).
6. Plik jednostki systemd dla gunicorna (`ExecStart=.../venv/bin/gunicorn -w 2 -b 0.0.0.0:5000 app:app`), `systemctl enable --now`.
7. Konfiguracja nginx (`server` block wskazujący `root` na `front/dist`, `listen 80`).
8. Weryfikacja: `systemctl status monitoring-backend`, sprawdzenie strumienia kamery w przeglądarce z innego urządzenia w sieci LAN.

## Testowanie

Backend testy jednostkowe (pytest) zostają bez zmian — logika `camera.py` poza samym I/O sprzętowym (wybór backendu, komunikat błędu przy braku `picamera2`) dostaje mały test z `monkeypatch` blokującym import, bez potrzeby prawdziwego sprzętu. Reszta (rzeczywisty strumień z kamery, systemd, nginx) weryfikowana ręcznie na Pi przez użytkownika — nie da się tego pokryć pytestem uruchamianym na Windows.

## Błędy / brzegowe przypadki

- Brak `picamera2` przy `CAMERA_BACKEND=picamera2` → czytelny `RuntimeError`, nie cichy crash.
- `CAMERA_BACKEND` z nieznaną wartością → traktowane jak `opencv` (fallback na obecne zachowanie, nie osobny błąd — mniejsze zaskoczenie).
