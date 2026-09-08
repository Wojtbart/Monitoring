from werkzeug.security import generate_password_hash
from models import User


def _login(client, app):
    with app.app_context():
        User.add_user('boss', generate_password_hash('pw123', method='pbkdf2:sha256'), True)
    return client.post('/login', json={'username': 'boss', 'password': 'pw123'}).get_json()['accessToken']


def test_sms_test_endpoint_requires_auth(client):
    resp = client.post('/sms-settings/test', json={'to_number': '+48123456789'})
    assert resp.status_code == 401


def test_sms_test_endpoint_requires_number(client, app):
    token = _login(client, app)
    resp = client.post('/sms-settings/test', json={}, headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 400


def test_sms_test_endpoint_calls_send_sms_mock_backend(client, app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_sms', lambda to, message, **k: calls.append((to, message)))
    token = _login(client, app)
    resp = client.post('/sms-settings/test', json={'to_number': '+48123456789'},
                        headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200
    assert 'mock' in resp.get_json()['message'].lower()
    assert calls == [(['+48123456789'], 'Test SMS — Monitoring System.')]


def test_sms_test_endpoint_surfaces_send_error(client, app, monkeypatch):
    def _boom(*a, **k):
        raise RuntimeError('brak potwierdzenia modemu')
    monkeypatch.setattr('notifications.send_sms', _boom)
    token = _login(client, app)
    resp = client.post('/sms-settings/test', json={'to_number': '+48123456789'},
                        headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 502
    assert 'brak potwierdzenia modemu' in resp.get_json()['message']


def test_sms_test_endpoint_reports_sim800_success(client, app, monkeypatch):
    monkeypatch.setenv('SMS_BACKEND', 'sim800')
    monkeypatch.setattr('notifications.send_sms', lambda to, message, **k: None)
    token = _login(client, app)
    resp = client.post('/sms-settings/test', json={'to_number': '+48123456789'},
                        headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200
    assert 'telefon' in resp.get_json()['message'].lower()
