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

Frontend woła backend pod adresem z `VITE_API_URL` — Vite wypala tę wartość PRZY BUILDZIE
(nie da się zmienić później bez przebudowania), więc musi wskazywać na realny adres IP Pi
w sieci LAN, nie `localhost` (localhost z przeglądarki na innym urządzeniu wskazywałby na
to urządzenie, nie na Pi).

Utwórz `front/.env` (albo `front/.env.production`):
```
VITE_API_URL=http://<ip-pi>:5000
```

Na Pi (albo lokalnie na Windows i skopiuj folder `front/dist` na Pi — pamiętaj o tym samym
`front/.env` z docelowym IP Pi przed buildem na Windows):

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

Uwaga: `wsgi:app` (nie `app:app`) i **dokładnie 1 worker** (`-w 1`). `app.py` sam w sobie nie
odpala wątku czujników ani kamery przy imporcie (celowo, żeby `import app` pod pytestem był
bezpieczny) — robi to dopiero `back/wsgi.py`. Więcej niż 1 worker odpaliłby wątek czujników
i uchwyt kamery wielokrotnie równolegle (duplikaty logów, wyścig zapisów do bazy, konflikt
o urządzenie kamery).

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

## 7b. Uprawnienia do ping (`/ping/<adres>`)

`pythonping` otwiera surowy socket ICMP — zwykły user (`rpi`, nie root) dostanie
`PermissionError: Operation not permitted`. Nadaj to uprawnienie konkretnie binarce
Pythona w venv (bez podnoszenia całej usługi do roota):

```bash
sudo setcap cap_net_raw+ep /home/rpi/Monitoring/back/venv/bin/python3.11
sudo systemctl restart monitoring-backend
```

Uwaga: to jest przypięte do KONKRETNEGO pliku binarnego — po przebudowaniu venv od
zera trzeba ustawić ponownie.

## 7c. GSM/SMS przez SIM800L (opcjonalnie)

Jeśli masz podłączony moduł SIM800L (UART, zwykle `/dev/serial0`), w `.env` ustaw:
```
SMS_BACKEND=sim800
SIM800_PORT=/dev/serial0
SIM800_BAUDRATE=9600
```

User usługi (`rpi` w przykładzie) musi być w grupie `dialout`, żeby mieć dostęp do portu:
```bash
sudo usermod -a -G dialout rpi
```
Uwaga: zmiana grupy wymaga ponownego zalogowania (albo restartu usługi systemd —
systemd odczyta nowe grupy przy starcie, nie trzeba restartować całego Pi).

Szybki test modułu bez wchodzenia w appkę:
```bash
python3 -c "
import serial, time
s = serial.Serial('/dev/serial0', 9600, timeout=2)
time.sleep(1)
s.write(b'AT\r\n')
time.sleep(1)
print(s.read(s.in_waiting or 1))
"
```
Powinno zwrócić coś zawierające `OK`.

## 7d. DHT22 (temperatura/wilgotność, opcjonalnie)

Jeśli masz podłączony DHT11/DHT22 (jeden przewód danych na GPIO), w `.env` ustaw:
```
DHT_BACKEND=dht22
DHT_PIN=17
```
(`DHT_BACKEND=dht11` jeśli to DHT11, nie DHT22 — sprawdź napis na module).

`adafruit-circuitpython-dht` jest już w `requirements.txt`, instaluje się zwykłym
`pip install -r requirements.txt`.

Szybki test bez appki:
```bash
python3 -c "
import board, adafruit_dht, time
sensor = adafruit_dht.DHT22(board.D17)
for _ in range(6):
    try:
        print('temp:', sensor.temperature, 'hum:', sensor.humidity)
    except RuntimeError as e:
        print('retry:', e)
    time.sleep(2)
"
```
DHT-y regularnie gubią pojedynczy odczyt (`RuntimeError`) — normalne, liczy się czy
CHOCIAŻ RAZ pokaże sensowne liczby.

## 7e. Czujnik drzwi (kontaktron, opcjonalnie)

Jeśli masz podłączony kontaktron (jedna nóżka do GND, druga do GPIO), w `.env` ustaw:
```
DOOR_BACKEND=gpio
DOOR_PIN=6
```
`RPi.GPIO` musi być zainstalowane — patrz sekcja "RPi hardware" w `requirements.txt`
(apt: `sudo apt install -y python3-rpi.gpio`, albo spróbuj zwykłego
`pip install RPi.GPIO` w venv — czasem działa bez apt, zależnie od obrazu OS).

Weryfikacja bez appki (HIGH = otwarte, LOW = zamknięte):
```bash
pinctrl get 6
```
Otwórz/zamknij drzwi między odczytami i sprawdź czy `hi`/`lo` się zmienia.

## 7f. Czujnik wody/deszczu (HL-83 i podobne, opcjonalnie)

```
WATER_BACKEND=gpio
WATER_PIN=23
```
Uwaga: polaryzacja odwrotna niż drzwi — **LOW = mokro**, HIGH = sucho (kod już to
uwzględnia). Weryfikacja:
```bash
pinctrl get 23
```
Zwilż płytkę czujnika, sprawdź czy `hi`→`lo`.

## 7g. Czujnik ruchu PIR (HC-SR501, opcjonalnie)

```
MOTION_BACKEND=gpio
MOTION_PIN=22
```
HIGH = ruch wykryty, LOW = brak ruchu. Weryfikacja:
```bash
pinctrl get 22
```
Pomachaj ręką przed czujnikiem, sprawdź `lo`→`hi` (HC-SR501 ma kilka sekund zwłoki
zanim wróci do `lo`).

## 7h. Czujnik gazu/dymu (MQ-2, opcjonalnie)

```
GAS_BACKEND=gpio
GAS_PIN=27
```
LOW = wykryto gaz, HIGH = czyste powietrze (odwrotna polaryzacja jak drzwi, taka sama
jak woda). MQ-2 potrzebuje kilku minut nagrzewania po podłączeniu zasilania zanim
odczyty się ustabilizują. Weryfikacja/kalibracja progu: obracaj potencjometr na
płytce patrząc na:
```bash
pinctrl get 27
```

## 7i. Czujnik płomienia (TCRT5000/podobny, opcjonalnie)

```
FIRE_BACKEND=gpio
FIRE_PIN=24
```
LOW = wykryto, HIGH = normalnie (jak gaz/woda). Weryfikacja: obracaj potencjometr
na płytce patrząc na `pinctrl get 24`, albo zbliż rękę na 1-2 cm (czujnik odbiciowy).

## 7j. Migracja: przełącznik "czujnik podłączony" (napięcie, temp/wilg. w szafach)

`device_sensor_settings` to nowa tabela — `db.create_all()` (uruchamiane przy starcie
przez `wsgi.py`) utworzy ją sama, nic nie trzeba robić ręcznie.

`voltage_thresholds` już istnieje z danymi na produkcyjnej bazie — `create_all()` NIE
doda do niej nowej kolumny (patrz gotcha w CLAUDE.md). Przed restartem backendu dodaj
kolumnę ręcznie (Pi domyślnie nie ma CLI `sqlite3` — użyj modułu Pythona):

```bash
python3 -c "
import sqlite3
conn = sqlite3.connect('/home/rpi/Monitoring/back/instance/monitoring.db')
conn.execute('ALTER TABLE voltage_thresholds ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT 1;')
conn.commit()
conn.close()
print('OK')
"
```

Dopiero potem `sudo systemctl restart monitoring-backend`.

## 7k. Migracja: potwierdzanie alarmu zamiast kasowania

Wszystkie alarmy (pożar/gaz/woda/drzwi/napięcie/temp.-wilg. w szafach) mają teraz
kolumnę `acknowledged` — przycisk "Potwierdź alarm" tylko wycisza powiadomienia,
alarm dezaktywuje się sam dopiero po realnym powrocie do normy. `alarm_states` i
`device_alarm_states` już istnieją z danymi — dodaj kolumnę ręcznie przed restartem:

```bash
python3 -c "
import sqlite3
conn = sqlite3.connect('/home/rpi/Monitoring/back/instance/monitoring.db')
conn.execute('ALTER TABLE alarm_states ADD COLUMN acknowledged BOOLEAN NOT NULL DEFAULT 0;')
conn.execute('ALTER TABLE device_alarm_states ADD COLUMN acknowledged BOOLEAN NOT NULL DEFAULT 0;')
conn.commit()
conn.close()
print('OK')
"
sudo systemctl restart monitoring-backend
```

## 7l. Migracja: automatyczny zapis układu (rzut/szafa)

Nowa kolumna `auto_save_layout` w `settings` (checkbox w Ustawieniach → "Automatyczny
zapis układu"). `settings` już istnieje z danymi — dodaj kolumnę ręcznie:

```bash
python3 -c "
import sqlite3
conn = sqlite3.connect('/home/rpi/Monitoring/back/instance/monitoring.db')
conn.execute('ALTER TABLE settings ADD COLUMN auto_save_layout BOOLEAN NOT NULL DEFAULT 0;')
conn.commit()
conn.close()
print('OK')
"
sudo systemctl restart monitoring-backend
```

## 7m. Migracja: wspólne grupy powiadomień (e-mail + SMS w jednej grupie)

Dawne osobne grupy mailowe i SMS (`email_groups`/`sms_groups`) zostały zastąpione
jedną tabelą `notification_groups` (+ `notification_recipients`, gdzie każdy
odbiorca ma opcjonalnie e-mail i/lub telefon). `notification_rules` dostało
nowe pole `group_id` zamiast `email_group_id`/`sms_group_id`.

**Kolejność jest ważna** — najpierw schemat, potem migracja danych, potem restart:

```bash
# 1) nowe tabele (notification_groups, notification_recipients) — tworzy sama
python3 -c "
from app import app, db
with app.app_context():
    db.create_all()
print('OK')
"

# 2) nowa kolumna w istniejącej tabeli notification_rules
python3 -c "
import sqlite3
conn = sqlite3.connect('/home/rpi/Monitoring/back/instance/monitoring.db')
conn.execute('ALTER TABLE notification_rules ADD COLUMN group_id INTEGER;')
conn.commit()
conn.close()
print('OK')
"

# 3) migracja danych: scala grupę mailową i SMS w jedną, jeśli obie były
#    przypięte do tej samej reguły (patrz nagłówek pliku dla pełnej polityki)
cd /home/rpi/Monitoring/back
python3 migrations/merge_notification_groups.py

sudo systemctl restart monitoring-backend
```

Stare tabele (`email_groups`, `email_recipients`, `sms_groups`, `sms_recipients`)
zostają w bazie nietknięte, tylko przestają być używane (jak wcześniej
`phone_numbers` — patrz README "Znane ograniczenia"). Po restarcie sprawdź
w Ustawieniach → Powiadomienia, czy grupy i reguły wyglądają poprawnie —
w razie potrzeby popraw ręcznie w UI (np. nazwę scalonej grupy).

## 7n. Migracja: jeden czujnik temp./wilg. na szafę (zamiast per-urządzenie)

Kolumna `unit` (numer slotu) została usunięta z `device_sensors`,
`device_sensor_history` i `device_alarm_states` — fizycznie w szafie stoi
jeden czujnik środowiskowy, nie jeden na serwer. To NIE jest dodanie
kolumny (jak migracje 7j–7m), tylko usunięcie — `db.create_all()` sam z
siebie nie zmieni istniejącego schematu, więc stare tabele trzeba
zdropować i dać im powstać na nowo z aktualnych modeli:

```bash
sudo systemctl stop monitoring-backend
cd /home/rpi/Monitoring/back
python3 -c "
from app import app, db
with app.app_context():
    db.session.execute(db.text('DROP TABLE IF EXISTS device_sensors'))
    db.session.execute(db.text('DROP TABLE IF EXISTS device_sensor_history'))
    db.session.execute(db.text('DROP TABLE IF EXISTS device_alarm_states'))
    db.session.commit()
    db.create_all()
print('OK')
"
sudo systemctl start monitoring-backend
```

**Kasuje** dotychczasowe progi/historię/aktywne alarmy temperatury i
wilgotności per-slot w szafach (napięcie zasilania, użytkownicy i
pozostałe ustawienia nietknięte) — po restarcie każda szafa startuje z
jednym świeżym czujnikiem na domyślnych progach, do ustawienia ponownie
w Ustawieniach/na stronie czujnika danej szafy.

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
