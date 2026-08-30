from sensors import Sensor


def _bare_sensor_with_door(reader):
    sensor = Sensor.__new__(Sensor)
    sensor._dht_reader = None
    sensor._door_reader = reader
    sensor._water_reader = None
    sensor._motion_reader = None
    sensor._gas_reader = None
    sensor._fire_reader = None
    sensor.door = False
    return sensor


class _FakeReader:
    def __init__(self, value):
        self._value = value

    def read_high(self):
        return self._value


def test_read_sensors_sets_door_open_when_high():
    sensor = _bare_sensor_with_door(_FakeReader(True))
    sensor._read_sensors()
    assert sensor.door is True


def test_read_sensors_sets_door_closed_when_low():
    sensor = _bare_sensor_with_door(_FakeReader(False))
    sensor.door = True
    sensor._read_sensors()
    assert sensor.door is False


def test_read_sensors_keeps_previous_door_state_on_error():
    sensor = _bare_sensor_with_door(_FakeReader(None))
    sensor.door = True
    sensor._read_sensors()
    assert sensor.door is True
