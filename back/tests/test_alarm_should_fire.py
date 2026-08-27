from datetime import datetime, timedelta
from models import alarm_should_fire


class _FakeState:
    def __init__(self, active, last_triggered_at):
        self.active = active
        self.last_triggered_at = last_triggered_at


def test_fires_when_no_state():
    assert alarm_should_fire(None, 30) is True


def test_fires_when_state_inactive():
    state = _FakeState(active=False, last_triggered_at=datetime.now())
    assert alarm_should_fire(state, 30) is True


def test_fires_when_active_but_never_triggered():
    state = _FakeState(active=True, last_triggered_at=None)
    assert alarm_should_fire(state, 30) is True


def test_does_not_fire_within_window():
    state = _FakeState(active=True, last_triggered_at=datetime.now() - timedelta(minutes=5))
    assert alarm_should_fire(state, 30) is False


def test_fires_after_window_elapsed():
    state = _FakeState(active=True, last_triggered_at=datetime.now() - timedelta(minutes=31))
    assert alarm_should_fire(state, 30) is True


def test_force_always_fires():
    state = _FakeState(active=True, last_triggered_at=datetime.now())
    assert alarm_should_fire(state, 30, force=True) is True
