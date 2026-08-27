from werkzeug.security import generate_password_hash
from models import User, DEFAULT_SCHEDULE


def _login(client, app):
    with app.app_context():
        User.add_user('boss', generate_password_hash('pw123', method='pbkdf2:sha256'), True)
    return client.post('/login', json={'username': 'boss', 'password': 'pw123'}).get_json()['accessToken']


def test_new_group_has_default_schedule(client, app):
    token = _login(client, app)
    client.post('/email-groups', json={'name': 'IT'}, headers={'Authorization': f'Bearer {token}'})
    groups = client.get('/email-groups').get_json()['groups']
    assert groups[0]['schedule'] == DEFAULT_SCHEDULE


def test_update_email_group_schedule_requires_auth(client, app):
    resp = client.put('/email-groups/1/schedule', json={'schedule': '1' * 168})
    assert resp.status_code == 401


def test_update_email_group_schedule_persists(client, app):
    token = _login(client, app)
    headers = {'Authorization': f'Bearer {token}'}
    group_id = client.post('/email-groups', json={'name': 'IT'}, headers=headers).get_json()['id']
    custom = '0' * 168
    resp = client.put(f'/email-groups/{group_id}/schedule', json={'schedule': custom}, headers=headers)
    assert resp.status_code == 200
    groups = client.get('/email-groups').get_json()['groups']
    assert groups[0]['schedule'] == custom


def test_update_email_group_schedule_rejects_bad_length(client, app):
    token = _login(client, app)
    headers = {'Authorization': f'Bearer {token}'}
    group_id = client.post('/email-groups', json={'name': 'IT'}, headers=headers).get_json()['id']
    resp = client.put(f'/email-groups/{group_id}/schedule', json={'schedule': '111'}, headers=headers)
    assert resp.status_code == 400


def test_update_email_group_schedule_404_for_missing_group(client, app):
    token = _login(client, app)
    resp = client.put('/email-groups/999/schedule', json={'schedule': '1' * 168},
                       headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 404


def test_update_sms_group_schedule_persists(client, app):
    token = _login(client, app)
    headers = {'Authorization': f'Bearer {token}'}
    group_id = client.post('/sms-groups', json={'name': 'IT-SMS'}, headers=headers).get_json()['id']
    custom = '0' * 168
    resp = client.put(f'/sms-groups/{group_id}/schedule', json={'schedule': custom}, headers=headers)
    assert resp.status_code == 200
    groups = client.get('/sms-groups').get_json()['groups']
    assert groups[0]['schedule'] == custom
