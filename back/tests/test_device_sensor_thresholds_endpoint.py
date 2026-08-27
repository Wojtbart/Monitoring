from werkzeug.security import generate_password_hash
from models import User


def _login(client, app):
    with app.app_context():
        User.add_user('boss', generate_password_hash('pw123', method='pbkdf2:sha256'), True)
    resp = client.post('/login', json={'username': 'boss', 'password': 'pw123'})
    return resp.get_json()['accessToken']


FULL_PAYLOAD = {
    'min_temperature': 10, 'max_temperature': 30,
    'min_humidity': 25, 'max_humidity': 70,
    'min_temperature_critical': 0, 'max_temperature_critical': 40,
    'min_humidity_critical': 15, 'max_humidity_critical': 85,
    'alert_delay_seconds': 30,
}


def test_get_device_sensors_includes_thresholds(client, app):
    resp = client.get('/device-sensors/A0/2')
    data = resp.get_json()
    assert data['min_temperature'] == 15.0
    assert data['max_temperature'] == 35.0
    assert data['min_humidity'] == 20.0
    assert data['max_humidity'] == 80.0
    assert data['min_temperature_critical'] == 5.0
    assert data['max_temperature_critical'] == 45.0
    assert data['min_humidity_critical'] == 10.0
    assert data['max_humidity_critical'] == 90.0
    assert data['alert_delay_seconds'] == 0


def test_update_thresholds_requires_auth(client, app):
    client.get('/device-sensors/A0/2')
    resp = client.put('/device-sensors/A0/2/thresholds', json=FULL_PAYLOAD)
    assert resp.status_code == 401


def test_update_thresholds_succeeds(client, app):
    client.get('/device-sensors/A0/2')
    token = _login(client, app)
    resp = client.put(
        '/device-sensors/A0/2/thresholds',
        json=FULL_PAYLOAD,
        headers={'Authorization': f'Bearer {token}'},
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['min_temperature'] == 10
    assert data['max_temperature'] == 30
    assert data['min_humidity'] == 25
    assert data['max_humidity'] == 70
    assert data['min_temperature_critical'] == 0
    assert data['max_temperature_critical'] == 40
    assert data['min_humidity_critical'] == 15
    assert data['max_humidity_critical'] == 85
    assert data['alert_delay_seconds'] == 30
    assert 'temperature' in data and 'humidity' in data


def test_update_thresholds_rejects_invalid_range(client, app):
    client.get('/device-sensors/A0/2')
    token = _login(client, app)
    payload = {**FULL_PAYLOAD, 'min_temperature': 30, 'max_temperature': 10}
    resp = client.put(
        '/device-sensors/A0/2/thresholds',
        json=payload,
        headers={'Authorization': f'Bearer {token}'},
    )
    assert resp.status_code == 400


def test_update_thresholds_rejects_invalid_critical_range(client, app):
    client.get('/device-sensors/A0/2')
    token = _login(client, app)
    payload = {**FULL_PAYLOAD, 'min_temperature_critical': 40, 'max_temperature_critical': 0}
    resp = client.put(
        '/device-sensors/A0/2/thresholds',
        json=payload,
        headers={'Authorization': f'Bearer {token}'},
    )
    assert resp.status_code == 400


def test_update_thresholds_rejects_missing_field(client, app):
    client.get('/device-sensors/A0/2')
    token = _login(client, app)
    payload = {k: v for k, v in FULL_PAYLOAD.items() if k != 'alert_delay_seconds'}
    resp = client.put(
        '/device-sensors/A0/2/thresholds',
        json=payload,
        headers={'Authorization': f'Bearer {token}'},
    )
    assert resp.status_code == 400


def test_update_thresholds_404_when_device_missing(client, app):
    token = _login(client, app)
    resp = client.put(
        '/device-sensors/Z9/999/thresholds',
        json=FULL_PAYLOAD,
        headers={'Authorization': f'Bearer {token}'},
    )
    assert resp.status_code == 404
