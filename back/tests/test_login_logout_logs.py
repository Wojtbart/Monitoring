from werkzeug.security import generate_password_hash
from models import User, Log


def _create_user(app, username='boss', password='pw123', is_admin=True):
    with app.app_context():
        User.add_user(username, generate_password_hash(password, method='pbkdf2:sha256'), is_admin)


def test_successful_login_writes_log(client, app):
    _create_user(app)
    resp = client.post('/login', json={'username': 'boss', 'password': 'pw123'})
    assert resp.status_code == 200

    with app.app_context():
        logs = Log.get_all_logs()
    assert any(l['sensor_name'] == 'Logowanie' and not l['is_warning']
               and 'boss' in l['log_description'] for l in logs)


def test_failed_login_writes_warning_log(client, app):
    _create_user(app)
    resp = client.post('/login', json={'username': 'boss', 'password': 'wrong'})
    assert resp.status_code == 401

    with app.app_context():
        logs = Log.get_all_logs()
    assert any(l['sensor_name'] == 'Logowanie' and l['is_warning']
               and 'boss' in l['log_description'] for l in logs)


def test_logout_requires_auth(client, app):
    resp = client.post('/logout')
    assert resp.status_code == 401


def test_logout_writes_log(client, app):
    _create_user(app)
    token = client.post('/login', json={'username': 'boss', 'password': 'pw123'}).get_json()['accessToken']

    resp = client.post('/logout', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200

    with app.app_context():
        logs = Log.get_all_logs()
    assert any(l['sensor_name'] == 'Wylogowanie' and 'boss' in l['log_description'] for l in logs)
