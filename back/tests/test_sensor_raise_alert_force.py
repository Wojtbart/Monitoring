from models import db, AlarmState, NotificationRule, EmailGroup
from sensors import Sensor


def _bare_sensor(app):
    sensor = Sensor.__new__(Sensor)
    sensor.app = app
    sensor._last_log = {}
    return sensor


def _seed_enabled_email_rule(app, event_type):
    with app.app_context():
        NotificationRule.seed_defaults()
        group = EmailGroup.add_group('IT')
        EmailGroup.add_recipient(group.id, 'a@b.com')
        rule = NotificationRule.query.filter_by(event_type=event_type).first()
        rule.email_enabled = True
        rule.email_group_id = group.id
        db.session.commit()


def test_raise_alert_sets_alarm_state_active(app, monkeypatch):
    monkeypatch.setattr('notifications.send_email', lambda *a, **k: None)
    monkeypatch.setattr('notifications.send_sms', lambda *a, **k: None)
    with app.app_context():
        AlarmState.seed_defaults()

    sensor = _bare_sensor(app)
    sensor._raise_alert('fire', 'Czujnik pożaru', True, 'Wykryto ogień!')

    with app.app_context():
        state = AlarmState.query.filter_by(event_type='fire').first()
        assert state.active is True


def test_raise_alert_respects_cooldown_without_force(app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_email', lambda *a, **k: calls.append(a))
    monkeypatch.setattr('notifications.send_sms', lambda *a, **k: calls.append(a))
    with app.app_context():
        AlarmState.seed_defaults()
    _seed_enabled_email_rule(app, 'fire')

    sensor = _bare_sensor(app)
    sensor._raise_alert('fire', 'Czujnik pożaru', True, 'Wykryto ogień!')
    sensor._raise_alert('fire', 'Czujnik pożaru', True, 'Wykryto ogień!')

    assert len(calls) == 1


def test_raise_alert_force_bypasses_cooldown(app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_email', lambda *a, **k: calls.append(a))
    monkeypatch.setattr('notifications.send_sms', lambda *a, **k: calls.append(a))
    with app.app_context():
        AlarmState.seed_defaults()
    _seed_enabled_email_rule(app, 'fire')

    sensor = _bare_sensor(app)
    sensor._raise_alert('fire', 'Czujnik pożaru', True, 'Wykryto ogień!')
    sensor._raise_alert('fire', 'Czujnik pożaru', True, 'Wykryto ogień! (TEST)', force=True)

    assert len(calls) == 2


def test_log_force_still_updates_cooldown_window(app):
    sensor = _bare_sensor(app)
    assert sensor._log('Czujnik pożaru', True, 'Wykryto ogień!', force=True) is True
    assert sensor._log('Czujnik pożaru', True, 'Wykryto ogień!') is False
