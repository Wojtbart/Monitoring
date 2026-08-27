from werkzeug.security import generate_password_hash
from models import (
    db, User, Setting, NotificationRule, EmailGroup, SmsGroup,
    DeviceSensor, VoltageThreshold, SmtpSettings,
)
from datetime import time as dtime


def _login(client, app):
    with app.app_context():
        User.add_user('boss', generate_password_hash('pw123', method='pbkdf2:sha256'), True)
    return client.post('/login', json={'username': 'boss', 'password': 'pw123'}).get_json()['accessToken']


def test_get_backup_requires_auth(client):
    resp = client.get('/config-backup')
    assert resp.status_code == 401


def test_get_backup_excludes_password(client, app):
    token = _login(client, app)
    with app.app_context():
        SmtpSettings.update('smtp.example.com', 587, 'user', 'topsecret', 'from@example.com', True)
    resp = client.get('/config-backup', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'password' not in data['smtp_settings']
    assert data['smtp_settings']['host'] == 'smtp.example.com'
    assert data['version'] == 1


def test_restore_requires_auth(client):
    resp = client.post('/config-backup/restore', json={'version': 1})
    assert resp.status_code == 401


def test_restore_rejects_invalid_payload(client, app):
    token = _login(client, app)
    resp = client.post('/config-backup/restore', json={'not': 'valid'},
                        headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 400


def test_restore_roundtrip_email_groups_and_rules(client, app):
    token = _login(client, app)
    headers = {'Authorization': f'Bearer {token}'}
    with app.app_context():
        NotificationRule.seed_defaults()
        group = EmailGroup.add_group('IT')
        group_id = group.id
        EmailGroup.add_recipient(group_id, 'a@b.com')
        rule = NotificationRule.query.filter_by(event_type='fire').first()
        rule.email_enabled = True
        rule.email_group_id = group_id
        db.session.commit()

    backup = client.get('/config-backup', headers=headers).get_json()

    with app.app_context():
        EmailGroup.delete_group(group_id)
        NotificationRule.query.filter_by(event_type='fire').first().email_enabled = False
        db.session.commit()

    resp = client.post('/config-backup/restore', json=backup, headers=headers)
    assert resp.status_code == 200

    with app.app_context():
        restored_group = EmailGroup.query.filter_by(name='IT').first()
        assert restored_group is not None
        from models import EmailRecipient
        emails = [r.email for r in EmailRecipient.query.filter_by(group_id=restored_group.id).all()]
        assert emails == ['a@b.com']
        rule = NotificationRule.query.filter_by(event_type='fire').first()
        assert rule.email_enabled is True
        assert rule.email_group_id == restored_group.id


def test_restore_device_thresholds_only_for_existing_devices(client, app):
    token = _login(client, app)
    headers = {'Authorization': f'Bearer {token}'}
    client.get('/device-sensors/A0/1')
    backup = client.get('/config-backup', headers=headers).get_json()
    backup['device_sensor_thresholds'][0]['min_temperature'] = 1.0
    backup['device_sensor_thresholds'][0]['max_temperature'] = 2.0
    backup['device_sensor_thresholds'][0]['min_temperature_critical'] = 0.0
    backup['device_sensor_thresholds'][0]['max_temperature_critical'] = 3.0

    resp = client.post('/config-backup/restore', json=backup, headers=headers)
    assert resp.status_code == 200

    data = client.get('/device-sensors/A0/1').get_json()
    assert data['min_temperature'] == 1.0
    assert data['max_temperature'] == 2.0


def test_restore_voltage_threshold(client, app):
    token = _login(client, app)
    headers = {'Authorization': f'Bearer {token}'}
    backup = client.get('/config-backup', headers=headers).get_json()
    backup['voltage_threshold'] = {'min_voltage': 9.0, 'max_voltage': 17.0}

    resp = client.post('/config-backup/restore', json=backup, headers=headers)
    assert resp.status_code == 200

    with app.app_context():
        threshold = VoltageThreshold.get_or_create()
        assert threshold.min_voltage == 9.0
        assert threshold.max_voltage == 17.0


def test_restore_smtp_preserves_existing_password(client, app):
    token = _login(client, app)
    headers = {'Authorization': f'Bearer {token}'}
    with app.app_context():
        SmtpSettings.update('old.example.com', 587, 'olduser', 'realpassword', 'old@example.com', True)

    backup = client.get('/config-backup', headers=headers).get_json()
    backup['smtp_settings']['host'] = 'new.example.com'

    resp = client.post('/config-backup/restore', json=backup, headers=headers)
    assert resp.status_code == 200

    with app.app_context():
        settings = SmtpSettings.get_or_create()
        assert settings.host == 'new.example.com'
        assert settings.password == 'realpassword'
