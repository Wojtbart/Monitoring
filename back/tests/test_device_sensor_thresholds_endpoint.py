from werkzeug.security import generate_password_hash
from models import Users


def _login(client, app):
    with app.app_context():
        Users.add_user('boss', generate_password_hash('pw123', method='pbkdf2:sha256'), True)
    resp = client.post('/login', json={'username': 'boss', 'password': 'pw123'})
    return resp.get_json()['accessToken']


def test_get_device_sensors_includes_thresholds(client, app):
    resp = client.get('/deviceSensors/A0/2')
    data = resp.get_json()
    assert data['min_temperature'] == 15.0
    assert data['max_temperature'] == 35.0
    assert data['min_humidity'] == 20.0
    assert data['max_humidity'] == 80.0


def test_update_thresholds_requires_auth(client, app):
    client.get('/deviceSensors/A0/2')
    resp = client.put('/deviceSensors/A0/2/thresholds', json={
        'min_temperature': 10, 'max_temperature': 30,
        'min_humidity': 25, 'max_humidity': 70,
    })
    assert resp.status_code == 401


def test_update_thresholds_succeeds(client, app):
    client.get('/deviceSensors/A0/2')
    token = _login(client, app)
    resp = client.put(
        '/deviceSensors/A0/2/thresholds',
        json={'min_temperature': 10, 'max_temperature': 30, 'min_humidity': 25, 'max_humidity': 70},
        headers={'Authorization': f'Bearer {token}'},
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['min_temperature'] == 10
    assert data['max_temperature'] == 30
    assert data['min_humidity'] == 25
    assert data['max_humidity'] == 70
    assert 'temperature' in data and 'humidity' in data


def test_update_thresholds_rejects_invalid_range(client, app):
    client.get('/deviceSensors/A0/2')
    token = _login(client, app)
    resp = client.put(
        '/deviceSensors/A0/2/thresholds',
        json={'min_temperature': 30, 'max_temperature': 10, 'min_humidity': 25, 'max_humidity': 70},
        headers={'Authorization': f'Bearer {token}'},
    )
    assert resp.status_code == 400


def test_update_thresholds_404_when_device_missing(client, app):
    token = _login(client, app)
    resp = client.put(
        '/deviceSensors/Z9/999/thresholds',
        json={'min_temperature': 10, 'max_temperature': 30, 'min_humidity': 25, 'max_humidity': 70},
        headers={'Authorization': f'Bearer {token}'},
    )
    assert resp.status_code == 404
