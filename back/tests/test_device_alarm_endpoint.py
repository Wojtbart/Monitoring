from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash
from models import db, User, Log, DeviceAlarmState, NotificationRule, NotificationGroup
import app as app_module


def _login(client, app):
    with app.app_context():
        User.add_user('boss', generate_password_hash('pw123', method='pbkdf2:sha256'), True)
    return client.post('/login', json={'username': 'boss', 'password': 'pw123'}).get_json()['accessToken']


def _set_thresholds(client, token, rack, **overrides):
    payload = {
        'min_temperature': 15, 'max_temperature': 35,
        'min_humidity': 20, 'max_humidity': 80,
        'min_temperature_critical': 5, 'max_temperature_critical': 45,
        'min_humidity_critical': 10, 'max_humidity_critical': 90,
        'alert_delay_seconds': 0,
    }
    payload.update(overrides)
    return client.put(f'/device-sensors/{rack}/thresholds', json=payload,
                       headers={'Authorization': f'Bearer {token}'})


def test_breach_on_get_triggers_non_critical_alarm_and_log(client, app):
    token = _login(client, app)
    client.get('/device-sensors/A0')
    _set_thresholds(client, token, 'A0', min_temperature=1000, max_temperature=1001)

    resp = client.get('/device-sensors/A0')
    data = resp.get_json()
    assert data['alarm_active_temperature_non_critical'] is True
    assert data['alarm_active_temperature_critical'] is False

    with app.app_context():
        assert DeviceAlarmState.is_active('A0', 'temperature', 'non_critical') is True
        logs = Log.get_all_logs()
    assert any('A0' in l['log_description'] and 'temperatury' in l['log_description'] for l in logs)


def test_breach_beyond_critical_triggers_both_severities(client, app):
    token = _login(client, app)
    client.get('/device-sensors/A1')
    _set_thresholds(client, token, 'A1',
                     min_temperature=1000, max_temperature=1001,
                     min_temperature_critical=1000, max_temperature_critical=1002)

    client.get('/device-sensors/A1')

    with app.app_context():
        assert DeviceAlarmState.is_active('A1', 'temperature', 'non_critical') is True
        assert DeviceAlarmState.is_active('A1', 'temperature', 'critical') is True


def test_repeated_breach_does_not_duplicate_log(client, app):
    token = _login(client, app)
    client.get('/device-sensors/A2')
    _set_thresholds(client, token, 'A2', min_temperature=1000, max_temperature=1001)

    client.get('/device-sensors/A2')
    client.get('/device-sensors/A2')
    client.get('/device-sensors/A2')

    with app.app_context():
        matching = [l for l in Log.get_all_logs() if 'A2' in l['log_description']]
    assert len(matching) == 1


def test_simulate_requires_auth(client):
    resp = client.post('/device-sensors/A0/temperature/non_critical/simulate')
    assert resp.status_code == 401


def test_simulate_rejects_unknown_metric(client, app):
    token = _login(client, app)
    resp = client.post('/device-sensors/A0/pressure/non_critical/simulate',
                        headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 400


def test_simulate_rejects_unknown_severity(client, app):
    token = _login(client, app)
    resp = client.post('/device-sensors/A0/temperature/extreme/simulate',
                        headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 400


def test_simulate_sets_alarm_active(client, app):
    token = _login(client, app)
    client.get('/device-sensors/A3')
    resp = client.post('/device-sensors/A3/humidity/critical/simulate',
                        headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200
    with app.app_context():
        assert DeviceAlarmState.is_active('A3', 'humidity', 'critical') is True
        assert DeviceAlarmState.is_active('A3', 'humidity', 'non_critical') is False


def test_acknowledge_requires_auth(client):
    resp = client.delete('/device-sensors/A0/temperature/non_critical/acknowledge')
    assert resp.status_code == 401


def test_acknowledge_rejects_unknown_metric(client, app):
    token = _login(client, app)
    resp = client.delete('/device-sensors/A0/pressure/non_critical/acknowledge',
                          headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 400


def test_acknowledge_without_active_alarm_returns_404(client, app):
    token = _login(client, app)
    resp = client.delete('/device-sensors/A4/temperature/non_critical/acknowledge',
                          headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 404


def test_acknowledge_marks_acknowledged_but_stays_active_and_logs_user(client, app):
    token = _login(client, app)
    client.get('/device-sensors/A5')
    client.post('/device-sensors/A5/temperature/non_critical/simulate',
                headers={'Authorization': f'Bearer {token}'})

    resp = client.delete('/device-sensors/A5/temperature/non_critical/acknowledge',
                          headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200

    with app.app_context():
        assert DeviceAlarmState.is_active('A5', 'temperature', 'non_critical') is True
        assert DeviceAlarmState.is_acknowledged('A5', 'temperature', 'non_critical') is True
        logs = Log.get_all_logs()
    assert any('boss' in l['log_description'] and 'A5' in l['sensor_name'] for l in logs)


def test_repeated_breach_repeats_after_notify_again_window(client, app):
    token = _login(client, app)
    client.get('/device-sensors/A6')
    with app.app_context():
        NotificationRule.seed_defaults()
        rule = NotificationRule.query.filter_by(event_type='device_threshold').first()
        rule.notify_again_minutes = 5
        db.session.commit()

    _set_thresholds(client, token, 'A6', min_temperature=1000, max_temperature=1001)
    client.get('/device-sensors/A6')

    with app.app_context():
        state = DeviceAlarmState.get('A6', 'temperature', 'non_critical')
        state.last_triggered_at = datetime.now() - timedelta(minutes=6)
        db.session.commit()

    client.get('/device-sensors/A6')

    with app.app_context():
        matching = [l for l in Log.get_all_logs() if 'A6' in l['sensor_name']]
    assert len(matching) == 2


def test_device_alert_uses_custom_sms_text(client, app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_sms', lambda to, message: calls.append(message))

    token = _login(client, app)
    with app.app_context():
        NotificationRule.seed_defaults()
        group = NotificationGroup.add_group('IT-SMS')
        NotificationGroup.add_recipient(group.id, phone_number='123456789')
        rule = NotificationRule.query.filter_by(event_type='device_threshold').first()
        rule.sms_enabled = True
        rule.group_id = group.id
        rule.sms_custom_enabled = True
        rule.sms_custom_message = 'Alarm w szafie!'
        db.session.commit()

    client.get('/device-sensors/A7')
    client.post('/device-sensors/A7/temperature/non_critical/simulate',
                headers={'Authorization': f'Bearer {token}'})

    assert calls == ['Alarm w szafie!']


def test_alert_delay_holds_off_first_alarm(client, app):
    token = _login(client, app)
    client.get('/device-sensors/A8')
    _set_thresholds(client, token, 'A8', min_temperature=1000, max_temperature=1001,
                     alert_delay_seconds=60)

    client.get('/device-sensors/A8')

    with app.app_context():
        assert DeviceAlarmState.is_active('A8', 'temperature', 'non_critical') is False
        state = DeviceAlarmState.get('A8', 'temperature', 'non_critical')
        assert state.pending_since is not None


def test_alert_delay_fires_after_elapsed(client, app):
    token = _login(client, app)
    client.get('/device-sensors/A9')
    _set_thresholds(client, token, 'A9', min_temperature=1000, max_temperature=1001,
                     alert_delay_seconds=30)

    client.get('/device-sensors/A9')
    with app.app_context():
        state = DeviceAlarmState.get('A9', 'temperature', 'non_critical')
        state.pending_since = datetime.now() - timedelta(seconds=31)
        db.session.commit()

    client.get('/device-sensors/A9')

    with app.app_context():
        assert DeviceAlarmState.is_active('A9', 'temperature', 'non_critical') is True


def test_return_to_normal_logs_once(client, app):
    token = _login(client, app)
    client.get('/device-sensors/A10')
    client.post('/device-sensors/A10/temperature/non_critical/simulate',
                headers={'Authorization': f'Bearer {token}'})

    _set_thresholds(client, token, 'A10')  # progi w normie -> odczyt wraca w zakres
    client.get('/device-sensors/A10')
    client.get('/device-sensors/A10')

    with app.app_context():
        matching = [l for l in Log.get_all_logs() if 'A10' in l['sensor_name'] and 'wróciła do normy' in l['log_description']]
    assert len(matching) == 1
    with app.app_context():
        assert DeviceAlarmState.is_active('A10', 'temperature', 'non_critical') is False


def test_device_alert_uses_custom_email_subject(client, app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_email', lambda to, subject, body, **k: calls.append(subject))

    token = _login(client, app)
    with app.app_context():
        NotificationRule.seed_defaults()
        group = NotificationGroup.add_group('IT')
        NotificationGroup.add_recipient(group.id, email='a@b.com')
        rule = NotificationRule.query.filter_by(event_type='device_threshold').first()
        rule.email_enabled = True
        rule.group_id = group.id
        rule.email_custom_subject_enabled = True
        rule.email_custom_subject = 'Alarm szafy!'
        db.session.commit()

    client.get('/device-sensors/A11')
    client.post('/device-sensors/A11/temperature/non_critical/simulate',
                headers={'Authorization': f'Bearer {token}'})

    assert calls == ['Alarm szafy!']


def test_device_alert_skips_email_outside_schedule(client, app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_email', lambda *a, **k: calls.append(a))

    token = _login(client, app)
    with app.app_context():
        NotificationRule.seed_defaults()
        group = NotificationGroup.add_group('IT')
        NotificationGroup.add_recipient(group.id, email='a@b.com')
        NotificationGroup.update_schedule(group.id, '0' * 168)
        rule = NotificationRule.query.filter_by(event_type='device_threshold').first()
        rule.email_enabled = True
        rule.group_id = group.id
        db.session.commit()

    client.get('/device-sensors/A12')
    client.post('/device-sensors/A12/temperature/non_critical/simulate',
                headers={'Authorization': f'Bearer {token}'})

    assert calls == []


def test_device_alert_attaches_camera_snapshot(client, app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_email', lambda to, subject, body, **k: calls.append(k.get('attachment_bytes')))
    monkeypatch.setattr(app_module.camera, 'capture_jpeg', lambda: b'jpeg-bytes')

    token = _login(client, app)
    with app.app_context():
        NotificationRule.seed_defaults()
        group = NotificationGroup.add_group('IT')
        NotificationGroup.add_recipient(group.id, email='a@b.com')
        rule = NotificationRule.query.filter_by(event_type='device_threshold').first()
        rule.email_enabled = True
        rule.group_id = group.id
        rule.email_attach_camera = True
        db.session.commit()

    client.get('/device-sensors/A13')
    client.post('/device-sensors/A13/temperature/non_critical/simulate',
                headers={'Authorization': f'Bearer {token}'})

    assert calls == [b'jpeg-bytes']
