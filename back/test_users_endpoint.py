from werkzeug.security import generate_password_hash
from models import db, Users


def _make_user(username, password, isadmin):
    Users.add_user(username, generate_password_hash(password, method='pbkdf2:sha256'), isadmin)


def _login(client, username, password):
    resp = client.post('/login', json={'username': username, 'password': password})
    return resp.get_json()['accessToken']


def test_get_users_requires_admin(client, app):
    with app.app_context():
        _make_user('regular', 'pw123', False)
    token = _login(client, 'regular', 'pw123')

    resp = client.get('/users', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 403


def test_get_users_returns_list_for_admin(client, app):
    with app.app_context():
        _make_user('boss', 'pw123', True)
        _make_user('worker', 'pw456', False)
    token = _login(client, 'boss', 'pw123')

    resp = client.get('/users', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200
    data = resp.get_json()
    usernames = {row['username']: row['isadmin'] for row in data}
    assert usernames == {'boss': True, 'worker': False}
    assert all('password' not in row for row in data)


def test_delete_user_requires_admin(client, app):
    with app.app_context():
        _make_user('regular', 'pw123', False)
        _make_user('victim', 'pw456', False)
        victim_id = Users.get_user_by_username('victim').id
    token = _login(client, 'regular', 'pw123')

    resp = client.delete(f'/users/{victim_id}', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 403


def test_delete_user_blocks_self_delete(client, app):
    with app.app_context():
        _make_user('boss', 'pw123', True)
        boss_id = Users.get_user_by_username('boss').id
    token = _login(client, 'boss', 'pw123')

    resp = client.delete(f'/users/{boss_id}', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 400
    with app.app_context():
        assert Users.get_user_by_username('boss') is not None


def test_delete_user_succeeds_for_admin(client, app):
    with app.app_context():
        _make_user('boss', 'pw123', True)
        _make_user('victim', 'pw456', False)
        victim_id = Users.get_user_by_username('victim').id
    token = _login(client, 'boss', 'pw123')

    resp = client.delete(f'/users/{victim_id}', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200
    with app.app_context():
        assert Users.get_user_by_username('victim') is None


def test_delete_user_404_when_missing(client, app):
    with app.app_context():
        _make_user('boss', 'pw123', True)
    token = _login(client, 'boss', 'pw123')

    resp = client.delete('/users/999999', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 404
