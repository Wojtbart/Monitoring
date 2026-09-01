import os
import threading
import random
import time
from datetime import datetime

LOG_COOLDOWN_SECONDS = 60  # ten sam alert max raz na minutę


class Sensor:
    def __init__(self, app, settings, camera):
        self.app = app
        self.camera = camera
        self._apply_settings(settings)
        self._load_voltage_threshold()

        self.is_recording = False
        self.is_user_recording = False
        self.temperature = 0.0
        self.humidity = 0.0
        self.voltage = 0.0
        self.motion = False
        self.fire = False
        self.gas = False
        self.door = False
        self.water = False
        self.video_name = ''
        self.timer = None
        self.start_time = time.time()
        self._last_log: dict[str, float] = {}

        # Odczytywane dopiero tutaj (nie na poziomie modułu) celowo: sensors.py
        # jest importowany w app.py PRZED load_dotenv(), więc stałe modułowe
        # czytane przy imporcie zawsze widziałyby wartości domyślne. Sensor()
        # jest tworzony dopiero w init_sensor(), już po load_dotenv().
        dht_backend = os.getenv('DHT_BACKEND', 'mock')
        self._dht_reader = None
        if dht_backend in ('dht11', 'dht22'):
            from dht_sensor import DhtReader
            self._dht_reader = DhtReader(dht_backend)

        door_backend = os.getenv('DOOR_BACKEND', 'mock')
        self._door_reader = None
        if door_backend == 'gpio':
            from gpio_sensor import DigitalInputReader
            door_pin = int(os.getenv('DOOR_PIN', 6))
            self._door_reader = DigitalInputReader(door_pin, pull_up=True)

        water_backend = os.getenv('WATER_BACKEND', 'mock')
        self._water_reader = None
        if water_backend == 'gpio':
            from gpio_sensor import DigitalInputReader
            water_pin = int(os.getenv('WATER_PIN', 23))
            self._water_reader = DigitalInputReader(water_pin, pull_up=False)

        motion_backend = os.getenv('MOTION_BACKEND', 'mock')
        self._motion_reader = None
        if motion_backend == 'gpio':
            from gpio_sensor import DigitalInputReader
            motion_pin = int(os.getenv('MOTION_PIN', 22))
            self._motion_reader = DigitalInputReader(motion_pin, pull_up=False)

        gas_backend = os.getenv('GAS_BACKEND', 'mock')
        self._gas_reader = None
        if gas_backend == 'gpio':
            from gpio_sensor import DigitalInputReader
            gas_pin = int(os.getenv('GAS_PIN', 27))
            self._gas_reader = DigitalInputReader(gas_pin, pull_up=False)

        fire_backend = os.getenv('FIRE_BACKEND', 'mock')
        self._fire_reader = None
        if fire_backend == 'gpio':
            from gpio_sensor import DigitalInputReader
            fire_pin = int(os.getenv('FIRE_PIN', 24))
            self._fire_reader = DigitalInputReader(fire_pin, pull_up=False)

        self.handling_thread = threading.Thread(target=self._read_loop, daemon=True)
        self.handling_thread.start()

    def _apply_settings(self, settings):
        s = settings[0] if settings else {}
        self.recording_seconds = s.get('recording_seconds', 30)

    def update_settings(self, settings):
        self._apply_settings(settings)

    def _load_voltage_threshold(self):
        from models import VoltageThreshold
        with self.app.app_context():
            threshold = VoltageThreshold.get_or_create()
            self.min_voltage = threshold.min_voltage
            self.max_voltage = threshold.max_voltage
            self.voltage_enabled = threshold.enabled

    def update_voltage_threshold(self, min_voltage, max_voltage):
        self.min_voltage = min_voltage
        self.max_voltage = max_voltage

    def update_voltage_enabled(self, enabled):
        self.voltage_enabled = enabled

    def get_current_data(self):
        return {
            'temperature': self.temperature,
            'humidity': self.humidity,
            'voltage': self.voltage,
            'motion': self.motion,
            'fire': self.fire,
            'gas': self.gas,
            'door': self.door,
            'water': self.water,
            'uptime_seconds': int(time.time() - self.start_time),
        }

    def _log(self, sensor_name, is_warning, description, force=False):
        from models import Log
        key = f'{sensor_name}:{description[:40]}'
        now = time.time()
        if not force and now - self._last_log.get(key, 0) < LOG_COOLDOWN_SECONDS:
            return False
        self._last_log[key] = now
        try:
            with self.app.app_context():
                Log.add_log(datetime.now(), sensor_name, is_warning, description)
        except Exception as e:
            print(f'[sensor] błąd zapisu logu: {e}')
        return True

    def _raise_alert(self, event_type, sensor_name, is_warning, desc, force=False):
        print(f'[sensor] {desc}')
        from models import AlarmState, NotificationRule, Log, alarm_should_fire
        with self.app.app_context():
            state = AlarmState.query.filter_by(event_type=event_type).first()
            rule = NotificationRule.query.filter_by(event_type=event_type).first()
            notify_again_minutes = rule.notify_again_minutes if rule else 30
            if not alarm_should_fire(state, notify_again_minutes, force=force):
                return
            Log.add_log(datetime.now(), sensor_name, is_warning, desc)
            AlarmState.trigger(event_type)
        self._notify(event_type, desc)

    def _notify(self, event_type, desc):
        from datetime import datetime as dt
        from models import db, NotificationRule, NotificationGroup, NotificationRecipient, is_within_schedule
        from notifications import send_email, send_sms
        with self.app.app_context():
            rule = NotificationRule.query.filter_by(event_type=event_type).first()
            if not rule or not rule.group_id:
                return
            group = db.session.get(NotificationGroup, rule.group_id)
            if not group or not is_within_schedule(group.schedule, dt.now()):
                return
            recipients = NotificationRecipient.query.filter_by(group_id=rule.group_id).all()
            if rule.email_enabled:
                emails = [r.email for r in recipients if r.email]
                if emails:
                    subject = rule.email_custom_subject if (rule.email_custom_subject_enabled and rule.email_custom_subject) else f'Alarm: {desc}'
                    attachment = self.camera.capture_jpeg() if rule.email_attach_camera else None
                    send_email(emails, subject, desc, attachment_bytes=attachment)
            if rule.sms_enabled:
                numbers = [r.phone_number for r in recipients if r.phone_number]
                if numbers:
                    sms_text = rule.sms_custom_message if (rule.sms_custom_enabled and rule.sms_custom_message) else desc
                    send_sms(numbers, sms_text)

    def _clear_room_alarm(self, event_type, sensor_name, return_desc):
        """Gdy odczyt sam wróci do normy — dezaktywuje alarm automatycznie
        (patrz brainstorming: potwierdzenie ma tylko wyciszać powiadomienia,
        a nie zastępować realny powrót do normy)."""
        from models import AlarmState, Log
        with self.app.app_context():
            state = AlarmState.query.filter_by(event_type=event_type).first()
            if not state or not state.active:
                return
            AlarmState.clear(event_type)
            Log.add_log(datetime.now(), sensor_name, False, return_desc)
        self._notify_return(event_type, return_desc)

    def _notify_return(self, event_type, desc):
        from datetime import datetime as dt
        from models import db, NotificationRule, NotificationGroup, NotificationRecipient, is_within_schedule
        from notifications import send_email, send_sms
        with self.app.app_context():
            rule = NotificationRule.query.filter_by(event_type=event_type).first()
            if not rule or not rule.notify_on_return_enabled or not rule.group_id:
                return
            group = db.session.get(NotificationGroup, rule.group_id)
            if not group or not is_within_schedule(group.schedule, dt.now()):
                return
            recipients = NotificationRecipient.query.filter_by(group_id=rule.group_id).all()
            if rule.email_enabled:
                emails = [r.email for r in recipients if r.email]
                if emails:
                    subject = rule.email_custom_subject if (rule.email_custom_subject_enabled and rule.email_custom_subject) else f'Powrót do normy: {desc}'
                    send_email(emails, subject, desc)
            if rule.sms_enabled:
                numbers = [r.phone_number for r in recipients if r.phone_number]
                if numbers:
                    send_sms(numbers, desc)

    def _read_sensors(self):
        """Odczyt z hardware. Zastąp mockowane wartości prawdziwymi na RPi."""
        # --- Mock (dev) ---
        self.voltage = round(random.uniform(11.5, 14.5), 1)  # napięcie zasilania, w normie
        if not self._motion_reader:
            self.motion = False                        # brak podłączonego czujnika PIR — mock wyłączony
        if not self._fire_reader:
            self.fire = random.random() < 0.01          # mock: 1% szansa
        if not self._gas_reader:
            self.gas = random.random() < 0.01          # mock: 1% szansa
        if not self._door_reader:
            self.door = random.random() < 0.05        # mock: 5% szansa
        if not self._water_reader:
            self.water = random.random() < 0.01        # mock: 1% szansa

        # temperature/humidity: DHT_BACKEND=dht11/dht22 w .env włącza realny odczyt
        # (patrz dht_sensor.py); None (błąd odczytu — normalne dla DHT) zostawia
        # poprzednią wartość zamiast ją zerować. Przy mock (domyślnie) zostają 0.0.
        if self._dht_reader:
            temp, hum = self._dht_reader.read()
            if temp is not None:
                self.temperature = temp
            if hum is not None:
                self.humidity = hum

        # drzwi: DOOR_BACKEND=gpio w .env włącza realny odczyt kontaktronu
        # (patrz gpio_sensor.py) — HIGH = otwarte, LOW = zamknięte. None (błąd
        # odczytu) zostawia poprzednią wartość.
        if self._door_reader:
            high = self._door_reader.read_high()
            if high is not None:
                self.door = high

        # woda: WATER_BACKEND=gpio w .env włącza realny odczyt czujnika deszczu/wody
        # (HL-83 i podobne) — LOW = mokro (odwrotna polaryzacja niż drzwi), HIGH = sucho.
        if self._water_reader:
            high = self._water_reader.read_high()
            if high is not None:
                self.water = not high

        # ruch: MOTION_BACKEND=gpio w .env włącza realny odczyt PIR (HC-SR501) —
        # HIGH = wykryto ruch, LOW = brak ruchu.
        if self._motion_reader:
            high = self._motion_reader.read_high()
            if high is not None:
                self.motion = high

        # gaz/dym: GAS_BACKEND=gpio w .env włącza realny odczyt MQ-2 —
        # LOW = wykryto gaz (odwrotna polaryzacja jak woda), HIGH = czyste powietrze.
        if self._gas_reader:
            high = self._gas_reader.read_high()
            if high is not None:
                self.gas = not high

        # płomień: FIRE_BACKEND=gpio w .env włącza realny odczyt (TCRT5000/podobny) —
        # LOW = wykryto, HIGH = normalnie (taka sama polaryzacja jak gaz/woda).
        if self._fire_reader:
            high = self._fire_reader.read_high()
            if high is not None:
                self.fire = not high

    def _handle_recording(self):
        if self.motion and not self.is_recording and not self.is_user_recording:
            self.video_name = 'Video_' + datetime.now().strftime('Date_%Y_%m_%d_Time_%H_%M_%S')
            self.camera.start_recording()
            self.is_recording = True
            self.timer = threading.Timer(self.recording_seconds, self._stop_auto_recording)
            self.timer.start()
            print('[sensor] Wykryto ruch — nagrywanie rozpoczęte')

        elif self.motion and self.is_recording and self.timer and self.timer.is_alive():
            self.timer.cancel()
            self.timer.join()
            self.timer = threading.Timer(self.recording_seconds, self._stop_auto_recording)
            self.timer.start()
            print('[sensor] Ruch przedłużył nagrywanie')

    def _stop_auto_recording(self):
        self.camera.stop_recording()
        self.is_recording = False
        print('[sensor] Nagrywanie zatrzymane automatycznie')

    def _read_loop(self):
        while True:
            self._read_sensors()
            self._check_thresholds()
            self._handle_recording()
            time.sleep(1)

    def _check_thresholds(self):
        self._check_room_alarm('fire', self.fire, 'Czujnik pożaru', True,
                                'Wykryto ogień!', 'Czujnik pożaru — powrót do normy')
        self._check_room_alarm('gas', self.gas, 'Czujnik gazu', True,
                                'Wykryto gaz/dym!', 'Czujnik gazu — powrót do normy')
        self._check_room_alarm('water', self.water, 'Czujnik wody', True,
                                'Wykryto wodę!', 'Czujnik wody — powrót do normy')
        self._check_room_alarm('door', self.door, 'Czujnik drzwi', False,
                                'Otwarto drzwi', 'Zamknięto drzwi')
        if self.voltage_enabled:
            voltage_out = self.voltage < self.min_voltage or self.voltage > self.max_voltage
            self._check_room_alarm(
                'voltage', voltage_out, 'Napięcie zasilania', True,
                f'Napięcie poza normą: {self.voltage}V (próg {self.min_voltage}-{self.max_voltage}V)',
                f'Napięcie zasilania wróciło do normy: {self.voltage}V',
            )

    def _check_room_alarm(self, event_type, condition, sensor_name, is_warning, trigger_desc, return_desc):
        if condition:
            self._raise_alert(event_type, sensor_name, is_warning, trigger_desc)
        else:
            self._clear_room_alarm(event_type, sensor_name, return_desc)
