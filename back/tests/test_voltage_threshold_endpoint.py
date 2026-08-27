from werkzeug.security import generate_password_hash
from models import User, VoltageThreshold
import app as app_module


class _FakeSensor:
    def update_voltage_threshold(self, min_voltage, max_voltage):
        self.min_voltage = min_voltage
        self.max_voltage = max_voltage


def _login(client, app):
    with app.app_context():
        User.add_user('boss', generate_password_hash('pw123', method='pbkdf2:sha256'), True)
    return client.post('/login', json={'username': 'boss', 'password': 'pw123'}).get_json()['accessToken']


def test_get_voltage_threshold_returns_defaults(client):
    resp = client.get('/voltage-threshold')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['min_voltage'] == 11.0
    assert data['max_voltage'] == 15.0


def test_put_voltage_threshold_requires_auth(client):
    resp = client.put('/voltage-threshold', json={'min_voltage': 10, 'max_voltage': 16})
    assert resp.status_code == 401


def test_put_voltage_threshold_rejects_missing_data(client, app):
    token = _login(client, app)
    resp = client.put('/voltage-threshold', json={'min_voltage': 10},
                       headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 400


def test_put_voltage_threshold_rejects_min_gte_max(client, app):
    token = _login(client, app)
    resp = client.put('/voltage-threshold', json={'min_voltage': 16, 'max_voltage': 10},
                       headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 400


def test_put_voltage_threshold_updates_and_refreshes_sensor(client, app):
    token = _login(client, app)
    app_module.sensor = _FakeSensor()

    resp = client.put('/voltage-threshold', json={'min_voltage': 10.5, 'max_voltage': 16.5},
                       headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200
    assert resp.get_json() == {'min_voltage': 10.5, 'max_voltage': 16.5}

    with app.app_context():
        threshold = VoltageThreshold.get_or_create()
        assert threshold.min_voltage == 10.5
        assert threshold.max_voltage == 16.5
    assert app_module.sensor.min_voltage == 10.5
    assert app_module.sensor.max_voltage == 16.5
