from datetime import datetime, timedelta
from models import db, AlarmState, NotificationRule, EmailGroup, SmsGroup
from sensors import Sensor


def _bare_sensor(app):
    sensor = Sensor.__new__(Sensor)
    sensor.app = app
    sensor._last_log = {}
    return sensor


def test_notify_sends_email_when_rule_enabled(app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_email', lambda to, subject, body, **kwargs: calls.append((to, subject, body)))
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
    monkeypatch.setattr('notifications.send_email', lambda *a, **k: calls.append(a))
    monkeypatch.setattr('notifications.send_sms', lambda *a, **k: calls.append(a))

    with app.app_context():
        NotificationRule.seed_defaults()

    sensor = _bare_sensor(app)
    sensor._notify('fire', 'Wykryto ogień!')

    assert calls == []


def test_raise_alert_skips_notify_during_cooldown(app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_email', lambda *a, **k: calls.append(a))

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


def test_raise_alert_repeats_after_notify_again_window(app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_email', lambda *a, **k: calls.append(a))

    with app.app_context():
        NotificationRule.seed_defaults()
        group = EmailGroup.add_group('IT')
        EmailGroup.add_recipient(group.id, 'a@b.com')
        rule = NotificationRule.query.filter_by(event_type='fire').first()
        rule.email_enabled = True
        rule.email_group_id = group.id
        rule.notify_again_minutes = 5
        db.session.commit()

    sensor = _bare_sensor(app)
    sensor._raise_alert('fire', 'Czujnik pożaru', True, 'Wykryto ogień!')

    with app.app_context():
        state = AlarmState.query.filter_by(event_type='fire').first()
        state.last_triggered_at = datetime.now() - timedelta(minutes=6)
        db.session.commit()

    sensor._raise_alert('fire', 'Czujnik pożaru', True, 'Wykryto ogień!')

    assert len(calls) == 2


def test_notify_uses_custom_sms_text_when_enabled(app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_sms', lambda to, message: calls.append((to, message)))
    monkeypatch.setattr('notifications.send_email', lambda *a, **k: (_ for _ in ()).throw(AssertionError('nie powinno wysłać e-mail')))

    with app.app_context():
        NotificationRule.seed_defaults()
        group = SmsGroup.add_group('IT-SMS')
        SmsGroup.add_recipient(group.id, '123456789')
        rule = NotificationRule.query.filter_by(event_type='fire').first()
        rule.sms_enabled = True
        rule.sms_group_id = group.id
        rule.sms_custom_enabled = True
        rule.sms_custom_message = 'Alarm pożarowy, sprawdź budynek!'
        db.session.commit()

    sensor = _bare_sensor(app)
    sensor._notify('fire', 'Wykryto ogień!')

    assert len(calls) == 1
    to, message = calls[0]
    assert message == 'Alarm pożarowy, sprawdź budynek!'


def test_notify_uses_generated_text_when_custom_disabled(app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_sms', lambda to, message: calls.append((to, message)))

    with app.app_context():
        NotificationRule.seed_defaults()
        group = SmsGroup.add_group('IT-SMS')
        SmsGroup.add_recipient(group.id, '123456789')
        rule = NotificationRule.query.filter_by(event_type='fire').first()
        rule.sms_enabled = True
        rule.sms_group_id = group.id
        rule.sms_custom_enabled = False
        rule.sms_custom_message = 'Alarm pożarowy, sprawdź budynek!'
        db.session.commit()

    sensor = _bare_sensor(app)
    sensor._notify('fire', 'Wykryto ogień!')

    assert calls[0][1] == 'Wykryto ogień!'


def test_notify_uses_custom_email_subject_when_enabled(app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_email', lambda to, subject, body, **k: calls.append(subject))

    with app.app_context():
        NotificationRule.seed_defaults()
        group = EmailGroup.add_group('IT')
        EmailGroup.add_recipient(group.id, 'a@b.com')
        rule = NotificationRule.query.filter_by(event_type='fire').first()
        rule.email_enabled = True
        rule.email_group_id = group.id
        rule.email_custom_subject_enabled = True
        rule.email_custom_subject = 'UWAGA: pożar!'
        db.session.commit()

    sensor = _bare_sensor(app)
    sensor._notify('fire', 'Wykryto ogień!')

    assert calls == ['UWAGA: pożar!']


def test_notify_skips_email_outside_group_schedule(app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_email', lambda *a, **k: calls.append(a))

    with app.app_context():
        NotificationRule.seed_defaults()
        group = EmailGroup.add_group('IT')
        EmailGroup.add_recipient(group.id, 'a@b.com')
        EmailGroup.update_schedule(group.id, '0' * 168)
        rule = NotificationRule.query.filter_by(event_type='fire').first()
        rule.email_enabled = True
        rule.email_group_id = group.id
        db.session.commit()

    sensor = _bare_sensor(app)
    sensor._notify('fire', 'Wykryto ogień!')

    assert calls == []


def test_notify_skips_sms_outside_group_schedule(app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_sms', lambda *a, **k: calls.append(a))

    with app.app_context():
        NotificationRule.seed_defaults()
        group = SmsGroup.add_group('IT-SMS')
        SmsGroup.add_recipient(group.id, '123456789')
        SmsGroup.update_schedule(group.id, '0' * 168)
        rule = NotificationRule.query.filter_by(event_type='fire').first()
        rule.sms_enabled = True
        rule.sms_group_id = group.id
        db.session.commit()

    sensor = _bare_sensor(app)
    sensor._notify('fire', 'Wykryto ogień!')

    assert calls == []


class _FakeCamera:
    def __init__(self, jpeg_bytes=b'fake-jpeg'):
        self.jpeg_bytes = jpeg_bytes
        self.capture_calls = 0

    def capture_jpeg(self):
        self.capture_calls += 1
        return self.jpeg_bytes


def test_notify_attaches_camera_snapshot_when_enabled(app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_email', lambda to, subject, body, **k: calls.append(k.get('attachment_bytes')))

    with app.app_context():
        NotificationRule.seed_defaults()
        group = EmailGroup.add_group('IT')
        EmailGroup.add_recipient(group.id, 'a@b.com')
        rule = NotificationRule.query.filter_by(event_type='fire').first()
        rule.email_enabled = True
        rule.email_group_id = group.id
        rule.email_attach_camera = True
        db.session.commit()

    sensor = _bare_sensor(app)
    sensor.camera = _FakeCamera(b'jpeg-bytes')
    sensor._notify('fire', 'Wykryto ogień!')

    assert sensor.camera.capture_calls == 1
    assert calls == [b'jpeg-bytes']


def test_notify_does_not_attach_camera_when_disabled(app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_email', lambda to, subject, body, **k: calls.append(k.get('attachment_bytes')))

    with app.app_context():
        NotificationRule.seed_defaults()
        group = EmailGroup.add_group('IT')
        EmailGroup.add_recipient(group.id, 'a@b.com')
        rule = NotificationRule.query.filter_by(event_type='fire').first()
        rule.email_enabled = True
        rule.email_group_id = group.id
        rule.email_attach_camera = False
        db.session.commit()

    sensor = _bare_sensor(app)
    sensor.camera = _FakeCamera(b'jpeg-bytes')
    sensor._notify('fire', 'Wykryto ogień!')

    assert sensor.camera.capture_calls == 0
    assert calls == [None]
