from werkzeug.security import generate_password_hash
from models import User, Log, DeviceAlarmState


def _login(client, app):
    with app.app_context():
        User.add_user('boss', generate_password_hash('pw123', method='pbkdf2:sha256'), True)
    return client.post('/login', json={'username': 'boss', 'password': 'pw123'}).get_json()['accessToken']


def test_breach_on_get_triggers_alarm_and_log(client, app):
    token = _login(client, app)
    client.get('/device-sensors/A0/1')

    client.put('/device-sensors/A0/1/thresholds', json={
        'min_temperature': 1000, 'max_temperature': 1001,
        'min_humidity': 0, 'max_humidity': 100,
    }, headers={'Authorization': f'Bearer {token}'})

    resp = client.get('/device-sensors/A0/1')
    data = resp.get_json()
    assert data['alarm_active_temperature'] is True

    with app.app_context():
        assert DeviceAlarmState.is_active('A0', 1, 'temperature') is True
        logs = Log.get_all_logs()
    assert any('A0' in l['log_description'] and 'temperatury' in l['log_description'] for l in logs)


def test_repeated_breach_does_not_duplicate_log(client, app):
    token = _login(client, app)
    client.get('/device-sensors/A2/2')
    client.put('/device-sensors/A2/2/thresholds', json={
        'min_temperature': 1000, 'max_temperature': 1001,
        'min_humidity': 0, 'max_humidity': 100,
    }, headers={'Authorization': f'Bearer {token}'})

    client.get('/device-sensors/A2/2')
    client.get('/device-sensors/A2/2')
    client.get('/device-sensors/A2/2')

    with app.app_context():
        matching = [l for l in Log.get_all_logs() if 'A2' in l['log_description']]
    assert len(matching) == 1


def test_simulate_requires_auth(client):
    resp = client.post('/device-sensors/A0/1/temperature/simulate')
    assert resp.status_code == 401


def test_simulate_rejects_unknown_metric(client, app):
    token = _login(client, app)
    resp = client.post('/device-sensors/A0/1/pressure/simulate',
                        headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 400


def test_simulate_sets_alarm_active(client, app):
    token = _login(client, app)
    client.get('/device-sensors/A3/5')
    resp = client.post('/device-sensors/A3/5/humidity/simulate',
                        headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200
    with app.app_context():
        assert DeviceAlarmState.is_active('A3', 5, 'humidity') is True


def test_clear_requires_auth(client):
    resp = client.delete('/device-sensors/A0/1/temperature/clear')
    assert resp.status_code == 401


def test_clear_rejects_unknown_metric(client, app):
    token = _login(client, app)
    resp = client.delete('/device-sensors/A0/1/pressure/clear',
                          headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 400


def test_clear_without_active_alarm_returns_404(client, app):
    token = _login(client, app)
    resp = client.delete('/device-sensors/A4/9/temperature/clear',
                          headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 404


def test_clear_sets_alarm_inactive_and_logs_user(client, app):
    token = _login(client, app)
    client.get('/device-sensors/A5/1')
    client.post('/device-sensors/A5/1/temperature/simulate',
                headers={'Authorization': f'Bearer {token}'})

    resp = client.delete('/device-sensors/A5/1/temperature/clear',
                          headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200

    with app.app_context():
        assert DeviceAlarmState.is_active('A5', 1, 'temperature') is False
        logs = Log.get_all_logs()
    assert any('boss' in l['log_description'] and 'A5' in l['sensor_name'] for l in logs)
