import threading
import random
import time
from datetime import datetime
# import RPi.GPIO as GPIO
# import adafruit_dht
# import board

LOG_COOLDOWN_SECONDS = 60  # ten sam alert max raz na minutę


class Sensor:
    def __init__(self, app, settings, phone_numbers, camera):
        self.app = app
        self.camera = camera
        self.phone_numbers = phone_numbers
        self._apply_settings(settings)

        self.is_recording = False
        self.is_user_recording = False
        self.temperature = 0.0
        self.humidity = 0.0
        self.motion = False
        self.fire = False
        self.gas = False
        self.door = False
        self.water = False
        self.video_name = ''
        self.timer = None
        self._last_log: dict[str, float] = {}

        # GPIO.setmode(GPIO.BCM)
        # self.motion_pin = 18
        # GPIO.setup(self.motion_pin, GPIO.IN)
        # self.dht = adafruit_dht.DHT22(board.D4)

        self.handling_thread = threading.Thread(target=self._read_loop, daemon=True)
        self.handling_thread.start()

    def _apply_settings(self, settings):
        s = settings[0] if settings else {}
        self.min_temperature = s.get('min_temperature', 15)
        self.max_temperature = s.get('max_temperature', 35)
        self.min_humidity = s.get('min_humidity', 20)
        self.max_humidity = s.get('max_humidity', 80)
        self.recording_seconds = s.get('recording_seconds', 30)
        self.evening_test_time = s.get('evening_test_time', '20:00:00')
        self.morning_test_time = s.get('morning_test_time', '08:00:00')

    def update_settings(self, settings):
        self._apply_settings(settings)

    def get_current_data(self):
        return {
            'temperature': self.temperature,
            'humidity': self.humidity,
            'motion': self.motion,
            'fire': self.fire,
            'gas': self.gas,
            'door': self.door,
            'water': self.water,
        }

    def _log(self, sensor_name, is_warning, description):
        from models import Logs
        key = f'{sensor_name}:{description[:40]}'
        now = time.time()
        if now - self._last_log.get(key, 0) < LOG_COOLDOWN_SECONDS:
            return
        self._last_log[key] = now
        try:
            with self.app.app_context():
                Logs.add_log(datetime.now(), sensor_name, is_warning, description)
        except Exception as e:
            print(f'[sensor] błąd zapisu logu: {e}')

    def _read_sensors(self):
        """Odczyt z hardware. Zastąp mockowane wartości prawdziwymi na RPi."""
        # --- Mock (dev) ---
        self.temperature = random.randint(20, 32)   # w normie, sporadycznie poza
        self.humidity = random.randint(35, 75)       # w normie
        self.motion = random.random() < 0.05         # 5% szansa
        self.fire  = random.random() < 0.01          # 1% szansa
        self.gas   = random.random() < 0.01          # 1% szansa
        self.door  = random.random() < 0.05          # 5% szansa
        self.water = random.random() < 0.01          # 1% szansa

        # --- RPi GPIO (odkomentuj na Raspberry Pi) ---
        # try:
        #     self.temperature = self.dht.temperature
        #     self.humidity = self.dht.humidity
        # except Exception:
        #     pass
        # self.motion = GPIO.input(self.motion_pin)
        # self.fire   = GPIO.input(FIRE_PIN)
        # self.gas    = GPIO.input(GAS_PIN)
        # self.door   = GPIO.input(DOOR_PIN)
        # self.water  = GPIO.input(WATER_PIN)

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
            self._check_test_times()
            time.sleep(1)

    def _check_thresholds(self):
        if self.temperature < self.min_temperature or self.temperature > self.max_temperature:
            desc = f'Temperatura poza zakresem: {self.temperature}°C (zakres {self.min_temperature}–{self.max_temperature}°C)'
            print(f'[sensor] {desc}')
            self._log('Czujnik temperatury', True, desc)

        if self.humidity < self.min_humidity or self.humidity > self.max_humidity:
            desc = f'Wilgotność poza zakresem: {self.humidity}% (zakres {self.min_humidity}–{self.max_humidity}%)'
            print(f'[sensor] {desc}')
            self._log('Czujnik wilgotności', True, desc)

        if self.fire:
            desc = 'Wykryto ogień!'
            print(f'[sensor] {desc}')
            self._log('Czujnik pożaru', True, desc)

        if self.gas:
            desc = 'Wykryto gaz/dym!'
            print(f'[sensor] {desc}')
            self._log('Czujnik gazu', True, desc)

        if self.water:
            desc = 'Wykryto wodę!'
            print(f'[sensor] {desc}')
            self._log('Czujnik wody', True, desc)

        if self.door:
            desc = 'Otwarto drzwi'
            print(f'[sensor] {desc}')
            self._log('Czujnik drzwi', False, desc)

    def _check_test_times(self):
        current_time = time.strftime('%H:%M:%S', time.localtime())
        if current_time in (self.morning_test_time, self.evening_test_time):
            print(f'[sensor] Test systemowy o {current_time}')
            self._log('System', False, f'Test systemowy o {current_time}')
