from werkzeug.security import generate_password_hash
from models import User


def _login(client, app):
    with app.app_context():
        User.add_user('boss', generate_password_hash('pw123', method='pbkdf2:sha256'), True)
    return client.post('/login', json={'username': 'boss', 'password': 'pw123'}).get_json()['accessToken']


def test_ping_requires_auth(client):
    resp = client.get('/ping/192.168.1.1')
    assert resp.status_code == 401


def test_ping_rejects_unresolvable_address(client, app, monkeypatch):
    def fake_ping(address, count=4):
        raise RuntimeError(f'Cannot resolve address "{address}", try verify your DNS or host file')

    monkeypatch.setattr('app.ping', fake_ping)
    token = _login(client, app)
    resp = client.get('/ping/192.168.18,89', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 400
    assert 'message' in resp.get_json()


def test_ping_returns_messages_on_success(client, app, monkeypatch):
    def fake_ping(address, count=4):
        return ['Reply from 192.168.1.1: bytes=32 time=1ms TTL=64\rok']

    monkeypatch.setattr('app.ping', fake_ping)
    token = _login(client, app)
    resp = client.get('/ping/192.168.1.1', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['messages'] == ['Reply from 192.168.1.1: bytes=32 time=1ms TTL=64']
