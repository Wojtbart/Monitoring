from werkzeug.security import generate_password_hash
from models import User


def _enable(client, app):
    with app.app_context():
        User.add_user('boss', generate_password_hash('pw123', method='pbkdf2:sha256'), True)
    token = client.post('/login', json={'username': 'boss', 'password': 'pw123'}).get_json()['accessToken']
    client.put('/device-sensor-settings', json={'enabled': True},
               headers={'Authorization': f'Bearer {token}'})


def test_get_device_sensors_returns_reading(client, app):
    _enable(client, app)
    resp = client.get('/device-sensors/A0')
    assert resp.status_code == 200
    data = resp.get_json()
    assert 20.0 <= data['temperature'] <= 32.0
    assert 35.0 <= data['humidity'] <= 75.0
    assert 'updated_at' in data


def test_get_device_sensors_same_rack_returns_updated_reading(client, app):
    _enable(client, app)
    first = client.get('/device-sensors/A0').get_json()
    second = client.get('/device-sensors/A0').get_json()
    assert 10.0 <= second['temperature'] <= 45.0
    assert 10.0 <= second['humidity'] <= 95.0


def test_get_device_sensors_requires_no_auth(client):
    resp = client.get('/device-sensors/A1')
    assert resp.status_code == 200
