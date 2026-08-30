import sys
import dht_sensor
from dht_sensor import DhtReader


class _FakeAdafruitDht:
    class DHT22:
        def __init__(self, pin):
            self.pin = pin
            self.temperature = 22.5
            self.humidity = 48.0

    class DHT11:
        def __init__(self, pin):
            self.pin = pin
            self.temperature = 20.0
            self.humidity = 50.0


class _FakeBoard:
    D17 = 'D17-pin-object'
    D4 = 'D4-pin-object'


def test_read_returns_values_on_success(monkeypatch):
    monkeypatch.setitem(sys.modules, 'board', _FakeBoard())
    monkeypatch.setitem(sys.modules, 'adafruit_dht', _FakeAdafruitDht())
    monkeypatch.setattr(dht_sensor, 'DHT_PIN', 17)

    reader = DhtReader('dht22')
    temp, hum = reader.read()
    assert temp == 22.5
    assert hum == 48.0


def test_read_uses_dht11_class_when_configured(monkeypatch):
    monkeypatch.setitem(sys.modules, 'board', _FakeBoard())
    monkeypatch.setitem(sys.modules, 'adafruit_dht', _FakeAdafruitDht())
    monkeypatch.setattr(dht_sensor, 'DHT_PIN', 17)

    reader = DhtReader('dht11')
    temp, hum = reader.read()
    assert temp == 20.0
    assert hum == 50.0


def test_read_returns_none_none_on_error(monkeypatch, capsys):
    class _BrokenAdafruitDht:
        class DHT22:
            def __init__(self, pin):
                raise RuntimeError('Checksum did not validate')

    monkeypatch.setitem(sys.modules, 'board', _FakeBoard())
    monkeypatch.setitem(sys.modules, 'adafruit_dht', _BrokenAdafruitDht())

    reader = DhtReader('dht22')
    temp, hum = reader.read()
    assert temp is None
    assert hum is None
    assert 'błąd odczytu' in capsys.readouterr().out


def test_read_reuses_sensor_instance_across_calls(monkeypatch):
    created = []

    class _CountingDht:
        def __init__(self, pin):
            created.append(pin)
            self.temperature = 1.0
            self.humidity = 2.0

    class _FakeModule:
        DHT22 = _CountingDht

    monkeypatch.setitem(sys.modules, 'board', _FakeBoard())
    monkeypatch.setitem(sys.modules, 'adafruit_dht', _FakeModule())
    monkeypatch.setattr(dht_sensor, 'DHT_PIN', 17)

    reader = DhtReader('dht22')
    reader.read()
    reader.read()
    assert len(created) == 1
