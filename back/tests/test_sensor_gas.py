from sensors import Sensor


def _bare_sensor_with_gas(reader):
    sensor = Sensor.__new__(Sensor)
    sensor._dht_reader = None
    sensor._door_reader = None
    sensor._water_reader = None
    sensor._motion_reader = None
    sensor._gas_reader = reader
    sensor._fire_reader = None
    sensor.gas = False
    return sensor


class _FakeReader:
    def __init__(self, value):
        self._value = value

    def read_high(self):
        return self._value


def test_read_sensors_sets_gas_true_when_low():
    sensor = _bare_sensor_with_gas(_FakeReader(False))
    sensor._read_sensors()
    assert sensor.gas is True


def test_read_sensors_sets_gas_false_when_high():
    sensor = _bare_sensor_with_gas(_FakeReader(True))
    sensor.gas = True
    sensor._read_sensors()
    assert sensor.gas is False


def test_read_sensors_keeps_previous_gas_state_on_error():
    sensor = _bare_sensor_with_gas(_FakeReader(None))
    sensor.gas = True
    sensor._read_sensors()
    assert sensor.gas is True
