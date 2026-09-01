from werkzeug.security import generate_password_hash
from models import User


def _login(client, app):
    with app.app_context():
        User.add_user('boss', generate_password_hash('pw123', method='pbkdf2:sha256'), True)
    return client.post('/login', json={'username': 'boss', 'password': 'pw123'}).get_json()['accessToken']


def test_get_smtp_settings_requires_auth(client):
    resp = client.get('/smtp-settings')
    assert resp.status_code == 401


def test_get_smtp_settings_returns_defaults(client, app):
    token = _login(client, app)
    resp = client.get('/smtp-settings', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['port'] == 587
    assert data['use_tls'] is True
    assert data['host'] is None


def test_put_smtp_settings_requires_auth(client):
    resp = client.put('/smtp-settings', json={'host': 'smtp.example.com'})
    assert resp.status_code == 401


def test_put_smtp_settings_persists(client, app):
    token = _login(client, app)
    headers = {'Authorization': f'Bearer {token}'}
    payload = {
        'host': 'smtp.example.com', 'port': 465, 'username': 'user',
        'password': 'pass', 'from_address': 'from@example.com', 'use_tls': False,
    }
    resp = client.put('/smtp-settings', json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['host'] == 'smtp.example.com'
    assert data['port'] == 465
    assert data['use_tls'] is False

    refetched = client.get('/smtp-settings', headers=headers).get_json()
    assert refetched['host'] == 'smtp.example.com'


def test_smtp_test_endpoint_requires_auth(client):
    resp = client.post('/smtp-settings/test', json={'to_address': 'a@b.com'})
    assert resp.status_code == 401


def test_smtp_test_endpoint_requires_address(client, app):
    token = _login(client, app)
    resp = client.post('/smtp-settings/test', json={}, headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 400


def test_smtp_test_endpoint_calls_send_email(client, app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_email', lambda to, subject, body, **k: calls.append((to, subject)))
    token = _login(client, app)
    resp = client.post('/smtp-settings/test', json={'to_address': 'a@b.com'},
                        headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200
    assert calls == [(['a@b.com'], 'Test SMTP — Monitoring System')]


def test_smtp_test_endpoint_surfaces_send_error(client, app, monkeypatch):
    def _boom(*a, **k):
        raise RuntimeError('Authentication failed')
    monkeypatch.setattr('notifications.send_email', _boom)
    token = _login(client, app)
    resp = client.post('/smtp-settings/test', json={'to_address': 'a@b.com'},
                        headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 502
    assert 'Authentication failed' in resp.get_json()['message']


def test_smtp_test_endpoint_reports_unconfigured(client, app):
    token = _login(client, app)
    resp = client.post('/smtp-settings/test', json={'to_address': 'a@b.com'},
                        headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 502
    assert 'SMTP nieskonfigurowany' in resp.get_json()['message']
