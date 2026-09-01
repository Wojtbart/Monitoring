from werkzeug.security import generate_password_hash
from models import User, DeviceSensor, DeviceSensorSettings


def _login(client, app):
    with app.app_context():
        User.add_user('boss', generate_password_hash('pw123', method='pbkdf2:sha256'), True)
    return client.post('/login', json={'username': 'boss', 'password': 'pw123'}).get_json()['accessToken']


def test_get_device_sensor_settings_defaults_enabled(client):
    resp = client.get('/device-sensor-settings')
    assert resp.status_code == 200
    assert resp.get_json() == {'enabled': True}


def test_put_device_sensor_settings_requires_auth(client):
    resp = client.put('/device-sensor-settings', json={'enabled': False})
    assert resp.status_code == 401


def test_put_device_sensor_settings_rejects_non_bool(client, app):
    token = _login(client, app)
    resp = client.put('/device-sensor-settings', json={'enabled': 'nope'},
                       headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 400


def test_put_device_sensor_settings_disables(client, app):
    token = _login(client, app)
    resp = client.put('/device-sensor-settings', json={'enabled': False},
                       headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200
    assert resp.get_json() == {'enabled': False}

    with app.app_context():
        assert DeviceSensorSettings.get_or_create().enabled is False


def test_get_device_sensors_when_disabled_no_existing_row_returns_disabled_only(client, app):
    token = _login(client, app)
    client.put('/device-sensor-settings', json={'enabled': False},
               headers={'Authorization': f'Bearer {token}'})

    resp = client.get('/device-sensors/A0')
    assert resp.status_code == 200
    assert resp.get_json() == {'enabled': False}

    with app.app_context():
        assert DeviceSensor.get_existing('A0') is None


def test_get_device_sensors_when_disabled_freezes_existing_reading(client, app):
    resp = client.get('/device-sensors/A0')
    assert resp.status_code == 200
    first = resp.get_json()
    assert first['enabled'] is True

    token = _login(client, app)
    client.put('/device-sensor-settings', json={'enabled': False},
               headers={'Authorization': f'Bearer {token}'})

    resp2 = client.get('/device-sensors/A0')
    assert resp2.status_code == 200
    second = resp2.get_json()
    assert second['enabled'] is False
    assert second['temperature'] == first['temperature']
    assert second['humidity'] == first['humidity']


def test_get_device_sensors_when_enabled_still_regenerates(client):
    resp = client.get('/device-sensors/A0')
    assert resp.status_code == 200
    assert resp.get_json()['enabled'] is True
