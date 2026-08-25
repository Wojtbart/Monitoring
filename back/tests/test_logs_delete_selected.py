from datetime import datetime
from werkzeug.security import generate_password_hash
from models import User, Log


def _login(client, app):
    with app.app_context():
        User.add_user('boss', generate_password_hash('pw123', method='pbkdf2:sha256'), True)
    return client.post('/login', json={'username': 'boss', 'password': 'pw123'}).get_json()['accessToken']


def _seed_logs(app):
    with app.app_context():
        Log.add_log(datetime.now(), 'Czujnik pożaru', True, 'seed-a')
        Log.add_log(datetime.now(), 'Czujnik gazu', True, 'seed-b')
        Log.add_log(datetime.now(), 'System', False, 'seed-c')
        return [l['id'] for l in Log.get_all_logs() if l['log_description'].startswith('seed-')]


def test_delete_selected_ids_removes_only_those(client, app):
    token = _login(client, app)
    ids = _seed_logs(app)

    resp = client.delete('/logs', json={'ids': ids[:2]},
                          headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200

    with app.app_context():
        remaining_ids = {l['id'] for l in Log.get_all_logs()}
    assert ids[0] not in remaining_ids
    assert ids[1] not in remaining_ids
    assert ids[2] in remaining_ids


def test_delete_without_body_clears_all(client, app):
    token = _login(client, app)
    _seed_logs(app)

    resp = client.delete('/logs', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200

    with app.app_context():
        assert Log.get_all_logs() == []


def test_delete_requires_auth(client, app):
    resp = client.delete('/logs')
    assert resp.status_code == 401
