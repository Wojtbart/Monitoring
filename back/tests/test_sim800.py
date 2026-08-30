import sys
import pytest
import sim800


class _FakeSerial:
    def __init__(self, responses=None):
        self.written = []
        self.closed = False
        self._responses = list(responses or [b'OK\r\n'])
        self.in_waiting = 1

    def write(self, data):
        self.written.append(data)

    def read(self, n):
        return self._responses.pop(0) if self._responses else b''

    def reset_input_buffer(self):
        pass

    def close(self):
        self.closed = True

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()


def test_send_sms_sim800_without_pyserial_logs_and_returns(monkeypatch, capsys):
    monkeypatch.setitem(sys.modules, 'serial', None)
    sim800.send_sms_sim800(['+48123456789'], 'Test')
    captured = capsys.readouterr()
    assert 'pyserial' in captured.out


def test_send_sms_sim800_sends_at_commands(monkeypatch):
    fake = _FakeSerial(responses=[b'OK\r\n', b'OK\r\n', b'> ', b'+CMGS: 1\r\nOK\r\n'])

    class FakeSerialModule:
        Serial = lambda *a, **k: fake

    monkeypatch.setitem(sys.modules, 'serial', FakeSerialModule())
    monkeypatch.setattr(sim800.time, 'sleep', lambda s: None)

    sim800.send_sms_sim800(['+48123456789'], 'Cześć')

    joined = b''.join(fake.written)
    assert b'AT+CMGF=1' in joined
    assert b'AT+CMGS="+48123456789"' in joined
    assert 'Cześć'.encode() in joined
    assert chr(26).encode() in joined


def test_send_sms_sim800_handles_exception_gracefully(monkeypatch, capsys):
    class FakeSerialModule:
        def Serial(*a, **k):
            raise OSError('port zajęty')

    monkeypatch.setitem(sys.modules, 'serial', FakeSerialModule())
    sim800.send_sms_sim800(['+48123456789'], 'Test')
    captured = capsys.readouterr()
    assert 'błąd wysyłki SMS' in captured.out
