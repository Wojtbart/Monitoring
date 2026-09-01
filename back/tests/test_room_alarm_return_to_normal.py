from datetime import datetime
from models import db, AlarmState, NotificationRule, NotificationGroup, Log
from sensors import Sensor


def _bare_sensor(app):
    sensor = Sensor.__new__(Sensor)
    sensor.app = app
    sensor._last_log = {}
    sensor.fire = False
    sensor.gas = False
    sensor.water = False
    sensor.door = False
    sensor.voltage_enabled = False
    return sensor


def test_alarm_auto_clears_when_condition_returns_false(app):
    with app.app_context():
        AlarmState.seed_defaults()
        AlarmState.trigger('fire')

    sensor = _bare_sensor(app)
    sensor.fire = False
    sensor._check_thresholds()

    with app.app_context():
        state = AlarmState.query.filter_by(event_type='fire').first()
        assert state.active is False


def test_return_to_normal_is_logged(app):
    with app.app_context():
        AlarmState.seed_defaults()
        AlarmState.trigger('door')

    sensor = _bare_sensor(app)
    sensor.door = False
    sensor._check_thresholds()

    with app.app_context():
        logs = Log.get_all_logs()
    assert any('Zamknięto drzwi' in l['log_description'] for l in logs)


def test_return_to_normal_does_nothing_when_already_inactive(app):
    with app.app_context():
        AlarmState.seed_defaults()

    sensor = _bare_sensor(app)
    sensor.water = False
    sensor._check_thresholds()

    with app.app_context():
        logs = Log.get_all_logs()
    assert not any('normy' in l['log_description'] for l in logs)


def test_return_to_normal_notifies_when_rule_enabled(app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_email', lambda to, subject, body, **k: calls.append((to, subject, body)))

    with app.app_context():
        AlarmState.seed_defaults()
        AlarmState.trigger('gas')
        NotificationRule.seed_defaults()
        group = NotificationGroup.add_group('IT')
        NotificationGroup.add_recipient(group.id, email='a@b.com')
        rule = NotificationRule.query.filter_by(event_type='gas').first()
        rule.email_enabled = True
        rule.group_id = group.id
        rule.notify_on_return_enabled = True
        db.session.commit()

    sensor = _bare_sensor(app)
    sensor.gas = False
    sensor._check_thresholds()

    assert len(calls) == 1
    assert 'Powrót do normy' in calls[0][1]


def test_return_to_normal_does_not_notify_when_rule_disabled(app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_email', lambda *a, **k: calls.append(a))

    with app.app_context():
        AlarmState.seed_defaults()
        AlarmState.trigger('water')
        NotificationRule.seed_defaults()
        group = NotificationGroup.add_group('IT')
        NotificationGroup.add_recipient(group.id, email='a@b.com')
        rule = NotificationRule.query.filter_by(event_type='water').first()
        rule.email_enabled = True
        rule.group_id = group.id
        rule.notify_on_return_enabled = False
        db.session.commit()

    sensor = _bare_sensor(app)
    sensor.water = False
    sensor._check_thresholds()

    assert calls == []


def test_acknowledge_silences_repeat_notification(app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_email', lambda to, subject, body, **k: calls.append(body))

    with app.app_context():
        AlarmState.seed_defaults()
        NotificationRule.seed_defaults()
        group = NotificationGroup.add_group('IT')
        NotificationGroup.add_recipient(group.id, email='a@b.com')
        rule = NotificationRule.query.filter_by(event_type='fire').first()
        rule.email_enabled = True
        rule.group_id = group.id
        db.session.commit()

    sensor = _bare_sensor(app)
    sensor.fire = True
    sensor._check_thresholds()
    assert len(calls) == 1

    with app.app_context():
        AlarmState.acknowledge('fire')

    # Alarm nadal aktywny (fire=True) — bez potwierdzenia poszłoby drugie
    # powiadomienie po oknie cooldownu; z potwierdzeniem ma być cicho.
    with app.app_context():
        state = AlarmState.query.filter_by(event_type='fire').first()
        state.last_triggered_at = datetime(2000, 1, 1)
        db.session.commit()

    sensor._check_thresholds()
    assert len(calls) == 1
