"""Odczyt cyfrowych czujników (kontaktron drzwi, PIR, itd.) podłączonych do
GPIO (Raspberry Pi, RPi.GPIO). Aktywne tylko gdy DOOR_BACKEND=gpio itp.
(patrz sensors.py) — domyślnie mock (Windows/dev), gdzie RPi.GPIO nie musi
być zainstalowane (leniwy import).
"""

_gpio_initialized = False


def _ensure_gpio_mode():
    global _gpio_initialized
    if _gpio_initialized:
        return
    import RPi.GPIO as GPIO
    GPIO.setmode(GPIO.BCM)
    _gpio_initialized = True


class DigitalInputReader:
    def __init__(self, pin, pull_up=True):
        self._pin = pin
        self._pull_up = pull_up
        self._configured = False

    def _ensure_configured(self):
        if self._configured:
            return
        _ensure_gpio_mode()
        import RPi.GPIO as GPIO
        pull = GPIO.PUD_UP if self._pull_up else GPIO.PUD_DOWN
        GPIO.setup(self._pin, GPIO.IN, pull_up_down=pull)
        self._configured = True

    def read_high(self):
        """Zwraca True (HIGH) / False (LOW), albo None przy błędzie odczytu."""
        try:
            self._ensure_configured()
            import RPi.GPIO as GPIO
            return bool(GPIO.input(self._pin))
        except Exception as e:
            print(f'[gpio] błąd odczytu pinu {self._pin}: {e}')
            return None
