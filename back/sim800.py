"""Wysyłka SMS przez moduł GSM SIM800L podłączony po UART (np. /dev/serial0
na Raspberry Pi). Komendy AT, tryb tekstowy SMS (AT+CMGF=1).

Używane tylko gdy SMS_BACKEND=sim800 (patrz notifications.py) — domyślnie
projekt zostaje przy zamockowanej wysyłce SMS.
"""
import os
import threading
import time

SIM800_PORT = os.getenv('SIM800_PORT', '/dev/serial0')
SIM800_BAUDRATE = int(os.getenv('SIM800_BAUDRATE', 9600))

_lock = threading.Lock()


def send_sms_sim800(to_numbers, message, raise_on_error=False):
    """raise_on_error=False (domyślnie) — używane przy realnych alarmach, żeby
    błąd modemu nie wywrócił pętli czujników. raise_on_error=True — używane
    przez przycisk "Wyślij testowy SMS" w Ustawieniach, żeby prawdziwy błąd
    (brak pyserial, brak portu, brak potwierdzenia od modemu) trafił do UI."""
    if not to_numbers:
        return
    try:
        import serial
    except ImportError:
        message_err = 'biblioteka pyserial nie jest zainstalowana — zainstaluj: pip install pyserial'
        print(f'[sim800] {message_err} — pomijam wysyłkę SMS.')
        if raise_on_error:
            raise RuntimeError(message_err)
        return

    with _lock:
        try:
            with serial.Serial(SIM800_PORT, SIM800_BAUDRATE, timeout=3) as conn:
                time.sleep(1)
                _send_command(conn, 'AT')
                _send_command(conn, 'AT+CMGF=1')
                for number in to_numbers:
                    _send_sms_to_one(conn, number, message, raise_on_error=raise_on_error)
        except Exception as e:
            print(f'[sim800] błąd wysyłki SMS: {e}')
            if raise_on_error:
                raise


def _send_command(conn, command, wait=1.0):
    conn.reset_input_buffer()
    conn.write((command + '\r\n').encode())
    time.sleep(wait)
    return conn.read(conn.in_waiting or 1).decode(errors='replace')


def _send_sms_to_one(conn, number, message, raise_on_error=False):
    _send_command(conn, f'AT+CMGS="{number}"', wait=0.5)
    conn.write((message + chr(26)).encode())
    time.sleep(3)
    result = conn.read(conn.in_waiting or 1).decode(errors='replace')
    if '+CMGS' in result or 'OK' in result:
        print(f'[sim800] SMS wysłany do {number}')
    else:
        error_message = f'SMS do {number} — brak potwierdzenia modemu: {result!r}'
        print(f'[sim800] {error_message}')
        if raise_on_error:
            raise RuntimeError(error_message)
