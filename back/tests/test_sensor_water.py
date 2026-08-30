from sensors import Sensor


def _bare_sensor_with_water(reader):
    sensor = Sensor.__new__(Sensor)
    sensor._dht_reader = None
    sensor._door_reader = None
    sensor._water_reader = reader
    sensor._motion_reader = None
    sensor._gas_reader = None
    sensor._fire_reader = None
    sensor.water = False
    return sensor


class _FakeReader:
    def __init__(self, value):
        self._value = value

    def read_high(self):
        return self._value


def test_read_sensors_sets_water_true_when_low():
    sensor = _bare_sensor_with_water(_FakeReader(False))
    sensor._read_sensors()
    assert sensor.water is True


def test_read_sensors_sets_water_false_when_high():
    sensor = _bare_sensor_with_water(_FakeReader(True))
    sensor.water = True
    sensor._read_sensors()
    assert sensor.water is False


def test_read_sensors_keeps_previous_water_state_on_error():
    sensor = _bare_sensor_with_water(_FakeReader(None))
    sensor.water = True
    sensor._read_sensors()
    assert sensor.water is True
