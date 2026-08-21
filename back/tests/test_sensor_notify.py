from models import db, NotificationRule, EmailGroup
from sensors import Sensor


def _bare_sensor(app):
    sensor = Sensor.__new__(Sensor)
    sensor.app = app
    sensor._last_log = {}
    return sensor


def test_notify_sends_email_when_rule_enabled(app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_email', lambda to, subject, body: calls.append((to, subject, body)))
    monkeypatch.setattr('notifications.send_sms', lambda *a: (_ for _ in ()).throw(AssertionError('nie powinno wysłać SMS')))

    with app.app_context():
        NotificationRule.seed_defaults()
        group = EmailGroup.add_group('IT')
        EmailGroup.add_recipient(group.id, 'a@b.com')
        rule = NotificationRule.query.filter_by(event_type='fire').first()
        rule.email_enabled = True
        rule.email_group_id = group.id
        db.session.commit()

    sensor = _bare_sensor(app)
    sensor._notify('fire', 'Wykryto ogień!')

    assert len(calls) == 1
    to, subject, body = calls[0]
    assert to == ['a@b.com']


def test_notify_does_nothing_when_rule_disabled(app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_email', lambda *a: calls.append(a))
    monkeypatch.setattr('notifications.send_sms', lambda *a: calls.append(a))

    with app.app_context():
        NotificationRule.seed_defaults()

    sensor = _bare_sensor(app)
    sensor._notify('fire', 'Wykryto ogień!')

    assert calls == []


def test_raise_alert_skips_notify_during_cooldown(app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_email', lambda *a: calls.append(a))

    with app.app_context():
        NotificationRule.seed_defaults()
        group = EmailGroup.add_group('IT')
        EmailGroup.add_recipient(group.id, 'a@b.com')
        rule = NotificationRule.query.filter_by(event_type='fire').first()
        rule.email_enabled = True
        rule.email_group_id = group.id
        db.session.commit()

    sensor = _bare_sensor(app)
    sensor._raise_alert('fire', 'Czujnik pożaru', True, 'Wykryto ogień!')
    sensor._raise_alert('fire', 'Czujnik pożaru', True, 'Wykryto ogień!')

    assert len(calls) == 1
