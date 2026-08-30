import sys
import gpio_sensor
from gpio_sensor import DigitalInputReader


class _FakeGPIO:
    BCM = 'BCM'
    IN = 'IN'
    PUD_UP = 'PUD_UP'
    PUD_DOWN = 'PUD_DOWN'

    def __init__(self, input_value=1):
        self.mode_set = None
        self.setup_calls = []
        self._input_value = input_value

    def setmode(self, mode):
        self.mode_set = mode

    def setup(self, pin, direction, pull_up_down=None):
        self.setup_calls.append((pin, direction, pull_up_down))

    def input(self, pin):
        return self._input_value


def _reset_gpio_state():
    gpio_sensor._gpio_initialized = False


def test_read_high_returns_true_when_pin_high(monkeypatch):
    _reset_gpio_state()
    fake = _FakeGPIO(input_value=1)
    monkeypatch.setitem(sys.modules, 'RPi', type(sys)('RPi'))
    monkeypatch.setitem(sys.modules, 'RPi.GPIO', fake)

    reader = DigitalInputReader(6, pull_up=True)
    assert reader.read_high() is True
    assert fake.mode_set == 'BCM'
    assert fake.setup_calls == [(6, 'IN', 'PUD_UP')]


def test_read_high_returns_false_when_pin_low(monkeypatch):
    _reset_gpio_state()
    fake = _FakeGPIO(input_value=0)
    monkeypatch.setitem(sys.modules, 'RPi', type(sys)('RPi'))
    monkeypatch.setitem(sys.modules, 'RPi.GPIO', fake)

    reader = DigitalInputReader(6, pull_up=True)
    assert reader.read_high() is False


def test_read_high_configures_pull_down_when_requested(monkeypatch):
    _reset_gpio_state()
    fake = _FakeGPIO(input_value=0)
    monkeypatch.setitem(sys.modules, 'RPi', type(sys)('RPi'))
    monkeypatch.setitem(sys.modules, 'RPi.GPIO', fake)

    reader = DigitalInputReader(23, pull_up=False)
    reader.read_high()
    assert fake.setup_calls == [(23, 'IN', 'PUD_DOWN')]


def test_read_high_returns_none_without_rpi_gpio(monkeypatch, capsys):
    _reset_gpio_state()
    monkeypatch.setitem(sys.modules, 'RPi', None)
    monkeypatch.setitem(sys.modules, 'RPi.GPIO', None)

    reader = DigitalInputReader(6)
    assert reader.read_high() is None
    assert 'błąd odczytu' in capsys.readouterr().out


def test_setup_called_only_once_across_reads(monkeypatch):
    _reset_gpio_state()
    fake = _FakeGPIO(input_value=1)
    monkeypatch.setitem(sys.modules, 'RPi', type(sys)('RPi'))
    monkeypatch.setitem(sys.modules, 'RPi.GPIO', fake)

    reader = DigitalInputReader(6)
    reader.read_high()
    reader.read_high()
    assert len(fake.setup_calls) == 1
