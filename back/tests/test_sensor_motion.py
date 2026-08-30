from sensors import Sensor


def _bare_sensor_with_motion(reader):
    sensor = Sensor.__new__(Sensor)
    sensor._dht_reader = None
    sensor._door_reader = None
    sensor._water_reader = None
    sensor._motion_reader = reader
    sensor._gas_reader = None
    sensor._fire_reader = None
    sensor.motion = False
    return sensor


class _FakeReader:
    def __init__(self, value):
        self._value = value

    def read_high(self):
        return self._value


def test_read_sensors_sets_motion_true_when_high():
    sensor = _bare_sensor_with_motion(_FakeReader(True))
    sensor._read_sensors()
    assert sensor.motion is True


def test_read_sensors_sets_motion_false_when_low():
    sensor = _bare_sensor_with_motion(_FakeReader(False))
    sensor.motion = True
    sensor._read_sensors()
    assert sensor.motion is False


def test_read_sensors_keeps_previous_motion_state_on_error():
    sensor = _bare_sensor_with_motion(_FakeReader(None))
    sensor.motion = True
    sensor._read_sensors()
    assert sensor.motion is True
