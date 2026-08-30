# Raspberry Pi Deployment (Faza A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Umożliwić uruchomienie backendu Flask + kamery na Raspberry Pi 4 (Debian 12 Bookworm, moduł kamery CSI ov5647) bez zmiany zachowania na Windows/dev, plus runbook do samodzielnego wdrożenia przez użytkownika (nginx + gunicorn + systemd).

**Architecture:** `back/camera.py` dostaje drugi backend przechwytywania klatek (`picamera2`) wybierany zmienną środowiskową `CAMERA_BACKEND`, z leniwym importem żeby moduł dało się zaimportować bez `picamera2` zainstalowanego (Windows). Publiczne API klasy `Camera` (`capture_jpeg`, `start_recording`, `stop_recording`, `stream`) zostaje identyczne — zero zmian w `app.py`/`sensors.py`. Dokumentacja deploymentu (systemd, nginx, apt) idzie do osobnego pliku runbooka, bo dotyczy komend uruchamianych na Pi, nie kodu repo.

**Tech Stack:** Python 3.11 / Flask / OpenCV (`opencv-python-headless`) / picamera2 (Pi-only, apt) / gunicorn / nginx / systemd.

**Spec:** `docs/superpowers/specs/2026-08-29-raspberry-pi-deployment-design.md`

## Global Constraints

- Zero zmian zachowania na Windows/dev — domyślny `CAMERA_BACKEND` (brak zmiennej lub nieznana wartość) = `opencv`, identyczne jak dziś.
- Import `picamera2` musi być leniwy (wewnątrz metody) — moduł `camera.py` musi dać się zaimportować bez błędu na maszynie bez `picamera2`.
- Brak `picamera2` przy `CAMERA_BACKEND=picamera2` → czytelny `RuntimeError` po polsku z komendą instalacyjną, nie surowy `ImportError`.
- Testy pytest uruchamiane na Windows — żaden test nie może wymagać prawdziwego sprzętu kamery/GPIO.

---

### Task 1: `Camera` — dwa backendy przechwytywania klatek

**Files:**
- Modify: `back/camera.py` (cały plik, patrz pełna treść niżej)
- Test: `back/tests/test_camera_backend.py` (nowy plik)

**Interfaces:**
- Produces: `Camera.__init__(videos_dir='videos')` — czyta `CAMERA_BACKEND` ze zmiennej środowiskowej przy KAŻDYM tworzeniu instancji (nie raz przy imporcie modułu), zapisuje jako `self._backend` (`'opencv'` lub `'picamera2'`, każda inna wartość → `'opencv'`). Publiczne metody (`capture_jpeg`, `start_recording`, `stop_recording`, `stream`) bez zmian sygnatur.

- [ ] **Step 1: Napisz failing testy**

```python
# back/tests/test_camera_backend.py
import sys
import pytest
from camera import Camera


def test_camera_defaults_to_opencv_backend(monkeypatch):
    monkeypatch.delenv('CAMERA_BACKEND', raising=False)
    cam = Camera('videos')
    assert cam._backend == 'opencv'


def test_camera_reads_picamera2_backend_from_env(monkeypatch):
    monkeypatch.setenv('CAMERA_BACKEND', 'picamera2')
    cam = Camera('videos')
    assert cam._backend == 'picamera2'


def test_unknown_backend_falls_back_to_opencv(monkeypatch):
    monkeypatch.setenv('CAMERA_BACKEND', 'bogus')
    cam = Camera('videos')
    assert cam._backend == 'opencv'


def test_open_picamera2_without_module_raises_clear_error(monkeypatch):
    monkeypatch.setenv('CAMERA_BACKEND', 'picamera2')
    monkeypatch.setitem(sys.modules, 'picamera2', None)
    cam = Camera('videos')
    with pytest.raises(RuntimeError, match='python3-picamera2'):
        cam._open_picamera2()
```

- [ ] **Step 2: Uruchom testy, potwierdź FAIL**

Run: `cd back && python -m pytest tests/test_camera_backend.py -v`
Expected: FAIL — `AttributeError: 'Camera' object has no attribute '_backend'` (i brak metody `_open_picamera2`).

- [ ] **Step 3: Zaimplementuj pełną treść `back/camera.py`**

```python
import os
import sys
import time
from datetime import datetime
import cv2

STREAM_FPS = 15
FRAME_SIZE = (640, 480)


class Camera:
    def __init__(self, videos_dir='videos'):
        backend = os.getenv('CAMERA_BACKEND', 'opencv')
        self._backend = backend if backend == 'picamera2' else 'opencv'
        self._cap = None
        self._picam = None
        self._writer = None
        self.is_recording = False
        self._videos_dir = videos_dir

    def _open(self):
        if self._backend == 'picamera2':
            self._open_picamera2()
        else:
            self._open_opencv()

    def _open_opencv(self):
        if self._cap is not None:
            return
        # CAP_DSHOW tylko na Windows (szybszy init)
        if sys.platform == 'win32':
            self._cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
        else:
            self._cap = cv2.VideoCapture(0)

    def _open_picamera2(self):
        if self._picam is not None:
            return
        try:
            from picamera2 import Picamera2
        except ImportError as e:
            raise RuntimeError(
                'CAMERA_BACKEND=picamera2, ale biblioteka picamera2 nie jest zainstalowana. '
                'Zainstaluj systemowo: sudo apt install -y python3-picamera2'
            ) from e
        picam = Picamera2()
        config = picam.create_video_configuration(main={'format': 'RGB888', 'size': FRAME_SIZE})
        picam.configure(config)
        picam.start()
        self._picam = picam

    def _is_opened(self):
        if self._backend == 'picamera2':
            return self._picam is not None
        return self._cap is not None and self._cap.isOpened()

    def _read_frame(self):
        if self._backend == 'picamera2':
            frame = self._picam.capture_array()
            return True, cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        return self._cap.read()

    def _release(self):
        if self._backend == 'picamera2':
            if self._picam:
                self._picam.stop()
                self._picam.close()
                self._picam = None
        else:
            if self._cap:
                self._cap.release()
                self._cap = None

    def capture_jpeg(self):
        self._open()
        if not self._is_opened():
            return None
        ok, frame = self._read_frame()
        if not ok:
            return None
        ret, buf = cv2.imencode('.jpg', frame)
        if not ret:
            return None
        return buf.tobytes()

    def start_recording(self):
        if self.is_recording:
            return None
        self._open()
        if not self._is_opened():
            return None
        video_name = 'Video_' + datetime.now().strftime('Date_%Y_%m_%d_Time_%H_%M_%S') + '.mp4'
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        self._writer = cv2.VideoWriter(f'{self._videos_dir}/{video_name}', fourcc, 20.0, FRAME_SIZE)
        self.is_recording = True
        return video_name

    def stop_recording(self):
        if not self.is_recording:
            return
        if self._writer:
            self._writer.release()
            self._writer = None
        self.is_recording = False

    def stream(self):
        self._open()
        if not self._is_opened():
            return

        try:
            while True:
                ok, frame = self._read_frame()
                if not ok:
                    break
                if self.is_recording and self._writer:
                    self._writer.write(frame)
                ret, buf = cv2.imencode('.jpg', frame)
                if not ret:
                    continue
                yield (
                    b'--frame\r\n'
                    b'Content-Type: image/jpeg\r\n\r\n' + buf.tobytes() + b'\r\n'
                )
                time.sleep(1 / STREAM_FPS)
        finally:
            self._release()
```

- [ ] **Step 4: Uruchom testy, potwierdź PASS**

Run: `cd back && python -m pytest tests/test_camera_backend.py -v`
Expected: 4 passed.

- [ ] **Step 5: Uruchom cały zestaw testów backendu (upewnij się że nic nie popsute)**

Run: `cd back && python -m pytest -q`
Expected: wszystkie testy zielone (wcześniej 194 passed — liczba rośnie o 4 z tego taska).

- [ ] **Step 6: Commit**

```bash
git add back/camera.py back/tests/test_camera_backend.py
git commit -m "feat: dodaj backend picamera2 do Camera obok opencv"
```

---

### Task 2: `.env.example` + komentarz w `requirements.txt`

**Files:**
- Modify: `back/.env.example`
- Modify: `back/requirements.txt`

**Interfaces:**
- Consumes: `CAMERA_BACKEND` czytane przez `Camera.__init__` z Task 1.

- [ ] **Step 1: Dopisz linię do `back/.env.example`**

Dodaj na końcu pliku:
```
CAMERA_BACKEND=opencv
```

- [ ] **Step 2: Popraw komentarz w `back/requirements.txt`**

Zamień istniejący blok:
```
# RPi hardware (odkomentuj na Raspberry Pi)
# RPi.GPIO>=0.7.1
# picamera2>=0.3.19
# adafruit-circuitpython-dht>=4.0.0
```
na:
```
# RPi hardware — NIE instaluj przez zwykłe `pip install` w izolowanym venv.
# Te pakiety potrzebują systemowych bindingów C (libcamera/libgpiod), których
# czysty pip w odizolowanym venv nie dostarczy. Instalacja: patrz
# docs/raspberry-pi-deployment.md (apt install + venv --system-site-packages).
# RPi.GPIO>=0.7.1
# picamera2>=0.3.19
# adafruit-circuitpython-dht>=4.0.0
```

- [ ] **Step 3: Commit**

```bash
git add back/.env.example back/requirements.txt
git commit -m "docs: dopisz CAMERA_BACKEND do .env.example, doprecyzuj instalację RPi hardware"
```

---

### Task 3: Runbook wdrożeniowy

**Files:**
- Create: `docs/raspberry-pi-deployment.md`

**Interfaces:**
- Consumes: `CAMERA_BACKEND` (Task 1), plik `.env.example` (Task 2).

- [ ] **Step 1: Utwórz plik z pełną treścią**

```markdown
# Wdrożenie na Raspberry Pi (LAN-only)

Zakłada: Raspberry Pi 4, Debian 12 Bookworm (64-bit/aarch64), kod skopiowany ręcznie
(USB/scp/VS Code Remote) do np. `/home/rpi/Monitoring`, dostęp tylko z sieci lokalnej.

## 1. Pakiety systemowe

```bash
sudo apt update
sudo apt install -y python3-venv python3-picamera2 python3-opencv nginx libgpiod2
```

`python3-picamera2` i `python3-opencv` instalują się systemowo (apt), nie przez pip —
potrzebują bindingów C do libcamera, których izolowany venv nie dostarczy.

## 2. Wirtualne środowisko Pythona

Venv MUSI mieć `--system-site-packages`, żeby widzieć `picamera2`/`cv2` zainstalowane apt-em:

```bash
cd /home/rpi/Monitoring/back
python3 -m venv --system-site-packages venv
source venv/bin/activate
pip install -r requirements.txt
```

## 3. Konfiguracja `.env`

Skopiuj `.env.example` do `.env` i ustaw:

```
CAMERA_BACKEND=picamera2
DATABASE_URL=sqlite:///monitoring.db
FLASK_SECRET_KEY=<wygeneruj losowy ciąg>
```

## 4. Baza danych od zera

```bash
python init_db.py
```

## 5. Build frontendu

Na Pi (albo lokalnie na Windows i skopiuj folder `front/dist` na Pi):

```bash
cd ../front
npm install
npm run build
```

## 6. Usługa systemd dla backendu (gunicorn)

Utwórz `/etc/systemd/system/monitoring-backend.service`:

```ini
[Unit]
Description=Monitoring System Backend
After=network.target

[Service]
Type=simple
User=rpi
WorkingDirectory=/home/rpi/Monitoring/back
ExecStart=/home/rpi/Monitoring/back/venv/bin/gunicorn -w 1 -b 0.0.0.0:5000 wsgi:app
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Backend potrzebuje `gunicorn` w venv:

```bash
source /home/rpi/Monitoring/back/venv/bin/activate
pip install gunicorn
sudo systemctl daemon-reload
sudo systemctl enable --now monitoring-backend
```

## 7. Konfiguracja nginx (frontend statyczny)

`/etc/nginx/sites-available/monitoring`:

```nginx
server {
    listen 80;
    server_name _;
    root /home/rpi/Monitoring/front/dist;
    index index.html;
    location / {
        try_files $uri /index.html;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/monitoring /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo systemctl restart nginx
```

## 8. Weryfikacja

```bash
sudo systemctl status monitoring-backend
sudo systemctl status nginx
```

Z innego urządzenia w tej samej sieci: `http://<ip-pi>/` — powinien wyświetlić się
frontend, logowanie powinno działać (backend na porcie 5000), podgląd kamery na
stronie "Widok z kamery" powinien pokazywać żywy obraz z modułu CSI.

Jeśli podgląd kamery nie działa: sprawdź `sudo journalctl -u monitoring-backend -f`
podczas otwierania strony kamery — błąd `RuntimeError` z komunikatem o instalacji
`python3-picamera2` oznacza że pakiet apt się nie zainstalował poprawnie albo venv
nie ma `--system-site-packages`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/raspberry-pi-deployment.md
git commit -m "docs: dodaj runbook wdrożenia na Raspberry Pi"
```
