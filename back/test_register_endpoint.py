from werkzeug.security import generate_password_hash
from models import db, Users


def _make_user(username, password, isadmin):
    Users.add_user(username, generate_password_hash(password, method='pbkdf2:sha256'), isadmin)


def _login(client, username, password):
    resp = client.post('/login', json={'username': username, 'password': password})
    return resp.get_json()['accessToken']


def test_register_requires_auth(client, app):
    resp = client.post('/register', json={'username': 'newbie', 'password': 'pw'})
    assert resp.status_code == 401


def test_register_requires_admin(client, app):
    with app.app_context():
        _make_user('regular', 'pw123', False)
    token = _login(client, 'regular', 'pw123')

    resp = client.post(
        '/register',
        json={'username': 'newbie', 'password': 'pw'},
        headers={'Authorization': f'Bearer {token}'},
    )
    assert resp.status_code == 403


def test_register_succeeds_for_admin(client, app):
    with app.app_context():
        _make_user('boss', 'pw123', True)
    token = _login(client, 'boss', 'pw123')

    resp = client.post(
        '/register',
        json={'username': 'newbie', 'password': 'pw'},
        headers={'Authorization': f'Bearer {token}'},
    )
    assert resp.status_code == 200
    with app.app_context():
        assert Users.get_user_by_username('newbie') is not None
