from sensors import Sensor


def _bare_sensor_with_fire(reader):
    sensor = Sensor.__new__(Sensor)
    sensor._dht_reader = None
    sensor._door_reader = None
    sensor._water_reader = None
    sensor._motion_reader = None
    sensor._gas_reader = None
    sensor._fire_reader = reader
    sensor.fire = False
    return sensor


class _FakeReader:
    def __init__(self, value):
        self._value = value

    def read_high(self):
        return self._value


def test_read_sensors_sets_fire_true_when_low():
    sensor = _bare_sensor_with_fire(_FakeReader(False))
    sensor._read_sensors()
    assert sensor.fire is True


def test_read_sensors_sets_fire_false_when_high():
    sensor = _bare_sensor_with_fire(_FakeReader(True))
    sensor.fire = True
    sensor._read_sensors()
    assert sensor.fire is False


def test_read_sensors_keeps_previous_fire_state_on_error():
    sensor = _bare_sensor_with_fire(_FakeReader(None))
    sensor.fire = True
    sensor._read_sensors()
    assert sensor.fire is True
