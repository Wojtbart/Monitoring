"""Odczyt temperatury/wilgotności z czujnika DHT11/DHT22 podłączonego do GPIO
(Raspberry Pi, biblioteka adafruit-circuitpython-dht). Aktywne tylko gdy
DHT_BACKEND=dht11/dht22 (patrz sensors.py) — domyślnie projekt zostaje przy
mocku (Windows/dev), gdzie ani `board` ani `adafruit_dht` nie muszą być
zainstalowane (leniwy import).
"""
import os

DHT_PIN = int(os.getenv('DHT_PIN', 17))


class DhtReader:
    def __init__(self, sensor_type='dht22'):
        self._sensor = None
        self._sensor_type = sensor_type

    def _ensure_sensor(self):
        if self._sensor is not None:
            return
        import board
        import adafruit_dht
        cls = adafruit_dht.DHT11 if self._sensor_type == 'dht11' else adafruit_dht.DHT22
        pin = getattr(board, f'D{DHT_PIN}')
        self._sensor = cls(pin)

    def read(self):
        """Zwraca (temperature, humidity) albo (None, None) przy błędzie odczytu.
        DHT-y regularnie gubią pojedyncze odczyty (błąd checksumy/timing) — to
        normalne, wywołujący powinien zostawić poprzednią wartość przy None,
        nie zerować jej."""
        try:
            self._ensure_sensor()
            return self._sensor.temperature, self._sensor.humidity
        except Exception as e:
            print(f'[dht] błąd odczytu: {e}')
            return None, None
