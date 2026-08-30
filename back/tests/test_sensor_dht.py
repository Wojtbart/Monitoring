from sensors import Sensor


def _bare_sensor_with_dht(reader):
    sensor = Sensor.__new__(Sensor)
    sensor._dht_reader = reader
    sensor._door_reader = None
    sensor._water_reader = None
    sensor._motion_reader = None
    sensor._gas_reader = None
    sensor._fire_reader = None
    sensor.temperature = 0.0
    sensor.humidity = 0.0
    return sensor


class _FakeReader:
    def __init__(self, value):
        self._value = value

    def read(self):
        return self._value


def test_read_sensors_updates_temp_humidity_from_dht():
    sensor = _bare_sensor_with_dht(_FakeReader((21.0, 55.0)))
    sensor._read_sensors()
    assert sensor.temperature == 21.0
    assert sensor.humidity == 55.0


def test_read_sensors_keeps_previous_value_on_dht_error():
    sensor = _bare_sensor_with_dht(_FakeReader((None, None)))
    sensor.temperature = 19.5
    sensor.humidity = 60.0
    sensor._read_sensors()
    assert sensor.temperature == 19.5
    assert sensor.humidity == 60.0


def test_read_sensors_stays_zero_without_dht_reader():
    sensor = _bare_sensor_with_dht(None)
    sensor._read_sensors()
    assert sensor.temperature == 0.0
    assert sensor.humidity == 0.0
